# Configuração de Releases Automáticas

Este projeto utiliza GitHub Actions para automatizar a geração de releases e atualização do changelog. Para que os workflows funcionem corretamente, é necessário configurar um Personal Access Token (PAT).

## 🔐 Configurando o USER_TOKEN

### 1. Criar Personal Access Token (PAT)

1. Acesse [GitHub Settings > Developer settings > Personal access tokens > Tokens (classic)](https://github.com/settings/tokens)
2. Clique em "Generate new token (classic)"
3. Configure o token:
   - **Note**: `terragrunt-mcp-server-releases`
   - **Expiration**: Recomendado 1 ano
   - **Scopes**: Selecione as seguintes permissões:
     - ✅ `repo` (Full control of private repositories)
     - ✅ `workflow` (Update GitHub Action workflows)
     - ✅ `write:packages` (Upload packages to GitHub Package Registry)

4. Clique em "Generate token"
5. **IMPORTANTE**: Copie o token imediatamente (ele só será mostrado uma vez)

### 2. Configurar Secret no Repositório

1. Acesse `Settings > Secrets and variables > Actions` no seu repositório
2. Clique em "New repository secret"
3. Configure:
   - **Name**: `USER_TOKEN`
   - **Secret**: Cole o PAT criado no passo anterior
4. Clique em "Add secret"

## 🚀 Workflows Disponíveis

### 1. Release Please (Recomendado)
- **Arquivo**: `.github/workflows/release-please.yml`
- **Trigger**: Push para branch `main`
- **Funcionamento**:
  - Analisa commits seguindo [Conventional Commits](https://www.conventionalcommits.org/)
  - Cria automaticamente Pull Requests com changelog
  - Quando o PR é merged, cria release automaticamente

### 2. Release Manual
- **Arquivo**: `.github/workflows/release.yml`
- **Trigger**: Manual via GitHub Actions
- **Funcionamento**:
  - Permite especificar versão manualmente
  - Gera changelog usando conventional-changelog
  - Cria release com artifacts

## 📝 Como Usar

### Método 1: Release Please (Automático)

1. **Faça commits seguindo Conventional Commits**:
   ```bash
   feat: add new analyzer for stack validation
   fix: resolve HCL parsing issue with nested blocks
   docs: update installation instructions
   ```

2. **O Release Please criará automaticamente**:
   - PR com changelog atualizado
   - Versão bumped no package.json
   - Quando o PR for merged → Release automático

### Método 2: Scripts Locais

```bash
# Commit usando script interativo
npm run commit

# Releases manuais
npm run release:patch    # 1.0.0 → 1.0.1
npm run release:minor    # 1.0.0 → 1.1.0  
npm run release:major    # 1.0.0 → 2.0.0

# Ou usando script diretamente
./scripts/release.sh patch
```

### Método 3: Workflow Manual

1. Acesse `Actions > Release` no GitHub
2. Clique em "Run workflow"
3. Especifique a versão (ex: `1.2.0`)
4. Execute

## 🔍 Tipos de Commit (Conventional Commits)

| Tipo              | Descrição                        | Impacto na Versão |
| ----------------- | -------------------------------- | ----------------- |
| `feat`            | Nova funcionalidade              | `minor`           |
| `fix`             | Correção de bug                  | `patch`           |
| `docs`            | Mudanças na documentação         | `patch`           |
| `style`           | Formatação, espaços em branco    | `patch`           |
| `refactor`        | Refatoração sem nova feature/fix | `patch`           |
| `perf`            | Melhoria de performance          | `patch`           |
| `test`            | Adição/modificação de testes     | `patch`           |
| `build`           | Mudanças no build system         | `patch`           |
| `ci`              | Mudanças na CI                   | `patch`           |
| `chore`           | Outras mudanças                  | `patch`           |
| `BREAKING CHANGE` | Mudança incompatível             | `major`           |

## 📋 Exemplos de Commits

```bash
# Feature (minor bump)
feat(mcp): add new tool for dependency analysis

# Bug fix (patch bump)
fix(parser): handle empty terragrunt.hcl files

# Breaking change (major bump)
feat!: redesign API interface
BREAKING CHANGE: API methods renamed for consistency

# Feature com escopo e descrição detalhada
feat(analyzer): add support for terragrunt.stack.hcl

- Parse stack configuration files
- Extract stack dependencies
- Validate stack structure
```

## 🛠️ Troubleshooting

### Erro: "Resource not accessible by integration"
- Verifique se o `USER_TOKEN` está configurado corretamente
- Confirme as permissões do PAT (especialmente `repo` e `workflow`)

### Release não foi criado
- Verifique se há commits desde o último release
- Confirme se os commits seguem Conventional Commits
- Verifique os logs do workflow no GitHub Actions

### Changelog não atualizado
- Certifique-se de usar tipos de commit válidos
- Verifique se o arquivo `.release-please-config.json` está correto
- Confira se o workflow tem permissões de escrita

## 📚 Recursos Adicionais

- [Conventional Commits](https://www.conventionalcommits.org/)
- [Release Please Documentation](https://github.com/googleapis/release-please)
- [Semantic Versioning](https://semver.org/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
