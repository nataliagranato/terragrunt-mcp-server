# Docker Setup - Terragrunt MCP Server

Este guia explica como executar o Terragrunt MCP Server em container Docker.

## 🐳 Opções de Execução

### 1. Script Automatizado (Recomendado)

```bash
# Tornar executável (primeira vez)
chmod +x docker-run.sh

# Build e execução
./docker-run.sh run

# Ver logs
./docker-run.sh logs

# Parar servidor
./docker-run.sh stop
```

### 2. Docker Compose

```bash
# Iniciar
docker compose up -d

# Ver logs
docker compose logs -f terragrunt-mcp

# Parar
docker compose down
```

### 3. Docker Manual

```bash
# Build
docker build -t terragrunt-mcp-server:1.0.0 .

# Executar
docker run -d \
  --name terragrunt-mcp-server \
  -v "$(pwd)/examples:/workspace/examples:ro" \
  terragrunt-mcp-server:1.0.0

# Logs
docker logs -f terragrunt-mcp-server
```

## 📁 Montando Projetos Terragrunt

Para analisar seus próprios projetos Terragrunt:

```bash
# Montar projeto específico
docker run -d \
  --name terragrunt-mcp-server \
  -v "/path/to/your/terragrunt/project:/workspace/project:ro" \
  terragrunt-mcp-server:1.0.0

# Ou via docker-compose (edite docker-compose.yml)
volumes:
  - /path/to/your/terragrunt/project:/workspace/project:ro
```

## 🔧 Configuração de IDE

Para integrar com sua IDE, configure o cliente MCP para usar o container:

### Claude Desktop
```json
{
  "mcpServers": {
    "terragrunt-analyzer": {
      "command": "docker",
      "args": [
        "exec", "-i", "terragrunt-mcp-server",
        "node", "dist/index.js"
      ]
    }
  }
}
```

### VS Code (com extensão MCP)
```json
{
  "mcp.servers": {
    "terragrunt": {
      "command": "docker",
      "args": [
        "exec", "-i", "terragrunt-mcp-server", 
        "node", "dist/index.js"
      ]
    }
  }
}
```

## 🔌 Integração MCP com IDEs

### O que é MCP (Model Context Protocol)

O servidor MCP Terragrunt fornece ferramentas especializadas para análise de projetos Terragrunt através do protocolo MCP. Para usar com IDEs, você precisa de um client MCP compatível.

### VS Code + Claude/Cursor

1. **Configure o cliente MCP no seu IDE:**

```json
{
  "mcpServers": {
    "terragrunt": {
      "command": "docker",
      "args": [
        "exec", "-i", "terragrunt-mcp-server",
        "node", "dist/index.js"
      ],
      "description": "Terragrunt analysis tools"
    }
  }
}
```

2. **Certifique-se que o container está rodando:**
```bash
./docker-run.sh run
```

3. **Teste a conexão:**
```bash
# Verificar se o servidor responde
docker exec terragrunt-mcp-server node dist/index.js --version
```

### Modo Stdio (Recomendado para MCP)

Para integração adequada com clientes MCP, use o modo stdio:

```bash
# Executar servidor em modo stdio
docker run -i --rm \
  -v "$(pwd)/examples:/workspace/examples:ro" \
  -v "/path/to/your/project:/workspace/project:ro" \
  terragrunt-mcp-server:1.0.0
```

### Ferramentas MCP Disponíveis

O servidor expõe estas ferramentas via MCP:

| Ferramenta             | Descrição                   |
| ---------------------- | --------------------------- |
| `analyze_project`      | Análise completa do projeto |
| `validate_config`      | Validação de configuração   |
| `analyze_dependencies` | Análise de dependências     |
| `check_security`       | Verificação de segurança    |
| `get_metrics`          | Métricas do projeto         |
| `suggest_improvements` | Sugestões de melhoria       |

### Exemplo de Uso via MCP

```bash
# Análise completa via container
docker exec -i terragrunt-mcp-server node dist/index.js << 'EOF'
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "analyze_project",
    "arguments": {
      "projectPath": "/workspace/examples"
    }
  }
}
EOF
```

## 🛠️ Comandos Úteis

```bash
# Build apenas
./docker-run.sh build

# Modo interativo/debug
./docker-run.sh interactive

# Exemplo de análise
./docker-run.sh example

# Limpeza completa
./docker-run.sh cleanup

# Ver ajuda
./docker-run.sh help
```

## 📊 Monitoramento

```bash
# Status do container
docker ps | grep terragrunt-mcp

# Uso de recursos
docker stats terragrunt-mcp-server

# Health check
docker inspect --format='{{.State.Health.Status}}' terragrunt-mcp-server
```

## 🔒 Segurança

O container é configurado com:

- ✅ Usuário não-root (uid: 1001)
- ✅ Filesystem read-only
- ✅ No new privileges
- ✅ Limites de recursos
- ✅ Rede isolada

## 🎯 Solução de Problemas

### Container não inicia
```bash
# Verificar logs
docker logs terragrunt-mcp-server

# Verificar build
docker build --no-cache -t terragrunt-mcp-server:1.0.0 .
```

### Problemas de permissão
```bash
# Verificar montagem de volumes
docker run --rm -v "$(pwd):/test" alpine ls -la /test
```

### Performance
```bash
# Ajustar limites no docker-compose.yml
deploy:
  resources:
    limits:
      memory: 1G
      cpus: '1.0'
```

## 📝 Variáveis de Ambiente

| Variável    | Padrão       | Descrição            |
| ----------- | ------------ | -------------------- |
| `NODE_ENV`  | `production` | Ambiente de execução |
| `LOG_LEVEL` | `info`       | Nível de log         |

## 🔄 Atualizações

```bash
# Rebuild após mudanças
./docker-run.sh cleanup
./docker-run.sh run

# Ou com compose
docker compose down
docker compose build --no-cache
docker compose up -d
```

---

**Dica**: Use `./docker-run.sh help` para ver todos os comandos disponíveis!
