// Tipos específicos para Terragrunt 0.82.3
export interface TerragruntConfig {
    terraform?: {
        source?: string;
        extra_arguments?: ExtraArgument[];
        before_hook?: Hook[];
        after_hook?: Hook[];
    };
    remote_state?: RemoteState;
    dependencies?: {
        paths: string[];
    };
    dependency?: Record<string, Dependency>;
    inputs?: Record<string, any>;
    locals?: Record<string, any>;
    include?: Include[];
    generate?: Record<string, Generate>;
    prevent_destroy?: boolean;
    skip?: boolean;
    iam_role?: string;
    download_dir?: string;
    terraform_version_constraint?: string;
    terragrunt_version_constraint?: string;
    retryable_errors?: string[];
    retry_max_attempts?: number;
    retry_sleep_interval_sec?: number;
    catalog?: CatalogConfig;
    engine?: EngineConfig;
    feature?: FeatureConfig;
    stack?: StackReference;
    unit?: UnitConfig;
}

export interface TerragruntStackConfig {
    unit?: Record<string, StackUnit>;
    stack?: Record<string, StackDefinition>;
    catalog?: CatalogConfig;
    locals?: Record<string, any>;
    dependencies?: {
        paths: string[];
    };
}

export interface StackUnit {
    source: string;
    name?: string;
    inputs?: Record<string, any>;
    dependencies?: string[];
    skip?: boolean;
    prevent_destroy?: boolean;
}

export interface StackDefinition {
    description?: string;
    units: Record<string, StackUnit>;
    dependencies?: string[];
}

export interface ExtraArgument {
    name: string;
    commands: string[];
    arguments?: string[];
    env_vars?: Record<string, string>;
    required_var_files?: string[];
    optional_var_files?: string[];
}

export interface Hook {
    name: string;
    commands: string[];
    execute: string[];
    run_on_error?: boolean;
    working_dir?: string;
}

export interface RemoteState {
    backend: string;
    config: Record<string, any>;
    generate?: {
        path: string;
        if_exists: string;
    };
    disable_init?: boolean;
    disable_dependency_optimization?: boolean;
}

export interface Dependency {
    config_path: string;
    mock_outputs?: Record<string, any>;
    mock_outputs_allowed_terraform_commands?: string[];
    mock_outputs_merge_strategy_with_state?: string;
    mock_outputs_merge_with_state?: boolean;
    skip_outputs?: boolean;
    enabled?: boolean;
}

export interface Include {
    path: string;
    name?: string;
    expose?: boolean;
    merge_strategy?: string;
}

export interface Generate {
    path: string;
    if_exists: string;
    contents: string;
    comment_prefix?: string;
    disable_signature?: boolean;
}

export interface CatalogConfig {
    urls?: string[];
    repositories?: CatalogRepository[];
}

export interface CatalogRepository {
    name: string;
    url: string;
    ref?: string;
    path?: string;
}

export interface EngineConfig {
    type: string;
    source?: string;
    version?: string;
    meta?: Record<string, any>;
}

export interface FeatureConfig {
    [key: string]: boolean | Record<string, any>;
}

export interface StackReference {
    name: string;
    path?: string;
}

export interface UnitConfig {
    name: string;
    source: string;
    version?: string;
}

// Tipos para análise e resultados
export interface ProjectStructure {
    root: string;
    directories: DirectoryInfo[];
    files: FileInfo[];
    depth: number;
}

export interface DirectoryInfo {
    path: string;
    name: string;
    children: string[];
    terragruntFiles: string[];
    terraformFiles: string[];
}

export interface FileInfo {
    path: string;
    name: string;
    type: FileType;
    size: number;
    lastModified: Date;
}

export enum FileType {
    TERRAGRUNT_HCL = 'terragrunt.hcl',
    TERRAGRUNT_STACK_HCL = 'terragrunt.stack.hcl',
    TERRAFORM_TF = 'terraform.tf',
    TERRAFORM_TFVARS = 'terraform.tfvars',
    README = 'README.md',
    OTHER = 'other'
}

export interface ModuleInfo {
    path: string;
    name: string;
    source?: string;
    version?: string;
    dependencies: string[];
    dependents: string[];
    inputs: Record<string, any>;
    outputs: Record<string, any>;
    config: TerragruntConfig;
}

export interface DependencyGraph {
    modules: ModuleInfo[];
    edges: DependencyEdge[];
    circularDependencies: string[][];
    orphanedModules: string[];
}

export interface DependencyEdge {
    from: string;
    to: string;
    type: DependencyType;
}

export enum DependencyType {
    DIRECT = 'direct',
    TRANSITIVE = 'transitive',
    STACK = 'stack'
}

export interface ValidationResult {
    isValid: boolean;
    configType: string;
    schemaVersion: string;
    blocks: string[];
    errors: ValidationError[];
    warnings: ValidationWarning[];
    suggestions: ValidationSuggestion[];
}

export interface ValidationError {
    severity: 'error' | 'critical';
    message: string;
    line?: number;
    column?: number;
    code?: string;
}

export interface ValidationWarning {
    message: string;
    line?: number;
    column?: number;
    code?: string;
}

export interface ValidationSuggestion {
    message: string;
    line?: number;
    column?: number;
    code?: string;
}

export interface ProjectMetrics {
    terragruntFiles: number;
    terraformModules: number;
    linesOfCode: number;
    totalSize: number;
    maxDepth: number;
    directories: number;
    configFiles: number;
    internalDependencies: number;
    externalDependencies: number;
    orphanModules: number;
    complexityIndex: number;
    complexModules: number;
    circularDependencies: number;
    growthTrend: string;
    maintainabilityScore: number;
    healthScore: number;
}

export interface Issue {
    type: string;
    severity: 'critical' | 'error' | 'warning' | 'info';
    message: string;
    location: string;
    solution: string;
    impact?: string;
}

export interface Optimization {
    priority: 'high' | 'medium' | 'low';
    suggestion: string;
    impact: string;
    category: 'performance' | 'structure' | 'security' | 'maintenance';
    estimatedTimesSaved?: number;
}
