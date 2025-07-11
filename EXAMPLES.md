# Terragrunt MCP Server - Exemplos de Uso

Este documento mostra exemplos práticos de como usar o servidor MCP especializado em Terragrunt.

## 🚀 Início Rápido

### 1. Instalação
```bash
npm install
npm run build
```

### 2. Execução
```bash
npm start
```

### 3. Configuração no Claude Desktop
Adicione ao seu arquivo de configuração do Claude Desktop:

```json
{
  "mcpServers": {
    "terragrunt-analyzer": {
      "command": "node",
      "args": ["/caminho/para/terragrunt-mcp-server/dist/index.js"],
      "cwd": "/caminho/para/terragrunt-mcp-server"
    }
  }
}
```

## 🛠️ Ferramentas Disponíveis

### `analyze_project`
Realiza análise completa de um projeto Terragrunt.

**Exemplo de uso:**
```
Use a ferramenta analyze_project para analisar o projeto em /home/user/infrastructure
```

**Parâmetros:**
- `projectPath`: Caminho para o diretório raiz do projeto
- `includeMetrics`: (opcional) Incluir métricas detalhadas

### `validate_config`
Valida arquivos de configuração Terragrunt.

**Exemplo de uso:**
```
Use validate_config para validar o arquivo /home/user/infrastructure/terragrunt.hcl
```

**Parâmetros:**
- `configPath`: Caminho para o arquivo de configuração
- `strictMode`: (opcional) Usar validação rigorosa

### `get_dependencies`
Mapeia dependências entre módulos.

**Exemplo de uso:**
```
Use get_dependencies para mapear dependências em /home/user/infrastructure com formato de saída 'graph'
```

**Parâmetros:**
- `projectPath`: Caminho para o projeto
- `outputFormat`: json | graph | tree | list

### `check_stack_structure`
Analisa estrutura de stacks Terragrunt.

**Exemplo de uso:**
```
Use check_stack_structure para analisar o stack em /home/user/infrastructure/terragrunt.stack.hcl
```

**Parâmetros:**
- `stackPath`: Caminho para o arquivo de stack
- `validateUnits`: (opcional) Validar unidades referenciadas

### `suggest_optimizations`
Sugere melhorias para o projeto.

**Exemplo de uso:**
```
Use suggest_optimizations para o projeto em /home/user/infrastructure focando em performance e segurança
```

**Parâmetros:**
- `projectPath`: Caminho para o projeto
- `categories`: (opcional) performance | structure | security | maintenance

### `detect_issues`
Detecta problemas comuns.

**Exemplo de uso:**
```
Use detect_issues para encontrar problemas no projeto /home/user/infrastructure com severidade 'warning'
```

**Parâmetros:**
- `projectPath`: Caminho para o projeto
- `severity`: all | error | warning | info

### `get_project_metrics`
Coleta métricas detalhadas.

**Exemplo de uso:**
```
Use get_project_metrics para coletar métricas do projeto em /home/user/infrastructure
```

**Parâmetros:**
- `projectPath`: Caminho para o projeto
- `includeComplexity`: (opcional) Incluir métricas de complexidade

### `find_unused_modules`
Encontra módulos não utilizados.

**Exemplo de uso:**
```
Use find_unused_modules para encontrar módulos órfãos em /home/user/infrastructure
```

**Parâmetros:**
- `projectPath`: Caminho para o projeto
- `includeTransitive`: (opcional) Incluir dependências transitivas

## 📁 Estrutura de Projeto Suportada

O servidor MCP funciona melhor com projetos organizados seguindo estas convenções:

```
projeto/
├── terragrunt.hcl                 # Configuração raiz (opcional)
├── terragrunt.stack.hcl           # Stack principal (opcional)
├── .terragrunt-version            # Versão específica
├── environments/
│   ├── dev/
│   │   ├── terragrunt.hcl
│   │   ├── database/
│   │   │   └── terragrunt.hcl
│   │   └── web/
│   │       └── terragrunt.hcl
│   └── prod/
│       ├── terragrunt.hcl
│       ├── database/
│       │   └── terragrunt.hcl
│       └── web/
│           └── terragrunt.hcl
└── modules/                       # Módulos Terraform locais
    ├── database/
    │   ├── main.tf
    │   ├── variables.tf
    │   └── outputs.tf
    └── web/
        ├── main.tf
        ├── variables.tf
        └── outputs.tf
```

## 📊 Exemplo de Saída

### Análise de Projeto
```markdown
# Análise do Projeto Terragrunt

## 📊 Resumo
- **Versão Terragrunt Detectada**: 0.82.3
- **Arquivos de Configuração**: 12
- **Stacks Encontrados**: 2
- **Módulos Totais**: 8
- **Dependências**: 15

## 🏗️ Estrutura do Projeto
- Profundidade máxima: 4 níveis
- Diretórios: 24
- Arquivos Terragrunt: 12

## ⚠️ Problemas Detectados
- **warning**: Módulo sem bloco terraform ou include
- **warning**: Considere especificar terragrunt_version_constraint

## 💡 Recomendações
- Use Terragrunt 0.82.3 para acessar os recursos mais recentes
- Implemente stacks para melhor organização
- Configure strict mode para validações rigorosas
```

### Validação de Configuração
```markdown
# Validação de Configuração Terragrunt

## 📄 Arquivo: /projeto/dev/database/terragrunt.hcl

## ✅ Status: Válido

## 💡 Sugestões
- Considere usar extra_arguments para padronizar argumentos do Terraform
- Considere usar variáveis de ambiente para dados sensíveis

## 📋 Detalhes da Configuração
- **Tipo**: terragrunt.hcl
- **Versão do Schema**: 0.82.3
- **Blocos Encontrados**: terraform, remote_state, inputs
```

## 🔧 Configurações Avançadas

### Variáveis de Ambiente
```bash
# Para habilitar features experimentais
export TG_EXPERIMENTAL_ENGINE=1

# Para logging detalhado
export TG_LOG_LEVEL=debug
```

### Integração com CI/CD
O servidor pode ser usado em pipelines de CI/CD para validação automática:

```yaml
# Exemplo GitHub Actions
- name: Validate Terragrunt
  run: |
    node terragrunt-mcp-server/dist/index.js validate_config \
      --config-path ./infrastructure/terragrunt.hcl \
      --strict-mode true
```

## 🎯 Casos de Uso Comuns

### 1. Auditoria de Projeto
```
Analise o projeto completo em /infrastructure para identificar problemas e oportunidades de melhoria
```

### 2. Validação Antes de Deploy
```
Valide todas as configurações em /infrastructure/prod antes do deploy
```

### 3. Limpeza de Código
```
Encontre módulos não utilizados em /infrastructure para limpeza
```

### 4. Análise de Dependências
```
Mapeie as dependências do projeto /infrastructure em formato de grafo para visualização
```

### 5. Otimização de Performance
```
Sugira otimizações de performance para o projeto /infrastructure
```

## 🐛 Solução de Problemas

### Erro: "Módulo não encontrado"
Certifique-se de que todas as dependências estão instaladas:
```bash
npm install
```

### Erro: "Arquivo de configuração não encontrado"
Verifique se o caminho está correto e se o arquivo existe:
```bash
ls -la /caminho/para/terragrunt.hcl
```

### Performance Lenta
Para projetos grandes, considere:
- Usar `includeMetrics: false` para análises mais rápidas
- Analisar subdiretórios específicos em vez do projeto inteiro

## 📚 Recursos Adicionais

- [Documentação Terragrunt 0.82.3](https://terragrunt.gruntwork.io/)
- [Model Context Protocol](https://github.com/anthropics/mcp)
- [Guia de Melhores Práticas Terragrunt](https://terragrunt.gruntwork.io/docs/getting-started/quick-start/)
