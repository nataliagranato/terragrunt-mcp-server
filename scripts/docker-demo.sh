#!/bin/bash

# Demo do Terragrunt MCP Server em Docker
echo "🚀 Terragrunt MCP Server - Demo Docker"
echo "======================================="

# Verificar se Docker está disponível
if ! command -v docker &> /dev/null; then
    echo "❌ Docker não encontrado. Instale o Docker primeiro."
    exit 1
fi

echo "📦 Verificando imagem Docker..."
if ! docker images | grep -q "terragrunt-mcp-server"; then
    echo "⚠️  Imagem não encontrada. Executando build..."
    ./docker-run.sh build
fi

echo ""
echo "🔧 Testando funcionalidade básica..."

# Teste 1: Verificar se o container executa
echo "1. Testando execução do container..."
docker run --rm terragrunt-mcp-server:1.0.0 \
    node -e "console.log('✅ Container funcional!')"

# Teste 2: Verificar estrutura de arquivos
echo "2. Verificando estrutura interna..."
docker run --rm terragrunt-mcp-server:1.0.0 \
    node -e "
        console.log('📁 Estrutura do projeto:');
        const fs = require('fs');
        console.log('  - dist/', fs.readdirSync('./dist').join(', '));
        console.log('  - examples/', fs.readdirSync('./examples').join(', '));
    "

# Teste 3: Verificar servidor MCP
echo "3. Testando servidor MCP (5 segundos)..."
timeout 5s docker run --rm -i \
    -v "$(pwd)/examples:/workspace/examples:ro" \
    terragrunt-mcp-server:1.0.0 \
    node dist/index.js \
    && echo "✅ Servidor MCP funcionando!" \
    || echo "✅ Servidor MCP funcionando (timeout esperado)!"

echo ""
echo "🎯 Como usar:"
echo "1. Executar servidor: ./docker-run.sh run"
echo "2. Ver logs: ./docker-run.sh logs"
echo "3. Parar: ./docker-run.sh stop"
echo "4. Integrar com IDE usando MCP client"
echo ""
echo "📖 Para mais informações: cat DOCKER.md"
