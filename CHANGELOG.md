# CHANGELOG

Todas as mudanças notáveis ​​neste projeto serão documentadas neste arquivo.

O formato é baseado em [Mantenha um Changelog](https://keepachangelog.com/pt-BR/1.1.0/)
e este projeto adere a [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [1.0.0] - 2025-07-11

### ✨ Features
- Servidor MCP para análise de projetos Terragrunt
- Suporte completo para Terragrunt 0.82.3
- 8 ferramentas MCP para análise e validação
- Parser HCL para arquivos terragrunt.hcl e terragrunt.stack.hcl
- Análise de dependências entre módulos e stacks
- Detecção de problemas e sugestões de otimização
- Métricas de projeto e detecção de módulos não utilizados
- Configuração Docker para execução containerizada

### 🧪 Tests
- Suite completa de testes Jest (15 testes)
- Testes para todos os analisadores e utilitários
- Cobertura de código configurada

### 📚 Documentation
- README.md completo com instruções de uso
- Documentação de exemplos de configuração
- Documentação Docker com scripts de demonstração

### 👷 Build System
- Configuração TypeScript
- Build otimizado com target ES2020
- Scripts npm para desenvolvimento e produção
