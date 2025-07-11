import { Logger } from '../utils/logger.js';
import { FileUtils } from '../utils/file.js';
import {
    DependencyGraph,
    DependencyEdge,
    DependencyType,
    ModuleInfo,
    FileType
} from '../types/terragrunt.js';
import { DependencyAnalysisOptions, UnusedModulesOptions } from '../types/mcp.js';

export class DependencyAnalyzer {
    constructor(private logger: Logger) { }

    /**
     * Analisa todas as dependências do projeto
     */
    async analyzeDependencies(projectPath: string, options: DependencyAnalysisOptions = {}): Promise<any> {
        this.logger.info(`Analisando dependências em: ${projectPath}`);

        const modules = await this.findAllModules(projectPath);
        const dependencies = await this.buildDependencyGraph(modules);
        const circularDependencies = this.detectCircularDependencies(dependencies);

        return {
            modules: modules.map(m => ({
                path: m.path,
                name: m.name,
                dependencies: m.dependencies.length
            })),
            directDependencies: dependencies.edges.filter(e => e.type === DependencyType.DIRECT),
            circularDependencies,
            graph: dependencies
        };
    }

    /**
     * Encontra módulos não utilizados
     */
    async findUnusedModules(projectPath: string, options: UnusedModulesOptions = {}): Promise<any> {
        this.logger.info(`Procurando módulos não utilizados em: ${projectPath}`);

        const modules = await this.findAllModules(projectPath);
        const dependencyGraph = await this.buildDependencyGraph(modules);

        const orphaned = this.findOrphanedModules(modules, dependencyGraph);
        const isolated = this.findIsolatedModules(modules, dependencyGraph);

        return {
            orphaned: orphaned.map(m => ({
                path: m.path,
                lastModified: 'unknown', // Seria obtido via fs.stat
                size: 0,
                reason: 'Não possui dependentes'
            })),
            isolated: isolated.map(m => ({
                path: m.path,
                reason: 'Módulo isolado sem dependências'
            })),
            potentialCleanup: orphaned.length + isolated.length,
            recommendations: this.generateCleanupRecommendations(orphaned, isolated)
        };
    }

    /**
     * Encontra todos os módulos Terragrunt
     */
    private async findAllModules(projectPath: string): Promise<ModuleInfo[]> {
        const terragruntFiles = await FileUtils.findTerragruntFiles(projectPath);
        const modules: ModuleInfo[] = [];

        for (const file of terragruntFiles) {
            if (FileUtils.getFileType(file) === FileType.TERRAGRUNT_HCL) {
                const module = await this.analyzeModule(file);
                modules.push(module);
            }
        }

        return modules;
    }

    /**
     * Analisa um módulo específico
     */
    private async analyzeModule(configPath: string): Promise<ModuleInfo> {
        const content = await FileUtils.readFile(configPath);
        const config = this.parseBasicConfig(content);
        const moduleName = FileUtils.getBaseName(FileUtils.getDirectoryName(configPath));

        const dependencies = this.extractDependencies(content, configPath);

        return {
            path: configPath,
            name: moduleName,
            source: config.terraform?.source,
            version: config.terragrunt_version_constraint,
            dependencies,
            dependents: [], // Será calculado durante construção do grafo
            inputs: config.inputs || {},
            outputs: {},
            config
        };
    }

    /**
     * Extrai dependências de um arquivo de configuração
     */
    private extractDependencies(content: string, configPath: string): string[] {
        const dependencies: string[] = [];
        const configDir = FileUtils.getDirectoryName(configPath);

        // Extrai dependencies block
        const dependenciesMatch = content.match(/dependencies\s*{\s*paths\s*=\s*\[([^\]]*)\]/s);
        if (dependenciesMatch) {
            const pathsContent = dependenciesMatch[1];
            const paths = pathsContent.split(',')
                .map(p => p.trim().replace(/['"]/g, ''))
                .filter(p => p.length > 0);

            for (const path of paths) {
                const resolvedPath = this.resolveDependencyPath(path, configDir);
                dependencies.push(resolvedPath);
            }
        }

        // Extrai dependency blocks
        const dependencyBlocks = content.matchAll(/dependency\s+"([^"]+)"\s*{[^}]*config_path\s*=\s*"([^"]+)"[^}]*}/gs);

        for (const match of dependencyBlocks) {
            const configPath = match[2];
            const resolvedPath = this.resolveDependencyPath(configPath, configDir);
            dependencies.push(resolvedPath);
        }

        // Extrai include paths
        const includeBlocks = content.matchAll(/include\s*(?:"[^"]*"\s*)?{\s*path\s*=\s*"([^"]+)"/gs);

        for (const match of includeBlocks) {
            const includePath = match[1];
            const resolvedPath = this.resolveDependencyPath(includePath, configDir);
            dependencies.push(resolvedPath);
        }

        return [...new Set(dependencies)]; // Remove duplicatas
    }

    /**
     * Resolve caminho de dependência relativo para absoluto
     */
    private resolveDependencyPath(relativePath: string, fromDir: string): string {
        if (relativePath.startsWith('/')) {
            return relativePath; // Já é absoluto
        }

        // Resolve caminho relativo
        return FileUtils.resolvePath(fromDir, relativePath);
    }

    /**
     * Constrói grafo de dependências
     */
    private async buildDependencyGraph(modules: ModuleInfo[]): Promise<DependencyGraph> {
        const edges: DependencyEdge[] = [];
        const modulesByPath = new Map(modules.map(m => [m.path, m]));

        // Constrói arestas do grafo
        for (const module of modules) {
            for (const depPath of module.dependencies) {
                // Tenta encontrar o módulo de destino
                const targetModule = this.findModuleByPath(depPath, modulesByPath);

                if (targetModule) {
                    edges.push({
                        from: module.path,
                        to: targetModule.path,
                        type: DependencyType.DIRECT
                    });

                    // Atualiza dependents
                    targetModule.dependents.push(module.path);
                }
            }
        }

        // Adiciona dependências transitivas se necessário
        const transitiveEdges = this.calculateTransitiveDependencies(edges);
        edges.push(...transitiveEdges);

        const circularDependencies = this.detectCircularDependencies({ modules, edges, circularDependencies: [], orphanedModules: [] });
        const orphanedModules = this.findOrphanedModules(modules, { modules, edges, circularDependencies, orphanedModules: [] }).map(m => m.path);

        return {
            modules,
            edges,
            circularDependencies,
            orphanedModules
        };
    }

    /**
     * Encontra módulo por caminho
     */
    private findModuleByPath(targetPath: string, modulesByPath: Map<string, ModuleInfo>): ModuleInfo | undefined {
        // Procura exato
        if (modulesByPath.has(targetPath)) {
            return modulesByPath.get(targetPath);
        }

        // Procura por terragrunt.hcl no diretório target
        const terragruntPath = FileUtils.joinPath(targetPath, 'terragrunt.hcl');
        if (modulesByPath.has(terragruntPath)) {
            return modulesByPath.get(terragruntPath);
        }

        // Procura por correspondência de diretório
        const targetDir = targetPath.endsWith('terragrunt.hcl') ?
            FileUtils.getDirectoryName(targetPath) : targetPath;

        for (const [path, module] of modulesByPath) {
            const moduleDir = FileUtils.getDirectoryName(path);
            if (moduleDir === targetDir) {
                return module;
            }
        }

        return undefined;
    }

    /**
     * Calcula dependências transitivas
     */
    private calculateTransitiveDependencies(directEdges: DependencyEdge[]): DependencyEdge[] {
        const transitiveEdges: DependencyEdge[] = [];
        const edgeMap = new Map<string, Set<string>>();

        // Constrói mapa de adjacências
        for (const edge of directEdges) {
            if (!edgeMap.has(edge.from)) {
                edgeMap.set(edge.from, new Set());
            }
            edgeMap.get(edge.from)!.add(edge.to);
        }

        // Calcula fechamento transitivo
        for (const [from, directTargets] of edgeMap) {
            const visited = new Set<string>();
            const stack = [...directTargets];

            while (stack.length > 0) {
                const current = stack.pop()!;

                if (visited.has(current)) continue;
                visited.add(current);

                const currentTargets = edgeMap.get(current);
                if (currentTargets) {
                    for (const target of currentTargets) {
                        if (!directTargets.has(target) && target !== from) {
                            transitiveEdges.push({
                                from,
                                to: target,
                                type: DependencyType.TRANSITIVE
                            });
                        }

                        if (!visited.has(target)) {
                            stack.push(target);
                        }
                    }
                }
            }
        }

        return transitiveEdges;
    }

    /**
     * Detecta dependências circulares
     */
    detectCircularDependencies(graph: DependencyGraph): string[][] {
        const cycles: string[][] = [];
        const visited = new Set<string>();
        const recursionStack = new Set<string>();
        const edgeMap = new Map<string, string[]>();

        // Constrói mapa de adjacências apenas com dependências diretas
        for (const edge of graph.edges) {
            if (edge.type === DependencyType.DIRECT) {
                if (!edgeMap.has(edge.from)) {
                    edgeMap.set(edge.from, []);
                }
                edgeMap.get(edge.from)!.push(edge.to);
            }
        }

        // DFS para detectar ciclos
        const dfs = (node: string, path: string[]): void => {
            visited.add(node);
            recursionStack.add(node);
            const currentPath = [...path, node];

            const neighbors = edgeMap.get(node) || [];
            for (const neighbor of neighbors) {
                if (!visited.has(neighbor)) {
                    dfs(neighbor, currentPath);
                } else if (recursionStack.has(neighbor)) {
                    // Encontrou ciclo
                    const cycleStart = currentPath.indexOf(neighbor);
                    const cycle = currentPath.slice(cycleStart);
                    cycles.push([...cycle, neighbor]); // Fecha o ciclo
                }
            }

            recursionStack.delete(node);
        };

        // Executa DFS para todos os nós
        for (const module of graph.modules) {
            if (!visited.has(module.path)) {
                dfs(module.path, []);
            }
        }

        return cycles;
    }

    /**
     * Encontra módulos órfãos (sem dependentes)
     */
    private findOrphanedModules(modules: ModuleInfo[], graph: DependencyGraph): ModuleInfo[] {
        const modulesPaths = new Set(modules.map(m => m.path));
        const modulesWithDependents = new Set<string>();

        // Marca módulos que são dependências de outros
        for (const edge of graph.edges) {
            if (edge.type === DependencyType.DIRECT && modulesPaths.has(edge.to)) {
                modulesWithDependents.add(edge.to);
            }
        }

        // Retorna módulos sem dependentes
        return modules.filter(m => !modulesWithDependents.has(m.path));
    }

    /**
     * Encontra módulos isolados (sem dependências nem dependentes)
     */
    private findIsolatedModules(modules: ModuleInfo[], graph: DependencyGraph): ModuleInfo[] {
        const modulesWithConnections = new Set<string>();

        // Marca módulos que têm qualquer conexão
        for (const edge of graph.edges) {
            if (edge.type === DependencyType.DIRECT) {
                modulesWithConnections.add(edge.from);
                modulesWithConnections.add(edge.to);
            }
        }

        // Retorna módulos completamente isolados
        return modules.filter(m => !modulesWithConnections.has(m.path));
    }

    /**
     * Gera recomendações de limpeza
     */
    private generateCleanupRecommendations(orphaned: ModuleInfo[], isolated: ModuleInfo[]): Array<{ action: string, description: string }> {
        const recommendations = [];

        if (orphaned.length > 0) {
            recommendations.push({
                action: 'Revisar módulos órfãos',
                description: `${orphaned.length} módulos não são utilizados por outros módulos`
            });
        }

        if (isolated.length > 0) {
            recommendations.push({
                action: 'Verificar módulos isolados',
                description: `${isolated.length} módulos não têm dependências nem dependentes`
            });
        }

        if (orphaned.length === 0 && isolated.length === 0) {
            recommendations.push({
                action: 'Manter estrutura atual',
                description: 'Todos os módulos estão sendo utilizados adequadamente'
            });
        }

        return recommendations;
    }

    /**
     * Parse básico de configuração HCL
     */
    private parseBasicConfig(content: string): any {
        const config: any = {};

        // Parse simplificado - em produção usar parser HCL real

        // Extrai terraform source
        const terraformMatch = content.match(/terraform\s*{[^}]*source\s*=\s*"([^"]+)"[^}]*}/s);
        if (terraformMatch) {
            config.terraform = { source: terraformMatch[1] };
        }

        // Extrai inputs
        const inputsMatch = content.match(/inputs\s*=\s*{([^}]*)}/s);
        if (inputsMatch) {
            config.inputs = {}; // Parse simples dos inputs
        }

        // Extrai version constraint
        const versionMatch = content.match(/terragrunt_version_constraint\s*=\s*"([^"]+)"/);
        if (versionMatch) {
            config.terragrunt_version_constraint = versionMatch[1];
        }

        return config;
    }
}
