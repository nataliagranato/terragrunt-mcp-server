import { Logger } from '../utils/logger.js';
import { FileUtils } from '../utils/file.js';
import {
    TerragruntStackConfig,
    StackUnit,
    ValidationError,
    ValidationWarning,
    Issue
} from '../types/terragrunt.js';
import { StackAnalysisOptions } from '../types/mcp.js';

export class StackAnalyzer {
    constructor(private logger: Logger) { }

    /**
     * Analisa um arquivo de stack Terragrunt
     */
    async analyzeStack(stackPath: string, options: StackAnalysisOptions = {}): Promise<any> {
        this.logger.info(`Analisando stack: ${stackPath}`);

        if (!(await FileUtils.exists(stackPath))) {
            throw new Error(`Arquivo de stack não encontrado: ${stackPath}`);
        }

        const content = await FileUtils.readFile(stackPath);
        const config = await this.parseStackConfig(content);

        const units = await this.extractUnits(config, stackPath);
        const dependencies = await this.analyzeDependencies(units, stackPath);
        const issues = await this.validateStack(config, stackPath, options);

        const complexity = this.calculateComplexity(units, dependencies);
        const maxDepth = this.calculateMaxDepth(dependencies);
        const uniqueModules = this.countUniqueModules(units);

        return {
            path: stackPath,
            name: FileUtils.getBaseName(stackPath, '.hcl'),
            isValid: issues.length === 0,
            units,
            dependencies,
            issues,
            complexity,
            maxDepth,
            uniqueModules
        };
    }

    /**
     * Parse da configuração do stack
     */
    private async parseStackConfig(content: string): Promise<TerragruntStackConfig> {
        // Parse básico do HCL - em produção usaria parser HCL real
        const config: TerragruntStackConfig = {};

        // Extrai definições de unit
        const units = this.extractUnitDefinitions(content);
        if (Object.keys(units).length > 0) {
            config.unit = units;
        }

        // Extrai definições de stack
        const stacks = this.extractStackDefinitions(content);
        if (Object.keys(stacks).length > 0) {
            config.stack = stacks;
        }

        // Extrai catalog
        const catalogMatch = content.match(/catalog\s*{([^}]*)}/s);
        if (catalogMatch) {
            config.catalog = this.parseCatalogConfig(catalogMatch[1]);
        }

        // Extrai locals
        const localsMatch = content.match(/locals\s*{([^}]*)}/s);
        if (localsMatch) {
            config.locals = this.parseLocalsConfig(localsMatch[1]);
        }

        return config;
    }

    /**
     * Extrai definições de unit do conteúdo
     */
    private extractUnitDefinitions(content: string): Record<string, StackUnit> {
        const units: Record<string, StackUnit> = {};

        const unitMatches = content.matchAll(/unit\s+"([^"]+)"\s*{([^}]*)}/gs);

        for (const match of unitMatches) {
            const unitName = match[1];
            const unitContent = match[2];

            const unit: StackUnit = {
                source: this.extractValue(unitContent, 'source') || ''
            };

            // Extrai outras propriedades opcionais
            const name = this.extractValue(unitContent, 'name');
            if (name) unit.name = name;

            const inputs = this.extractInputs(unitContent);
            if (inputs) unit.inputs = inputs;

            const dependencies = this.extractDependencies(unitContent);
            if (dependencies.length > 0) unit.dependencies = dependencies;

            const skip = this.extractBooleanValue(unitContent, 'skip');
            if (skip !== null) unit.skip = skip;

            const preventDestroy = this.extractBooleanValue(unitContent, 'prevent_destroy');
            if (preventDestroy !== null) unit.prevent_destroy = preventDestroy;

            units[unitName] = unit;
        }

        return units;
    }

    /**
     * Extrai definições de stack do conteúdo
     */
    private extractStackDefinitions(content: string): Record<string, any> {
        const stacks: Record<string, any> = {};

        const stackMatches = content.matchAll(/stack\s+"([^"]+)"\s*{([^}]*)}/gs);

        for (const match of stackMatches) {
            const stackName = match[1];
            const stackContent = match[2];

            stacks[stackName] = {
                description: this.extractValue(stackContent, 'description'),
                units: this.extractUnitDefinitions(stackContent),
                dependencies: this.extractDependencies(stackContent)
            };
        }

        return stacks;
    }

    /**
     * Extrai unidades do stack
     */
    private async extractUnits(config: TerragruntStackConfig, stackPath: string): Promise<any[]> {
        const units: any[] = [];
        const stackDir = FileUtils.getDirectoryName(stackPath);

        // Processa units definidas diretamente
        if (config.unit) {
            for (const [name, unitConfig] of Object.entries(config.unit)) {
                const unit = {
                    name,
                    source: unitConfig.source,
                    inputs: unitConfig.inputs || {},
                    dependencies: unitConfig.dependencies || [],
                    skip: unitConfig.skip || false,
                    preventDestroy: unitConfig.prevent_destroy || false,
                    resolvedSource: await this.resolveSource(unitConfig.source, stackDir)
                };

                units.push(unit);
            }
        }

        // Processa stacks aninhados
        if (config.stack) {
            for (const [stackName, stackDef] of Object.entries(config.stack)) {
                for (const [unitName, unitConfig] of Object.entries(stackDef.units || {})) {
                    const unit = {
                        name: `${stackName}/${unitName}`,
                        source: unitConfig.source,
                        inputs: unitConfig.inputs || {},
                        dependencies: unitConfig.dependencies || [],
                        skip: unitConfig.skip || false,
                        preventDestroy: unitConfig.prevent_destroy || false,
                        resolvedSource: await this.resolveSource(unitConfig.source, stackDir),
                        parentStack: stackName
                    };

                    units.push(unit);
                }
            }
        }

        return units;
    }

    /**
     * Resolve source de uma unit
     */
    private async resolveSource(source: string, baseDir: string): Promise<string> {
        if (source.startsWith('catalog://')) {
            return source; // Catalog sources são resolvidos em runtime
        }

        if (source.startsWith('./') || source.startsWith('../')) {
            return FileUtils.resolvePath(baseDir, source);
        }

        if (source.startsWith('git::') || source.includes('://')) {
            return source; // URLs remotas
        }

        // Assume caminho relativo
        return FileUtils.resolvePath(baseDir, source);
    }

    /**
     * Analisa dependências entre units
     */
    private async analyzeDependencies(units: any[], stackPath: string): Promise<any[]> {
        const dependencies: any[] = [];
        const unitsByName = new Map(units.map(u => [u.name, u]));

        for (const unit of units) {
            for (const depName of unit.dependencies) {
                const depUnit = unitsByName.get(depName);

                if (depUnit) {
                    dependencies.push({
                        from: unit.name,
                        to: depUnit.name,
                        type: 'unit'
                    });
                } else {
                    // Dependência externa ou não encontrada
                    dependencies.push({
                        from: unit.name,
                        to: depName,
                        type: 'external'
                    });
                }
            }
        }

        return dependencies;
    }

    /**
     * Valida o stack
     */
    private async validateStack(
        config: TerragruntStackConfig,
        stackPath: string,
        options: StackAnalysisOptions
    ): Promise<Issue[]> {
        const issues: Issue[] = [];

        // Verifica se tem pelo menos uma unit ou stack
        if (!config.unit && !config.stack) {
            issues.push({
                type: 'structure',
                severity: 'error',
                message: 'Stack deve conter pelo menos uma definição de unit ou stack',
                location: stackPath,
                solution: 'Adicione definições de unit { } ou stack { }'
            });
        }

        // Valida units
        if (config.unit) {
            for (const [name, unit] of Object.entries(config.unit)) {
                await this.validateUnit(name, unit, stackPath, issues, options);
            }
        }

        // Valida stacks aninhados
        if (config.stack) {
            for (const [stackName, stackDef] of Object.entries(config.stack)) {
                await this.validateNestedStack(stackName, stackDef, stackPath, issues, options);
            }
        }

        // Verifica dependências circulares
        const circularDeps = this.detectCircularDependencies(config);
        if (circularDeps.length > 0) {
            issues.push({
                type: 'dependencies',
                severity: 'critical',
                message: `Dependências circulares detectadas: ${circularDeps.join(' -> ')}`,
                location: stackPath,
                solution: 'Reestruture as dependências para evitar ciclos'
            });
        }

        return issues;
    }

    /**
     * Valida uma unit específica
     */
    private async validateUnit(
        name: string,
        unit: StackUnit,
        stackPath: string,
        issues: Issue[],
        options: StackAnalysisOptions
    ): Promise<void> {

        // Verifica source obrigatório
        if (!unit.source) {
            issues.push({
                type: 'configuration',
                severity: 'error',
                message: `Unit '${name}' deve especificar source`,
                location: `${stackPath}:unit.${name}`,
                solution: 'Adicione source = "caminho/para/modulo"'
            });
        }

        // Valida source
        if (unit.source) {
            await this.validateUnitSource(name, unit.source, stackPath, issues, options);
        }

        // Verifica dependências
        if (unit.dependencies) {
            for (const dep of unit.dependencies) {
                if (dep === name) {
                    issues.push({
                        type: 'dependencies',
                        severity: 'error',
                        message: `Unit '${name}' não pode depender de si mesma`,
                        location: `${stackPath}:unit.${name}`,
                        solution: 'Remova a auto-dependência'
                    });
                }
            }
        }
    }

    /**
     * Valida source de uma unit
     */
    private async validateUnitSource(
        unitName: string,
        source: string,
        stackPath: string,
        issues: Issue[],
        options: StackAnalysisOptions
    ): Promise<void> {

        if (source.startsWith('catalog://')) {
            // Verifica se catalog está configurado
            const content = await FileUtils.readFile(stackPath);
            if (!content.includes('catalog {')) {
                issues.push({
                    type: 'configuration',
                    severity: 'warning',
                    message: `Unit '${unitName}' usa catalog source mas catalog não está configurado`,
                    location: `${stackPath}:unit.${unitName}`,
                    solution: 'Configure bloco catalog { } ou use source diferente'
                });
            }
        } else if (source.startsWith('./') || source.startsWith('../')) {
            // Verifica se caminho local existe
            if (options.validateUnits) {
                const stackDir = FileUtils.getDirectoryName(stackPath);
                const resolvedPath = FileUtils.resolvePath(stackDir, source);

                if (!(await FileUtils.exists(resolvedPath))) {
                    issues.push({
                        type: 'configuration',
                        severity: 'warning',
                        message: `Source local '${source}' para unit '${unitName}' não encontrado`,
                        location: `${stackPath}:unit.${unitName}`,
                        solution: 'Verifique se o caminho está correto'
                    });
                }
            }
        } else if (!source.includes('://')) {
            // Source suspeito
            issues.push({
                type: 'configuration',
                severity: 'warning',
                message: `Source '${source}' para unit '${unitName}' pode estar mal formatado`,
                location: `${stackPath}:unit.${unitName}`,
                solution: 'Verifique o formato do source'
            });
        }
    }

    /**
     * Valida stack aninhado
     */
    private async validateNestedStack(
        stackName: string,
        stackDef: any,
        stackPath: string,
        issues: Issue[],
        options: StackAnalysisOptions
    ): Promise<void> {

        if (!stackDef.units || Object.keys(stackDef.units).length === 0) {
            issues.push({
                type: 'structure',
                severity: 'warning',
                message: `Stack '${stackName}' não contém units`,
                location: `${stackPath}:stack.${stackName}`,
                solution: 'Adicione units ao stack ou remova-o'
            });
        }

        // Valida units do stack aninhado
        if (stackDef.units) {
            for (const [unitName, unit] of Object.entries(stackDef.units)) {
                await this.validateUnit(`${stackName}/${unitName}`, unit as StackUnit, stackPath, issues, options);
            }
        }
    }

    /**
     * Detecta dependências circulares
     */
    private detectCircularDependencies(config: TerragruntStackConfig): string[] {
        const graph = new Map<string, string[]>();

        // Constrói grafo de dependências
        if (config.unit) {
            for (const [name, unit] of Object.entries(config.unit)) {
                graph.set(name, unit.dependencies || []);
            }
        }

        if (config.stack) {
            for (const [stackName, stackDef] of Object.entries(config.stack)) {
                if (stackDef.units) {
                    for (const [unitName, unit] of Object.entries(stackDef.units)) {
                        const fullName = `${stackName}/${unitName}`;
                        graph.set(fullName, unit.dependencies || []);
                    }
                }
            }
        }

        // Detecta ciclos usando DFS
        const visited = new Set<string>();
        const recursionStack = new Set<string>();

        const dfs = (node: string, path: string[]): string[] => {
            if (recursionStack.has(node)) {
                const cycleStart = path.indexOf(node);
                return path.slice(cycleStart);
            }

            if (visited.has(node)) {
                return [];
            }

            visited.add(node);
            recursionStack.add(node);

            const neighbors = graph.get(node) || [];
            for (const neighbor of neighbors) {
                const cycle = dfs(neighbor, [...path, node]);
                if (cycle.length > 0) {
                    return cycle;
                }
            }

            recursionStack.delete(node);
            return [];
        };

        for (const node of graph.keys()) {
            if (!visited.has(node)) {
                const cycle = dfs(node, []);
                if (cycle.length > 0) {
                    return cycle;
                }
            }
        }

        return [];
    }

    /**
     * Calcula complexidade do stack
     */
    private calculateComplexity(units: any[], dependencies: any[]): number {
        const unitCount = units.length;
        const depCount = dependencies.length;
        const maxDeps = Math.max(...units.map(u => u.dependencies.length));

        // Fórmula simplificada: base + dependências + complexidade máxima
        return Math.min(100, unitCount * 2 + depCount + maxDeps * 3);
    }

    /**
     * Calcula profundidade máxima de dependências
     */
    private calculateMaxDepth(dependencies: any[]): number {
        const graph = new Map<string, string[]>();

        // Constrói grafo
        for (const dep of dependencies) {
            if (!graph.has(dep.from)) {
                graph.set(dep.from, []);
            }
            graph.get(dep.from)!.push(dep.to);
        }

        // Calcula profundidade máxima
        let maxDepth = 0;

        const dfs = (node: string, depth: number, visited: Set<string>): number => {
            if (visited.has(node)) return depth;

            visited.add(node);
            let currentMaxDepth = depth;

            const neighbors = graph.get(node) || [];
            for (const neighbor of neighbors) {
                currentMaxDepth = Math.max(currentMaxDepth, dfs(neighbor, depth + 1, new Set(visited)));
            }

            return currentMaxDepth;
        };

        for (const node of graph.keys()) {
            maxDepth = Math.max(maxDepth, dfs(node, 0, new Set()));
        }

        return maxDepth;
    }

    /**
     * Conta módulos únicos
     */
    private countUniqueModules(units: any[]): number {
        const uniqueSources = new Set();

        for (const unit of units) {
            if (unit.resolvedSource) {
                uniqueSources.add(unit.resolvedSource);
            }
        }

        return uniqueSources.size;
    }

    // Métodos auxiliares para parsing
    private extractValue(content: string, key: string): string | null {
        const match = content.match(new RegExp(`${key}\\s*=\\s*"([^"]+)"`));
        return match ? match[1] : null;
    }

    private extractBooleanValue(content: string, key: string): boolean | null {
        const match = content.match(new RegExp(`${key}\\s*=\\s*(true|false)`));
        return match ? match[1] === 'true' : null;
    }

    private extractInputs(content: string): Record<string, any> | null {
        const match = content.match(/inputs\s*=\s*{([^}]*)}/s);
        if (!match) return null;

        // Parse simplificado dos inputs
        const inputs: Record<string, any> = {};
        const inputsContent = match[1];

        const inputMatches = inputsContent.matchAll(/(\w+)\s*=\s*"([^"]+)"/g);
        for (const inputMatch of inputMatches) {
            inputs[inputMatch[1]] = inputMatch[2];
        }

        return Object.keys(inputs).length > 0 ? inputs : null;
    }

    private extractDependencies(content: string): string[] {
        const dependencies: string[] = [];

        const match = content.match(/dependencies\s*=\s*\[([^\]]*)\]/s);
        if (match) {
            const deps = match[1].split(',')
                .map(d => d.trim().replace(/['"]/g, ''))
                .filter(d => d.length > 0);

            dependencies.push(...deps);
        }

        return dependencies;
    }

    private parseCatalogConfig(content: string): any {
        // Parse básico do catalog
        return {};
    }

    private parseLocalsConfig(content: string): any {
        // Parse básico dos locals
        return {};
    }
}
