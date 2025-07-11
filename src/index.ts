#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    ToolSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { ProjectAnalyzer } from './analyzers/project.js';
import { ConfigAnalyzer } from './analyzers/config.js';
import { DependencyAnalyzer } from './analyzers/dependencies.js';
import { StackAnalyzer } from './analyzers/stack.js';
import { FileUtils } from './utils/file.js';
import { Logger } from './utils/logger.js';

import type {
    AnalyzeProjectArgs,
    ValidateConfigArgs,
    GetDependenciesArgs,
    CheckStackStructureArgs,
    SuggestOptimizationsArgs,
    DetectIssuesArgs,
    GetProjectMetricsArgs,
    FindUnusedModulesArgs
} from './types/mcp.js';

class TerragruntMCPServer {
    private server: Server;
    private projectAnalyzer: ProjectAnalyzer;
    private configAnalyzer: ConfigAnalyzer;
    private dependencyAnalyzer: DependencyAnalyzer;
    private stackAnalyzer: StackAnalyzer;
    private logger: Logger;

    constructor() {
        this.server = new Server(
            {
                name: 'terragrunt-mcp-server',
                version: '1.0.0',
            },
            {
                capabilities: {
                    tools: {},
                },
            }
        );

        this.logger = new Logger();
        this.projectAnalyzer = new ProjectAnalyzer(this.logger);
        this.configAnalyzer = new ConfigAnalyzer(this.logger);
        this.dependencyAnalyzer = new DependencyAnalyzer(this.logger);
        this.stackAnalyzer = new StackAnalyzer(this.logger);

        this.setupToolHandlers();
    }

    private validateArgs<T>(args: Record<string, unknown> | undefined, requiredFields: string[]): T {
        if (!args) {
            throw new Error('Arguments are required');
        }

        for (const field of requiredFields) {
            if (!(field in args)) {
                throw new Error(`Required field '${field}' is missing`);
            }
        }

        return args as T;
    }

    private setupToolHandlers() {
        // Lista de ferramentas disponíveis
        this.server.setRequestHandler(ListToolsRequestSchema, async () => {
            return {
                tools: [
                    {
                        name: 'analyze_project',
                        description: 'Análise completa de um projeto Terragrunt, incluindo estrutura, configurações e dependências',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                projectPath: {
                                    type: 'string',
                                    description: 'Caminho para o diretório raiz do projeto Terragrunt'
                                },
                                includeMetrics: {
                                    type: 'boolean',
                                    description: 'Incluir métricas detalhadas na análise',
                                    default: true
                                }
                            },
                            required: ['projectPath']
                        }
                    },
                    {
                        name: 'validate_config',
                        description: 'Valida arquivos de configuração Terragrunt (terragrunt.hcl, terragrunt.stack.hcl)',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                configPath: {
                                    type: 'string',
                                    description: 'Caminho para o arquivo de configuração Terragrunt'
                                },
                                strictMode: {
                                    type: 'boolean',
                                    description: 'Usar validação rigorosa baseada em Terragrunt 0.82.3',
                                    default: true
                                }
                            },
                            required: ['configPath']
                        }
                    },
                    {
                        name: 'get_dependencies',
                        description: 'Mapeia e analisa dependências entre módulos Terragrunt',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                projectPath: {
                                    type: 'string',
                                    description: 'Caminho para o diretório do projeto'
                                },
                                outputFormat: {
                                    type: 'string',
                                    enum: ['json', 'graph', 'tree', 'list'],
                                    description: 'Formato de saída das dependências',
                                    default: 'json'
                                }
                            },
                            required: ['projectPath']
                        }
                    },
                    {
                        name: 'check_stack_structure',
                        description: 'Analisa a estrutura de stacks Terragrunt e identifica problemas',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                stackPath: {
                                    type: 'string',
                                    description: 'Caminho para o arquivo terragrunt.stack.hcl'
                                },
                                validateUnits: {
                                    type: 'boolean',
                                    description: 'Validar unidades referenciadas no stack',
                                    default: true
                                }
                            },
                            required: ['stackPath']
                        }
                    },
                    {
                        name: 'suggest_optimizations',
                        description: 'Sugere otimizações para melhorar performance e manutenibilidade',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                projectPath: {
                                    type: 'string',
                                    description: 'Caminho para o projeto Terragrunt'
                                },
                                categories: {
                                    type: 'array',
                                    items: {
                                        type: 'string',
                                        enum: ['performance', 'structure', 'security', 'maintenance']
                                    },
                                    description: 'Categorias específicas de otimização'
                                }
                            },
                            required: ['projectPath']
                        }
                    },
                    {
                        name: 'detect_issues',
                        description: 'Detecta problemas comuns em projetos Terragrunt',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                projectPath: {
                                    type: 'string',
                                    description: 'Caminho para o projeto'
                                },
                                severity: {
                                    type: 'string',
                                    enum: ['all', 'error', 'warning', 'info'],
                                    description: 'Nível mínimo de severidade dos problemas',
                                    default: 'warning'
                                }
                            },
                            required: ['projectPath']
                        }
                    },
                    {
                        name: 'get_project_metrics',
                        description: 'Coleta métricas detalhadas do projeto Terragrunt',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                projectPath: {
                                    type: 'string',
                                    description: 'Caminho para o projeto'
                                },
                                includeComplexity: {
                                    type: 'boolean',
                                    description: 'Incluir métricas de complexidade',
                                    default: true
                                }
                            },
                            required: ['projectPath']
                        }
                    },
                    {
                        name: 'find_unused_modules',
                        description: 'Identifica módulos Terragrunt não utilizados ou órfãos',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                projectPath: {
                                    type: 'string',
                                    description: 'Caminho para o projeto'
                                },
                                includeTransitive: {
                                    type: 'boolean',
                                    description: 'Incluir dependências transitivas na análise',
                                    default: true
                                }
                            },
                            required: ['projectPath']
                        }
                    }
                ]
            };
        });

        // Handler para execução de ferramentas
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;

            try {
                switch (name) {
                    case 'analyze_project':
                        return await this.handleAnalyzeProject(
                            this.validateArgs<AnalyzeProjectArgs>(args, ['projectPath'])
                        );

                    case 'validate_config':
                        return await this.handleValidateConfig(
                            this.validateArgs<ValidateConfigArgs>(args, ['configPath'])
                        );

                    case 'get_dependencies':
                        return await this.handleGetDependencies(
                            this.validateArgs<GetDependenciesArgs>(args, ['projectPath'])
                        );

                    case 'check_stack_structure':
                        return await this.handleCheckStackStructure(
                            this.validateArgs<CheckStackStructureArgs>(args, ['stackPath'])
                        );

                    case 'suggest_optimizations':
                        return await this.handleSuggestOptimizations(
                            this.validateArgs<SuggestOptimizationsArgs>(args, ['projectPath'])
                        );

                    case 'detect_issues':
                        return await this.handleDetectIssues(
                            this.validateArgs<DetectIssuesArgs>(args, ['projectPath'])
                        );

                    case 'get_project_metrics':
                        return await this.handleGetProjectMetrics(
                            this.validateArgs<GetProjectMetricsArgs>(args, ['projectPath'])
                        );

                    case 'find_unused_modules':
                        return await this.handleFindUnusedModules(
                            this.validateArgs<FindUnusedModulesArgs>(args, ['projectPath'])
                        );

                    default:
                        throw new Error(`Ferramenta desconhecida: ${name}`);
                }
            } catch (error) {
                this.logger.error(`Erro ao executar ferramenta ${name}:`, error);
                throw error;
            }
        });
    }

    private async handleAnalyzeProject(args: AnalyzeProjectArgs) {
        const { projectPath, includeMetrics = true } = args;

        this.logger.info(`Analisando projeto Terragrunt em: ${projectPath}`);

        const analysis = await this.projectAnalyzer.analyzeProject(projectPath, {
            includeMetrics,
            includeValidation: true,
            includeDependencies: true,
            includeStacks: true
        });

        return {
            content: [
                {
                    type: 'text',
                    text: `# Análise do Projeto Terragrunt

## 📊 Resumo
- **Versão Terragrunt Detectada**: ${analysis.terragruntVersion || 'Não detectada'}
- **Arquivos de Configuração**: ${analysis.configFiles.length}
- **Stacks Encontrados**: ${analysis.stacks.length}
- **Módulos Totais**: ${analysis.modules.length}
- **Dependências**: ${analysis.dependencies.length}

## 🏗️ Estrutura do Projeto
${this.formatProjectStructure(analysis.structure)}

## ⚙️ Configurações
${this.formatConfigurations(analysis.configFiles)}

## 🔗 Dependências
${this.formatDependencies(analysis.dependencies)}

${analysis.stacks.length > 0 ? `## 📚 Stacks
${this.formatStacks(analysis.stacks)}` : ''}

${analysis.issues.length > 0 ? `## ⚠️ Problemas Detectados
${this.formatIssues(analysis.issues)}` : ''}

${includeMetrics ? `## 📈 Métricas
${this.formatMetrics(analysis.metrics)}` : ''}

## 💡 Recomendações
${this.formatRecommendations(analysis.recommendations)}
`
                }
            ]
        };
    }

    private async handleValidateConfig(args: ValidateConfigArgs) {
        const { configPath, strictMode = true } = args;

        this.logger.info(`Validando configuração: ${configPath}`);

        const validation = await this.configAnalyzer.validateConfig(configPath, {
            strictMode,
            terragruntVersion: '0.82.3'
        });

        return {
            content: [
                {
                    type: 'text',
                    text: `# Validação de Configuração Terragrunt

## 📄 Arquivo: ${configPath}

## ✅ Status: ${validation.isValid ? 'Válido' : 'Inválido'}

${validation.errors.length > 0 ? `## ❌ Erros
${validation.errors.map((err: any) => `- **${err.severity}**: ${err.message} (linha: ${err.line})`).join('\n')}` : ''}

${validation.warnings.length > 0 ? `## ⚠️ Avisos
${validation.warnings.map((warn: any) => `- ${warn.message} (linha: ${warn.line})`).join('\n')}` : ''}

${validation.suggestions.length > 0 ? `## 💡 Sugestões
${validation.suggestions.map((sug: any) => `- ${sug.message}`).join('\n')}` : ''}

## 📋 Detalhes da Configuração
- **Tipo**: ${validation.configType}
- **Versão do Schema**: ${validation.schemaVersion}
- **Blocos Encontrados**: ${validation.blocks.join(', ')}
`
                }
            ]
        };
    }

    private async handleGetDependencies(args: GetDependenciesArgs) {
        const { projectPath, outputFormat = 'json' } = args;

        this.logger.info(`Mapeando dependências em: ${projectPath}`);

        const dependencies = await this.dependencyAnalyzer.analyzeDependencies(projectPath);

        const formattedOutput = this.formatDependencyOutput(dependencies, outputFormat);

        return {
            content: [
                {
                    type: 'text',
                    text: `# Mapeamento de Dependências

## 🔗 Resumo
- **Total de Módulos**: ${dependencies.modules.length}
- **Dependências Diretas**: ${dependencies.directDependencies.length}
- **Dependências Circulares**: ${dependencies.circularDependencies.length}

${formattedOutput}

${dependencies.circularDependencies.length > 0 ? `## ⚠️ Dependências Circulares Detectadas
${dependencies.circularDependencies.map((cycle: any) => `- ${cycle.join(' → ')}`).join('\n')}` : ''}
`
                }
            ]
        };
    }

    private async handleCheckStackStructure(args: CheckStackStructureArgs) {
        const { stackPath, validateUnits = true } = args;

        this.logger.info(`Verificando estrutura de stack: ${stackPath}`);

        const stackAnalysis = await this.stackAnalyzer.analyzeStack(stackPath, {
            validateUnits,
            checkDependencies: true
        });

        return {
            content: [
                {
                    type: 'text',
                    text: `# Análise de Stack Terragrunt

## 📚 Stack: ${stackPath}

## ✅ Status: ${stackAnalysis.isValid ? 'Válido' : 'Inválido'}

## 🏗️ Unidades (${stackAnalysis.units.length})
${stackAnalysis.units.map((unit: any) => `- **${unit.name}**: ${unit.source} (deps: ${unit.dependencies.length})`).join('\n')}

${stackAnalysis.issues.length > 0 ? `## ⚠️ Problemas
${stackAnalysis.issues.map((issue: any) => `- **${issue.severity}**: ${issue.message}`).join('\n')}` : ''}

## 🔗 Dependências do Stack
${this.formatStackDependencies(stackAnalysis.dependencies)}

## 📊 Estatísticas
- **Complexidade**: ${stackAnalysis.complexity}
- **Profundidade Máxima**: ${stackAnalysis.maxDepth}
- **Módulos Únicos**: ${stackAnalysis.uniqueModules}
`
                }
            ]
        };
    }

    private async handleSuggestOptimizations(args: SuggestOptimizationsArgs) {
        const { projectPath, categories } = args;

        this.logger.info(`Gerando sugestões de otimização para: ${projectPath}`);

        const optimizations = await this.projectAnalyzer.suggestOptimizations(projectPath, {
            categories: categories || ['performance', 'structure', 'security', 'maintenance']
        });

        return {
            content: [
                {
                    type: 'text',
                    text: `# Sugestões de Otimização

## 🚀 Performance
${optimizations.performance.map((opt: any) => `- **${opt.priority}**: ${opt.suggestion}\n  *Impacto*: ${opt.impact}`).join('\n')}

## 🏗️ Estrutura
${optimizations.structure.map((opt: any) => `- **${opt.priority}**: ${opt.suggestion}\n  *Impacto*: ${opt.impact}`).join('\n')}

## 🔒 Segurança
${optimizations.security.map((opt: any) => `- **${opt.priority}**: ${opt.suggestion}\n  *Impacto*: ${opt.impact}`).join('\n')}

## 🔧 Manutenção
${optimizations.maintenance.map((opt: any) => `- **${opt.priority}**: ${opt.suggestion}\n  *Impacto*: ${opt.impact}`).join('\n')}

## 📋 Resumo Executivo
- **Total de Sugestões**: ${optimizations.totalSuggestions}
- **Prioridade Alta**: ${optimizations.highPriority}
- **Economia Estimada**: ${optimizations.estimatedTimesSaved} horas
`
                }
            ]
        };
    }

    private async handleDetectIssues(args: DetectIssuesArgs) {
        const { projectPath, severity = 'warning' } = args;

        this.logger.info(`Detectando problemas em: ${projectPath}`);

        const issues = await this.projectAnalyzer.detectIssues(projectPath, {
            minSeverity: severity
        });

        return {
            content: [
                {
                    type: 'text',
                    text: `# Detecção de Problemas

## 📊 Resumo
- **Total de Problemas**: ${issues.total}
- **Críticos**: ${issues.critical}
- **Erros**: ${issues.errors}
- **Avisos**: ${issues.warnings}

## 🔴 Problemas Críticos
${issues.issues.filter((i: any) => i.severity === 'critical').map((issue: any) =>
                        `- **${issue.type}**: ${issue.message}\n  *Local*: ${issue.location}\n  *Solução*: ${issue.solution}`
                    ).join('\n')}

## ⚠️ Avisos
${issues.issues.filter((i: any) => i.severity === 'warning').map((issue: any) =>
                        `- **${issue.type}**: ${issue.message}\n  *Local*: ${issue.location}\n  *Solução*: ${issue.solution}`
                    ).join('\n')}

## 💡 Recomendações Gerais
${issues.recommendations.map((rec: any) => `- ${rec}`).join('\n')}
`
                }
            ]
        };
    }

    private async handleGetProjectMetrics(args: GetProjectMetricsArgs) {
        const { projectPath, includeComplexity = true } = args;

        this.logger.info(`Coletando métricas do projeto: ${projectPath}`);

        const metrics = await this.projectAnalyzer.getProjectMetrics(projectPath, {
            includeComplexity
        });

        return {
            content: [
                {
                    type: 'text',
                    text: `# Métricas do Projeto

## 📊 Estatísticas Gerais
- **Arquivos Terragrunt**: ${metrics.terragruntFiles}
- **Módulos Terraform**: ${metrics.terraformModules}
- **Linhas de Código**: ${metrics.linesOfCode}
- **Tamanho Total**: ${metrics.totalSize} KB

## 🏗️ Estrutura
- **Profundidade Máxima**: ${metrics.maxDepth} níveis
- **Diretórios**: ${metrics.directories}
- **Arquivos de Configuração**: ${metrics.configFiles}

## 🔗 Dependências
- **Dependências Internas**: ${metrics.internalDependencies}
- **Dependências Externas**: ${metrics.externalDependencies}
- **Módulos Órfãos**: ${metrics.orphanModules}

${includeComplexity ? `## 🧮 Complexidade
- **Índice de Complexidade**: ${metrics.complexityIndex}/100
- **Módulos Complexos**: ${metrics.complexModules}
- **Dependências Circulares**: ${metrics.circularDependencies}` : ''}

## 📈 Tendências
- **Crescimento Estimado**: ${metrics.growthTrend}
- **Manutenibilidade**: ${metrics.maintainabilityScore}/100
- **Saúde do Projeto**: ${metrics.healthScore}/100
`
                }
            ]
        };
    }

    private async handleFindUnusedModules(args: FindUnusedModulesArgs) {
        const { projectPath, includeTransitive = true } = args;

        this.logger.info(`Procurando módulos não utilizados em: ${projectPath}`);

        const unusedModules = await this.dependencyAnalyzer.findUnusedModules(projectPath, {
            includeTransitive
        });

        return {
            content: [
                {
                    type: 'text',
                    text: `# Módulos Não Utilizados

## 📊 Resumo
- **Módulos Órfãos**: ${unusedModules.orphaned.length}
- **Módulos Isolados**: ${unusedModules.isolated.length}
- **Potencial Limpeza**: ${unusedModules.potentialCleanup} arquivos

## 🗑️ Módulos Órfãos
${unusedModules.orphaned.map((module: any) =>
                        `- **${module.path}**\n  *Última modificação*: ${module.lastModified}\n  *Tamanho*: ${module.size} KB`
                    ).join('\n')}

## 🏝️ Módulos Isolados
${unusedModules.isolated.map((module: any) =>
                        `- **${module.path}**\n  *Razão*: ${module.reason}`
                    ).join('\n')}

## 💡 Ações Recomendadas
${unusedModules.recommendations.map((rec: any) => `- ${rec.action}: ${rec.description}`).join('\n')}

## ⚠️ Cuidados
- Verifique se os módulos não são utilizados em ambientes não mapeados
- Considere manter backups antes de remover módulos
- Alguns módulos podem ser utilizados externamente
`
                }
            ]
        };
    }

    // Métodos auxiliares para formatação
    private formatProjectStructure(structure: any): string {
        // Implementar formatação da estrutura do projeto
        return 'Estrutura do projeto formatada...';
    }

    private formatConfigurations(configs: any[]): string {
        // Implementar formatação das configurações
        return 'Configurações formatadas...';
    }

    private formatDependencies(dependencies: any[]): string {
        // Implementar formatação das dependências
        return 'Dependências formatadas...';
    }

    private formatStacks(stacks: any[]): string {
        // Implementar formatação dos stacks
        return 'Stacks formatados...';
    }

    private formatIssues(issues: any[]): string {
        // Implementar formatação dos problemas
        return 'Problemas formatados...';
    }

    private formatMetrics(metrics: any): string {
        // Implementar formatação das métricas
        return 'Métricas formatadas...';
    }

    private formatRecommendations(recommendations: any[]): string {
        // Implementar formatação das recomendações
        return 'Recomendações formatadas...';
    }

    private formatDependencyOutput(dependencies: any, format: string): string {
        // Implementar formatação das dependências conforme o formato
        return 'Saída de dependências formatada...';
    }

    private formatStackDependencies(dependencies: any): string {
        // Implementar formatação das dependências do stack
        return 'Dependências do stack formatadas...';
    }

    async run() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        this.logger.info('Servidor MCP Terragrunt iniciado com sucesso!');
    }
}

// Execução principal
const server = new TerragruntMCPServer();
server.run().catch((error) => {
    console.error('Erro ao iniciar servidor MCP:', error);
    process.exit(1);
});
