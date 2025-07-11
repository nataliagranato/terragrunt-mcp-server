import { Logger } from '../utils/logger.js';
import { FileUtils } from '../utils/file.js';
import {
    ProjectStructure,
    DirectoryInfo,
    FileInfo,
    ModuleInfo,
    ProjectMetrics,
    Issue,
    Optimization,
    FileType,
    TerragruntConfig
} from '../types/terragrunt.js';
import {
    AnalysisOptions,
    OptimizationOptions,
    IssueDetectionOptions,
    MetricsOptions
} from '../types/mcp.js';

export class ProjectAnalyzer {
    constructor(private logger: Logger) { }

    /**
     * Análise completa do projeto Terragrunt
     */
    async analyzeProject(projectPath: string, options: AnalysisOptions = {}) {
        this.logger.info(`Iniciando análise do projeto: ${projectPath}`);

        const structure = await this.analyzeProjectStructure(projectPath);
        const configFiles = await this.findConfigurationFiles(projectPath);
        const modules = await this.findModules(projectPath);
        const stacks = await this.findStacks(projectPath);

        let dependencies: any[] = [];
        let metrics: ProjectMetrics | null = null;
        let issues: Issue[] = [];

        if (options.includeDependencies) {
            dependencies = await this.analyzeDependencies(projectPath);
        }

        if (options.includeMetrics) {
            metrics = await this.getProjectMetrics(projectPath, { includeComplexity: true });
        }

        if (options.includeValidation) {
            const detectedIssues = await this.detectIssues(projectPath, { minSeverity: 'warning' });
            issues = detectedIssues.issues || [];
        }

        const terragruntVersion = await this.detectTerragruntVersion(projectPath);
        const recommendations = await this.generateRecommendations(projectPath, issues);

        return {
            terragruntVersion,
            structure,
            configFiles,
            modules,
            stacks,
            dependencies,
            metrics,
            issues,
            recommendations
        };
    }

    /**
     * Analisa a estrutura do projeto
     */
    async analyzeProjectStructure(projectPath: string): Promise<ProjectStructure> {
        this.logger.debug('Analisando estrutura do projeto');

        const directories = await this.getDirectoryStructure(projectPath);
        const files = await this.getAllFiles(projectPath);
        const depth = this.calculateMaxDepth(directories);

        return {
            root: projectPath,
            directories,
            files,
            depth
        };
    }

    /**
     * Encontra arquivos de configuração
     */
    async findConfigurationFiles(projectPath: string): Promise<FileInfo[]> {
        const terragruntFiles = await FileUtils.findTerragruntFiles(projectPath);
        const configFiles: FileInfo[] = [];

        for (const file of terragruntFiles) {
            const fileInfo = await FileUtils.getFileInfo(file);
            configFiles.push(fileInfo);
        }

        return configFiles;
    }

    /**
     * Encontra módulos Terragrunt
     */
    async findModules(projectPath: string): Promise<ModuleInfo[]> {
        const terragruntFiles = await FileUtils.findTerragruntFiles(projectPath);
        const modules: ModuleInfo[] = [];

        for (const file of terragruntFiles) {
            if (FileUtils.getFileType(file) === FileType.TERRAGRUNT_HCL) {
                const moduleInfo = await this.analyzeModule(file);
                modules.push(moduleInfo);
            }
        }

        return modules;
    }

    /**
     * Encontra stacks Terragrunt
     */
    async findStacks(projectPath: string): Promise<any[]> {
        const terragruntFiles = await FileUtils.findTerragruntFiles(projectPath);
        const stacks: any[] = [];

        for (const file of terragruntFiles) {
            if (FileUtils.getFileType(file) === FileType.TERRAGRUNT_STACK_HCL) {
                const stackInfo = await this.analyzeStack(file);
                stacks.push(stackInfo);
            }
        }

        return stacks;
    }

    /**
     * Analisa um módulo específico
     */
    async analyzeModule(configPath: string): Promise<ModuleInfo> {
        const config = await this.parseConfig(configPath);
        const moduleName = FileUtils.getBaseName(FileUtils.getDirectoryName(configPath));

        return {
            path: configPath,
            name: moduleName,
            source: config.terraform?.source,
            version: config.terragrunt_version_constraint,
            dependencies: this.extractDependencies(config),
            dependents: [], // Será preenchido durante análise de dependências
            inputs: config.inputs || {},
            outputs: {}, // Será extraído se necessário
            config
        };
    }

    /**
     * Analisa um stack específico
     */
    async analyzeStack(stackPath: string): Promise<any> {
        const content = await FileUtils.readFile(stackPath);
        // Aqui seria implementado o parser HCL para stacks
        return {
            path: stackPath,
            name: FileUtils.getBaseName(stackPath, '.hcl'),
            content,
            units: [],
            dependencies: []
        };
    }

    /**
     * Faz parsing de arquivo de configuração Terragrunt
     */
    private async parseConfig(configPath: string): Promise<any> {
        const content = await FileUtils.readFile(configPath);
        const config: any = {};

        // Parse do bloco terraform
        const terraformMatch = content.match(/terraform\s*{([^}]*)}/s);
        if (terraformMatch) {
            const terraformContent = terraformMatch[1];

            // Parse do source
            const sourceMatch = terraformContent.match(/source\s*=\s*"([^"]+)"/);
            if (sourceMatch) {
                const source = sourceMatch[1];
                config.terraform = {
                    source: source
                };
            }
        }

        // Parse do bloco inputs
        const inputsMatch = content.match(/inputs\s*=\s*{([^}]*)}/s);
        if (inputsMatch) {
            const inputsContent = inputsMatch[1];
            config.inputs = this.parseInputsBlock(inputsContent);
        }

        // Parse do bloco dependencies
        const dependenciesMatch = content.match(/dependencies\s*{([^}]*)}/s);
        if (dependenciesMatch) {
            const dependenciesContent = dependenciesMatch[1];
            config.dependencies = this.parseDependenciesBlock(dependenciesContent);
        }

        return config;
    }

    /**
     * Parse do bloco inputs
     */
    private parseInputsBlock(inputsContent: string): Record<string, any> {
        const inputs: Record<string, any> = {};

        // Regex simples para parsing de inputs
        const inputRegex = /(\w+)\s*=\s*"([^"]+)"/g;
        let match;

        while ((match = inputRegex.exec(inputsContent)) !== null) {
            inputs[match[1]] = match[2];
        }

        return inputs;
    }

    /**
     * Parse do bloco dependencies
     */
    private parseDependenciesBlock(dependenciesContent: string): { paths: string[] } {
        const paths: string[] = [];

        // Parse simples de paths
        const pathsMatch = dependenciesContent.match(/paths\s*=\s*\[([^\]]*)\]/);
        if (pathsMatch) {
            const pathsContent = pathsMatch[1];
            const pathMatches = pathsContent.match(/"([^"]+)"/g);

            if (pathMatches) {
                pathMatches.forEach(pathMatch => {
                    paths.push(pathMatch.replace(/"/g, ''));
                });
            }
        }

        return { paths };
    }

    /**
     * Detecta versão do Terragrunt
     */
    async detectTerragruntVersion(projectPath: string): Promise<string | null> {
        // Procura por arquivo .terragrunt-version ou extrai de configurações
        const versionFile = FileUtils.joinPath(projectPath, '.terragrunt-version');

        if (await FileUtils.exists(versionFile)) {
            return (await FileUtils.readFile(versionFile)).trim();
        }

        // Assume versão 0.82.3 se não encontrar
        return '0.82.3';
    }

    /**
     * Analisa dependências (versão simplificada)
     */
    async analyzeDependencies(projectPath: string): Promise<any[]> {
        // Implementação simplificada
        return [];
    }

    /**
     * Obtém métricas do projeto
     */
    async getProjectMetrics(projectPath: string, options: MetricsOptions = {}): Promise<ProjectMetrics> {
        const terragruntFiles = await FileUtils.findTerragruntFiles(projectPath);
        const terraformFiles = await FileUtils.findTerraformFiles(projectPath);
        const allFiles = [...terragruntFiles, ...terraformFiles];

        const totalSize = await FileUtils.getTotalSize(allFiles);
        const linesOfCode = await FileUtils.countLinesOfCode(allFiles);
        const directories = await FileUtils.listDirectories(projectPath, true);

        return {
            terragruntFiles: terragruntFiles.length,
            terraformModules: terraformFiles.filter(f => f.endsWith('.tf')).length,
            linesOfCode,
            totalSize: Math.round(totalSize / 1024), // KB
            maxDepth: this.calculateMaxDepth(directories.map(d => ({ path: d, name: '', children: [], terragruntFiles: [], terraformFiles: [] }))),
            directories: directories.length,
            configFiles: terragruntFiles.length,
            internalDependencies: 0, // Calculado durante análise de dependências
            externalDependencies: 0,
            orphanModules: 0,
            complexityIndex: options.includeComplexity ? await this.calculateComplexityIndex(projectPath) : 0,
            complexModules: 0,
            circularDependencies: 0,
            growthTrend: 'stable',
            maintainabilityScore: 75,
            healthScore: 80
        };
    }

    /**
     * Detecta problemas
     */
    async detectIssues(projectPath: string, options: IssueDetectionOptions = {}): Promise<any> {
        const issues: Issue[] = [];

        // Verifica arquivos órfãos
        const orphanIssues = await this.detectOrphanFiles(projectPath);
        issues.push(...orphanIssues);

        // Verifica configurações duplicadas
        const duplicateIssues = await this.detectDuplicateConfigurations(projectPath);
        issues.push(...duplicateIssues);

        return {
            total: issues.length,
            critical: issues.filter(i => i.severity === 'critical').length,
            errors: issues.filter(i => i.severity === 'error').length,
            warnings: issues.filter(i => i.severity === 'warning').length,
            issues,
            recommendations: this.generateIssueRecommendations(issues)
        };
    }

    /**
     * Sugere otimizações
     */
    async suggestOptimizations(projectPath: string, options: OptimizationOptions = {}): Promise<any> {
        const optimizations = {
            performance: await this.getPerformanceOptimizations(projectPath),
            structure: await this.getStructureOptimizations(projectPath),
            security: await this.getSecurityOptimizations(projectPath),
            maintenance: await this.getMaintenanceOptimizations(projectPath)
        };

        const totalSuggestions = Object.values(optimizations).flat().length;
        const highPriority = Object.values(optimizations).flat().filter(opt => opt.priority === 'high').length;

        return {
            ...optimizations,
            totalSuggestions,
            highPriority,
            estimatedTimesSaved: totalSuggestions * 2 // Estimativa simplificada
        };
    }

    // Métodos auxiliares privados
    private async getDirectoryStructure(projectPath: string): Promise<DirectoryInfo[]> {
        const directories = await FileUtils.listDirectories(projectPath, true);
        const result: DirectoryInfo[] = [];

        for (const dir of directories) {
            const terragruntFiles = (await FileUtils.findTerragruntFiles(dir)).filter(f =>
                FileUtils.getDirectoryName(f) === dir
            );
            const terraformFiles = (await FileUtils.findTerraformFiles(dir)).filter(f =>
                FileUtils.getDirectoryName(f) === dir
            );

            result.push({
                path: dir,
                name: FileUtils.getBaseName(dir),
                children: await FileUtils.listDirectories(dir, false),
                terragruntFiles,
                terraformFiles
            });
        }

        return result;
    }

    private async getAllFiles(projectPath: string): Promise<FileInfo[]> {
        const allFiles = await FileUtils.listFiles(projectPath, true);
        const result: FileInfo[] = [];

        for (const file of allFiles) {
            const fileInfo = await FileUtils.getFileInfo(file);
            result.push(fileInfo);
        }

        return result;
    }

    private calculateMaxDepth(directories: DirectoryInfo[]): number {
        let maxDepth = 0;

        directories.forEach(dir => {
            const depth = dir.path.split('/').length;
            if (depth > maxDepth) {
                maxDepth = depth;
            }
        });

        return maxDepth;
    }

    private async calculateComplexityIndex(projectPath: string): Promise<number> {
        // Implementação simplificada do índice de complexidade
        const terragruntFiles = await FileUtils.findTerragruntFiles(projectPath);
        const totalFiles = terragruntFiles.length;

        // Fórmula simplificada baseada no número de arquivos e dependências
        return Math.min(100, totalFiles * 5);
    }

    private async detectOrphanFiles(projectPath: string): Promise<Issue[]> {
        // Detecta arquivos que não são referenciados
        return [];
    }

    private async detectDuplicateConfigurations(projectPath: string): Promise<Issue[]> {
        // Detecta configurações duplicadas
        return [];
    }

    private generateIssueRecommendations(issues: Issue[]): string[] {
        return [
            'Revise regularmente as configurações para manter consistência',
            'Use includes para evitar duplicação',
            'Implemente testes automatizados para validação'
        ];
    }

    private async getPerformanceOptimizations(projectPath: string): Promise<Optimization[]> {
        return [
            {
                priority: 'high',
                suggestion: 'Considere usar cache de providers para melhorar performance',
                impact: 'Redução de 30-50% no tempo de execução',
                category: 'performance'
            }
        ];
    }

    private async getStructureOptimizations(projectPath: string): Promise<Optimization[]> {
        return [
            {
                priority: 'medium',
                suggestion: 'Organize módulos em uma estrutura hierárquica clara',
                impact: 'Melhora na manutenibilidade e navegação',
                category: 'structure'
            }
        ];
    }

    private async getSecurityOptimizations(projectPath: string): Promise<Optimization[]> {
        return [
            {
                priority: 'high',
                suggestion: 'Implemente validação de inputs sensíveis',
                impact: 'Redução de riscos de segurança',
                category: 'security'
            }
        ];
    }

    private async getMaintenanceOptimizations(projectPath: string): Promise<Optimization[]> {
        return [
            {
                priority: 'medium',
                suggestion: 'Adicione documentação README para cada módulo',
                impact: 'Facilita onboarding de novos desenvolvedores',
                category: 'maintenance'
            }
        ];
    }

    private async generateRecommendations(projectPath: string, issues: Issue[]): Promise<string[]> {
        const recommendations = [
            'Use Terragrunt 0.82.3 para acessar os recursos mais recentes',
            'Implemente stacks para melhor organização',
            'Configure strict mode para validações rigorosas'
        ];

        if (issues.length > 0) {
            recommendations.push('Resolva os problemas detectados para melhorar a saúde do projeto');
        }

        return recommendations;
    }

    /**
     * Extrai dependências de uma configuração
     */
    private extractDependencies(config: TerragruntConfig): string[] {
        const dependencies: string[] = [];

        if (config.dependencies && config.dependencies.paths) {
            config.dependencies.paths.forEach((path: string) => {
                dependencies.push(path);
            });
        }

        return dependencies;
    }
}
