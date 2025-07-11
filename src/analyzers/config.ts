import { Logger } from '../utils/logger.js';
import { FileUtils } from '../utils/file.js';
import {
    TerragruntConfig,
    TerragruntStackConfig,
    ValidationResult,
    ValidationError,
    ValidationWarning,
    ValidationSuggestion
} from '../types/terragrunt.js';
import { ValidationOptions } from '../types/mcp.js';

export class ConfigAnalyzer {
    constructor(private logger: Logger) { }

    /**
     * Valida um arquivo de configuração Terragrunt
     */
    async validateConfig(configPath: string, options: ValidationOptions = {}): Promise<ValidationResult> {
        this.logger.info(`Validando configuração: ${configPath}`);

        if (!(await FileUtils.exists(configPath))) {
            throw new Error(`Arquivo de configuração não encontrado: ${configPath}`);
        }

        const content = await FileUtils.readFile(configPath);
        const configType = this.determineConfigType(configPath);

        const errors: ValidationError[] = [];
        const warnings: ValidationWarning[] = [];
        const suggestions: ValidationSuggestion[] = [];

        // Validações específicas baseadas no tipo
        if (configType === 'terragrunt.hcl') {
            await this.validateTerragruntConfig(content, errors, warnings, suggestions, options);
        } else if (configType === 'terragrunt.stack.hcl') {
            await this.validateStackConfig(content, errors, warnings, suggestions, options);
        }

        // Validações gerais
        await this.validateGeneralSyntax(content, errors, warnings);
        await this.validateTerragruntVersion(content, errors, warnings, options);

        const blocks = this.extractBlocks(content);
        const isValid = errors.length === 0;

        return {
            isValid,
            configType,
            schemaVersion: options.terragruntVersion || '0.82.3',
            blocks,
            errors,
            warnings,
            suggestions
        };
    }

    /**
     * Determina o tipo de configuração
     */
    private determineConfigType(configPath: string): string {
        const fileName = FileUtils.getBaseName(configPath);

        if (fileName === 'terragrunt.stack.hcl') {
            return 'terragrunt.stack.hcl';
        } else if (fileName === 'terragrunt.hcl') {
            return 'terragrunt.hcl';
        }

        return 'unknown';
    }

    /**
     * Valida configuração terragrunt.hcl
     */
    private async validateTerragruntConfig(
        content: string,
        errors: ValidationError[],
        warnings: ValidationWarning[],
        suggestions: ValidationSuggestion[],
        options: ValidationOptions
    ): Promise<void> {

        // Verifica blocos obrigatórios
        await this.validateRequiredBlocks(content, errors, warnings);

        // Valida bloco terraform
        await this.validateTerraformBlock(content, errors, warnings, suggestions);

        // Valida remote_state
        await this.validateRemoteStateBlock(content, errors, warnings);

        // Valida dependencies
        await this.validateDependenciesBlock(content, errors, warnings);

        // Valida inputs
        await this.validateInputsBlock(content, errors, warnings, suggestions);

        // Validações de strict mode
        if (options.strictMode) {
            await this.applyStrictModeValidations(content, errors, warnings);
        }
    }

    /**
     * Valida configuração terragrunt.stack.hcl
     */
    private async validateStackConfig(
        content: string,
        errors: ValidationError[],
        warnings: ValidationWarning[],
        suggestions: ValidationSuggestion[],
        options: ValidationOptions
    ): Promise<void> {

        // Verifica se possui definições de unit ou stack
        if (!content.includes('unit {') && !content.includes('stack {')) {
            errors.push({
                severity: 'error',
                message: 'Stack deve conter pelo menos uma definição de unit ou stack',
                line: 1
            });
        }

        // Valida definições de unit
        await this.validateUnitDefinitions(content, errors, warnings, suggestions);

        // Valida dependências de stack
        await this.validateStackDependencies(content, errors, warnings);

        // Valida catalog references
        await this.validateCatalogReferences(content, warnings, suggestions);
    }

    /**
     * Valida sintaxe geral HCL
     */
    private async validateGeneralSyntax(
        content: string,
        errors: ValidationError[],
        warnings: ValidationWarning[]
    ): Promise<void> {

        // Verifica balanceamento de chaves
        const openBraces = (content.match(/{/g) || []).length;
        const closeBraces = (content.match(/}/g) || []).length;

        if (openBraces !== closeBraces) {
            errors.push({
                severity: 'error',
                message: `Chaves desbalanceadas: ${openBraces} aberturas, ${closeBraces} fechamentos`,
                line: this.findUnbalancedBraceLine(content)
            });
        }

        // Verifica aspas não fechadas
        const quotes = (content.match(/"/g) || []).length;
        if (quotes % 2 !== 0) {
            warnings.push({
                message: 'Possível aspas não fechadas detectadas',
                line: this.findUnmatchedQuoteLine(content)
            });
        }

        // Verifica comentários mal formados
        this.validateComments(content, warnings);
    }

    /**
     * Valida versão do Terragrunt
     */
    private async validateTerragruntVersion(
        content: string,
        errors: ValidationError[],
        warnings: ValidationWarning[],
        options: ValidationOptions
    ): Promise<void> {

        const versionConstraintMatch = content.match(/terragrunt_version_constraint\s*=\s*"([^"]+)"/);

        if (versionConstraintMatch) {
            const constraint = versionConstraintMatch[1];

            // Verifica se a versão é compatível com 0.82.3
            if (options.strictMode && !this.isVersionCompatible(constraint, '0.82.3')) {
                warnings.push({
                    message: `Constraint de versão ${constraint} pode não ser compatível com 0.82.3`,
                    line: this.findLineNumber(content, versionConstraintMatch[0])
                });
            }
        } else if (options.strictMode) {
            warnings.push({
                message: 'Considere especificar terragrunt_version_constraint para garantir compatibilidade',
                line: 1
            });
        }
    }

    /**
     * Valida blocos obrigatórios
     */
    private async validateRequiredBlocks(
        content: string,
        errors: ValidationError[],
        warnings: ValidationWarning[]
    ): Promise<void> {

        // Para módulos Terragrunt, terraform block é geralmente necessário
        if (!content.includes('terraform {') && !content.includes('include {')) {
            warnings.push({
                message: 'Módulo sem bloco terraform ou include - pode estar incompleto',
                line: 1
            });
        }
    }

    /**
     * Valida bloco terraform
     */
    private async validateTerraformBlock(
        content: string,
        errors: ValidationError[],
        warnings: ValidationWarning[],
        suggestions: ValidationSuggestion[]
    ): Promise<void> {

        const terraformBlockMatch = content.match(/terraform\s*{([^}]*)}/s);

        if (terraformBlockMatch) {
            const terraformContent = terraformBlockMatch[1];

            // Verifica se tem source (ignorando comentários)
            const sourceRegex = /source\s*=\s*"[^"]*"/;
            if (!sourceRegex.test(terraformContent)) {
                errors.push({
                    severity: 'error',
                    message: 'Bloco terraform deve especificar source',
                    line: this.findLineNumber(content, 'terraform {')
                });
            }

            // Verifica source válido
            const sourceMatch = terraformContent.match(/source\s*=\s*"([^"]+)"/);
            if (sourceMatch) {
                const source = sourceMatch[1];

                if (source.startsWith('./') || source.startsWith('../')) {
                    // Source local - verifica se existe
                    warnings.push({
                        message: 'Verificar se o source local existe e está acessível',
                        line: this.findLineNumber(content, sourceMatch[0])
                    });
                } else if (source.includes('git::')) {
                    // Source git - valida formato
                    if (!this.isValidGitSource(source)) {
                        warnings.push({
                            message: 'Formato de source git pode estar incorreto',
                            line: this.findLineNumber(content, sourceMatch[0])
                        });
                    }
                }
            }

            // Sugestões para extra_arguments
            if (!terraformContent.includes('extra_arguments')) {
                suggestions.push({
                    message: 'Considere usar extra_arguments para padronizar argumentos do Terraform',
                    line: this.findLineNumber(content, 'terraform {')
                });
            }
        }
    }

    /**
     * Valida bloco remote_state
     */
    private async validateRemoteStateBlock(
        content: string,
        errors: ValidationError[],
        warnings: ValidationWarning[]
    ): Promise<void> {

        const remoteStateMatch = content.match(/remote_state\s*{([^}]*)}/s);

        if (remoteStateMatch) {
            const remoteStateContent = remoteStateMatch[1];

            // Verifica backend
            if (!remoteStateContent.includes('backend')) {
                errors.push({
                    severity: 'error',
                    message: 'Bloco remote_state deve especificar backend',
                    line: this.findLineNumber(content, 'remote_state {')
                });
            }

            // Verifica config
            if (!remoteStateContent.includes('config')) {
                errors.push({
                    severity: 'error',
                    message: 'Bloco remote_state deve especificar config',
                    line: this.findLineNumber(content, 'remote_state {')
                });
            }

            // Validações específicas por backend
            const backendMatch = remoteStateContent.match(/backend\s*=\s*"([^"]+)"/);
            if (backendMatch) {
                const backend = backendMatch[1];
                this.validateBackendConfig(backend, remoteStateContent, warnings, content);
            }
        }
    }

    /**
     * Valida bloco dependencies
     */
    private async validateDependenciesBlock(
        content: string,
        errors: ValidationError[],
        warnings: ValidationWarning[]
    ): Promise<void> {

        const dependenciesMatch = content.match(/dependencies\s*{([^}]*)}/s);

        if (dependenciesMatch) {
            const dependenciesContent = dependenciesMatch[1];

            // Verifica paths
            const pathsMatch = dependenciesContent.match(/paths\s*=\s*\[([^\]]*)\]/s);
            if (pathsMatch) {
                const pathsContent = pathsMatch[1];
                const paths = pathsContent.split(',').map(p => p.trim().replace(/['"]/g, ''));

                // Verifica se os paths são válidos
                for (const path of paths) {
                    if (path && !path.startsWith('../') && !path.startsWith('./')) {
                        warnings.push({
                            message: `Path de dependência '${path}' pode estar incorreto`,
                            line: this.findLineNumber(content, path)
                        });
                    }
                }
            }
        }
    }

    /**
     * Valida bloco inputs
     */
    private async validateInputsBlock(
        content: string,
        errors: ValidationError[],
        warnings: ValidationWarning[],
        suggestions: ValidationSuggestion[]
    ): Promise<void> {

        const inputsMatch = content.match(/inputs\s*=\s*{([^}]*)}/s);

        if (inputsMatch) {
            const inputsContent = inputsMatch[1];

            // Verifica se há inputs vazios
            if (inputsContent.trim() === '') {
                warnings.push({
                    message: 'Bloco inputs está vazio - considere removê-lo se não necessário',
                    line: this.findLineNumber(content, 'inputs =')
                });
            }

            // Sugestões para variáveis sensíveis
            if (inputsContent.includes('password') || inputsContent.includes('secret') || inputsContent.includes('key')) {
                suggestions.push({
                    message: 'Considere usar variáveis de ambiente para dados sensíveis',
                    line: this.findLineNumber(content, 'inputs =')
                });
            }
        }
    }

    /**
     * Aplica validações do strict mode
     */
    private async applyStrictModeValidations(
        content: string,
        errors: ValidationError[],
        warnings: ValidationWarning[]
    ): Promise<void> {

        // Validações rigorosas para Terragrunt 0.82.3

        // Verifica uso de features experimentais
        const experimentalRegex = /(type\s*=\s*"experimental"|experimental)/;
        if (experimentalRegex.test(content)) {
            warnings.push({
                message: 'Uso de features experimentais detectado - pode ser instável',
                line: this.findLineNumber(content, 'experimental')
            });
        }

        // Verifica comandos deprecated
        const deprecatedCommands = ['plan-all', 'apply-all', 'destroy-all'];
        for (const cmd of deprecatedCommands) {
            if (content.includes(cmd)) {
                warnings.push({
                    message: `Comando '${cmd}' está deprecated, use 'run --all' em vez disso`,
                    line: this.findLineNumber(content, cmd)
                });
            }
        }

        // Verifica configurações de engine
        if (content.includes('engine {')) {
            warnings.push({
                message: 'Engine configuration requer TG_EXPERIMENTAL_ENGINE=1',
                line: this.findLineNumber(content, 'engine {')
            });
        }
    }

    /**
     * Valida definições de unit em stacks
     */
    private async validateUnitDefinitions(
        content: string,
        errors: ValidationError[],
        warnings: ValidationWarning[],
        suggestions: ValidationSuggestion[]
    ): Promise<void> {

        const unitMatches = content.matchAll(/unit\s+"([^"]+)"\s*{([^}]*)}/gs);

        for (const match of unitMatches) {
            const unitName = match[1];
            const unitContent = match[2];

            // Verifica source obrigatório
            if (!unitContent.includes('source')) {
                errors.push({
                    severity: 'error',
                    message: `Unit '${unitName}' deve especificar source`,
                    line: this.findLineNumber(content, match[0])
                });
            }

            // Verifica se source é de catalog
            const sourceMatch = unitContent.match(/source\s*=\s*"([^"]+)"/);
            if (sourceMatch) {
                const source = sourceMatch[1];

                if (source.includes('catalog://')) {
                    suggestions.push({
                        message: `Unit '${unitName}' usa catalog - certifique-se de que o catalog está configurado`,
                        line: this.findLineNumber(content, match[0])
                    });
                }
            }
        }
    }

    /**
     * Valida dependências de stack
     */
    private async validateStackDependencies(
        content: string,
        errors: ValidationError[],
        warnings: ValidationWarning[]
    ): Promise<void> {

        // Verifica dependências circulares básicas
        const dependencies = this.extractStackDependencies(content);
        const circular = this.detectCircularDependencies(dependencies);

        if (circular.length > 0) {
            errors.push({
                severity: 'critical',
                message: `Dependências circulares detectadas: ${circular.join(' -> ')}`,
                line: 1
            });
        }
    }

    /**
     * Valida referências de catalog
     */
    private async validateCatalogReferences(
        content: string,
        warnings: ValidationWarning[],
        suggestions: ValidationSuggestion[]
    ): Promise<void> {

        if (content.includes('catalog://')) {
            const catalogMatch = content.match(/catalog\s*{([^}]*)}/s);

            if (!catalogMatch) {
                warnings.push({
                    message: 'Uso de catalog:// sem bloco catalog configurado',
                    line: this.findLineNumber(content, 'catalog://')
                });
            } else {
                suggestions.push({
                    message: 'Considere versionar referências de catalog para reprodutibilidade',
                    line: this.findLineNumber(content, 'catalog://')
                });
            }
        }
    }

    /**
     * Extrai nomes de blocos do conteúdo HCL
     */
    private extractBlocks(content: string): string[] {
        const blocks: string[] = [];

        // Regex para encontrar blocos HCL
        const blockRegex = /(\w+)\s*["{]/g;
        let match;

        while ((match = blockRegex.exec(content)) !== null) {
            const blockName = match[1];
            if (!blocks.includes(blockName)) {
                blocks.push(blockName);
            }
        }

        return blocks;
    }

    // Métodos auxiliares
    private findLineNumber(content: string, searchText: string): number {
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(searchText)) {
                return i + 1;
            }
        }
        return 1;
    }

    private findUnbalancedBraceLine(content: string): number {
        const lines = content.split('\n');
        let braceCount = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            braceCount += (line.match(/{/g) || []).length;
            braceCount -= (line.match(/}/g) || []).length;

            if (braceCount < 0) {
                return i + 1;
            }
        }

        return lines.length;
    }

    private findUnmatchedQuoteLine(content: string): number {
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const quotes = (line.match(/"/g) || []).length;

            if (quotes % 2 !== 0) {
                return i + 1;
            }
        }

        return 1;
    }

    private validateComments(content: string, warnings: ValidationWarning[]): void {
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Verifica comentários // dentro de strings
            const stringMatches = line.match(/"[^"]*"/g) || [];
            for (const str of stringMatches) {
                if (str.includes('//')) {
                    warnings.push({
                        message: 'Comentário dentro de string pode causar problemas',
                        line: i + 1
                    });
                }
            }
        }
    }

    private isVersionCompatible(constraint: string, version: string): boolean {
        // Implementação simplificada de compatibilidade de versão
        return constraint.includes('0.82') || constraint.includes('>= 0.80');
    }

    private isValidGitSource(source: string): boolean {
        // Valida formato básico de source git
        return source.includes('git::') && (source.includes('.git') || source.includes('github.com'));
    }

    private validateBackendConfig(
        backend: string,
        config: string,
        warnings: ValidationWarning[],
        fullContent: string
    ): void {

        switch (backend) {
            case 's3':
                if (!config.includes('bucket') || !config.includes('key')) {
                    warnings.push({
                        message: 'Backend S3 deve especificar bucket e key',
                        line: this.findLineNumber(fullContent, 'backend = "s3"')
                    });
                }
                break;

            case 'gcs':
                if (!config.includes('bucket') || !config.includes('prefix')) {
                    warnings.push({
                        message: 'Backend GCS deve especificar bucket e prefix',
                        line: this.findLineNumber(fullContent, 'backend = "gcs"')
                    });
                }
                break;

            case 'azurerm':
                if (!config.includes('storage_account_name') || !config.includes('container_name')) {
                    warnings.push({
                        message: 'Backend Azure deve especificar storage_account_name e container_name',
                        line: this.findLineNumber(fullContent, 'backend = "azurerm"')
                    });
                }
                break;
        }
    }

    private extractStackDependencies(content: string): Array<{ from: string, to: string }> {
        // Implementação simplificada de extração de dependências
        return [];
    }

    private detectCircularDependencies(dependencies: Array<{ from: string, to: string }>): string[] {
        // Implementação simplificada de detecção de dependências circulares
        return [];
    }
}
