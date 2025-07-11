// Tipos específicos para o protocolo MCP
export interface AnalyzeProjectArgs {
    projectPath: string;
    includeMetrics?: boolean;
}

export interface ValidateConfigArgs {
    configPath: string;
    strictMode?: boolean;
}

export interface GetDependenciesArgs {
    projectPath: string;
    outputFormat?: 'json' | 'graph' | 'tree' | 'list';
}

export interface CheckStackStructureArgs {
    stackPath: string;
    validateUnits?: boolean;
}

export interface SuggestOptimizationsArgs {
    projectPath: string;
    categories?: ('performance' | 'structure' | 'security' | 'maintenance')[];
}

export interface DetectIssuesArgs {
    projectPath: string;
    severity?: 'all' | 'error' | 'warning' | 'info';
}

export interface GetProjectMetricsArgs {
    projectPath: string;
    includeComplexity?: boolean;
}

export interface FindUnusedModulesArgs {
    projectPath: string;
    includeTransitive?: boolean;
}

// Tipos de resposta específicos para MCP
export interface MCPToolResponse {
    content: Array<{
        type: string;
        text: string;
    }>;
}

// Configurações para análise
export interface AnalysisOptions {
    includeMetrics?: boolean;
    includeValidation?: boolean;
    includeDependencies?: boolean;
    includeStacks?: boolean;
}

export interface ValidationOptions {
    strictMode?: boolean;
    terragruntVersion?: string;
}

export interface DependencyAnalysisOptions {
    includeTransitive?: boolean;
    maxDepth?: number;
}

export interface StackAnalysisOptions {
    validateUnits?: boolean;
    checkDependencies?: boolean;
}

export interface OptimizationOptions {
    categories?: string[];
    priorityFilter?: 'high' | 'medium' | 'low';
}

export interface IssueDetectionOptions {
    minSeverity?: string;
    includeWarnings?: boolean;
}

export interface MetricsOptions {
    includeComplexity?: boolean;
    includeGitMetrics?: boolean;
}

export interface UnusedModulesOptions {
    includeTransitive?: boolean;
    excludePatterns?: string[];
}
