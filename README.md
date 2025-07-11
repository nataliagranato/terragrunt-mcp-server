# Terragrunt MCP Server v1.0.0

Um servidor Model Context Protocol (MCP) especializado em análise e validação de projetos **Terragrunt 0.82.3**. Fornece análise inteligente de configurações, dependências, stacks e otimizações para projetos Terragrunt diretamente em IDEs compatíveis com MCP.


## 🛠️ Ferramentas MCP Disponíveis

| Ferramenta              | Descrição                   | Status |
| ----------------------- | --------------------------- | ------ |
| `analyze_project`       | Análise completa do projeto | ✅      |
| `validate_config`       | Valida configurações HCL    | ✅      |
| `get_dependencies`      | Mapeia dependências         | ✅      |
| `check_stack_structure` | Analisa estrutura de stacks | ✅      |
| `suggest_optimizations` | Sugere otimizações          | ✅      |
| `detect_issues`         | Detecta problemas           | ✅      |
| `get_project_metrics`   | Coleta métricas             | ✅      |
| `find_unused_modules`   | Encontra módulos órfãos     | ✅      |

## 🚀 Recursos

### 🔍 Análise de Projeto
- **Detecção automática** de arquivos `terragrunt.hcl` e `terragrunt.stack.hcl`
- **Mapeamento completo** da estrutura de diretórios
- **Análise de dependências** entre módulos e stacks
- **Validação de configurações** Terragrunt

### 🛠️ Ferramentas Disponíveis
- `analyze_project` - Análise completa do projeto Terragrunt
- `validate_config` - Validação de arquivos de configuração
- `get_dependencies` - Mapeamento de dependências
- `check_stack_structure` - Análise de stacks
- `suggest_optimizations` - Sugestões de melhoria
- `detect_issues` - Detecção de problemas comuns
- `get_project_metrics` - Métricas do projeto
- `find_unused_modules` - Módulos não utilizados

### 📊 Insights Fornecidos
- Estrutura do projeto e organização
- Dependências circulares ou problemáticas
- Configurações duplicadas ou inconsistentes
- Melhores práticas para Terragrunt 0.82.3
- Problemas de performance potenciais
- Sugestões de refatoração

## 🏗️ Instalação

```bash
npm install
npm run build
```

## 🎯 Uso

### Executar o servidor MCP
```bash
npm start
```

### Desenvolvimento
```bash
npm run dev
```

### Executar testes
```bash
npm test
```

## 🔧 Configuração

O servidor MCP pode ser configurado para trabalhar com diferentes IDEs que suportam o protocolo MCP.

### Exemplo de configuração para Claude Desktop:
```json
{
  "mcpServers": {
    "terragrunt-analyzer": {
      "command": "node",
      "args": ["dist/index.js"],
      "cwd": "/caminho/para/terragrunt-mcp-server"
    }
  }
}
```

## 📁 Estrutura do Projeto

```
src/
├── index.ts              # Servidor MCP principal
├── analyzers/            # Analisadores especializados
│   ├── project.ts        # Análise de projeto
│   ├── config.ts         # Análise de configuração
│   ├── dependencies.ts   # Análise de dependências
│   └── stack.ts          # Análise de stacks
├── parsers/              # Parsers para diferentes formatos
│   ├── hcl.ts           # Parser HCL para Terragrunt
│   └── yaml.ts          # Parser YAML
├── tools/                # Ferramentas MCP
│   ├── analyze.ts        # Ferramenta de análise
│   ├── validate.ts       # Ferramenta de validação
│   └── optimize.ts       # Ferramenta de otimização
├── types/                # Definições de tipos
│   ├── terragrunt.ts     # Tipos específicos do Terragrunt
│   └── mcp.ts           # Tipos MCP
└── utils/                # Utilitários
    ├── file.ts           # Operações de arquivo
    ├── path.ts           # Operações de caminho
    └── logger.ts         # Sistema de log
```

## 🎯 Versão Suportada

Este servidor foi desenvolvido especificamente para **Terragrunt 0.82.3** e inclui:

- Suporte completo para `terragrunt.stack.hcl`
- Análise de engines IaC
- Suporte para OpenTofu e Terraform
- Novos comandos da CLI redesenhada
- Recursos de strict mode
- Análise de catálogos Terragrunt

## 🚀 Releases e Versionamento

Este projeto utiliza [Conventional Commits](https://www.conventionalcommits.org/) e releases automáticas via GitHub Actions.

### Como Contribuir com Commits

```bash
# Use o script interativo para commits
npm run commit

# Ou manualmente seguindo o padrão:
git commit -m "feat(mcp): add new analyzer tool"
git commit -m "fix(parser): resolve HCL parsing issue"
git commit -m "docs: update README instructions"
```

### Tipos de Release

- **patch**: Correções de bugs (`fix:`)
- **minor**: Novas funcionalidades (`feat:`)
- **major**: Mudanças incompatíveis (`feat!:` ou `BREAKING CHANGE`)

Para mais detalhes, consulte [docs/RELEASES.md](docs/RELEASES.md).

## 🤝 Contribuição

Contribuições são bem-vindas! Por favor, abra uma issue ou envie um pull request.

## 📄 Licença

MIT License - veja o arquivo [LICENSE](LICENSE) para detalhes.
