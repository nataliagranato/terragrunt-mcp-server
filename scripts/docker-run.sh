#!/bin/bash

# Script de inicialização para Terragrunt MCP Server em container
set -e

echo "🚀 Terragrunt MCP Server - Container Setup"
echo "=========================================="

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para logging
log() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verificar se Docker está instalado
if ! command -v docker &> /dev/null; then
    error "Docker não está instalado. Instale o Docker primeiro."
    exit 1
fi

# Verificar se Docker Compose está disponível
if ! docker compose version &> /dev/null && ! docker-compose --version &> /dev/null; then
    error "Docker Compose não está disponível."
    exit 1
fi

# Função para build da imagem
build_image() {
    log "Building Terragrunt MCP Server image..."
    docker build -t terragrunt-mcp-server:1.0.0 .
    log "✅ Build completo!"
}

# Função para executar o servidor
run_server() {
    log "Iniciando Terragrunt MCP Server..."

    # Parar container existente se estiver rodando
    if docker ps -q -f name=terragrunt-mcp-server &> /dev/null; then
        warn "Parando container existente..."
        docker stop terragrunt-mcp-server &> /dev/null || true
        docker rm terragrunt-mcp-server &> /dev/null || true
    fi

    # Executar novo container
    docker run -d \
        --name terragrunt-mcp-server \
        --restart unless-stopped \
        -v "$(pwd)/examples:/workspace/examples:ro" \
        terragrunt-mcp-server:1.0.0

    log "✅ Servidor iniciado! Container: terragrunt-mcp-server"
}

# Função para executar com docker-compose
run_compose() {
    log "Iniciando com Docker Compose..."
    docker compose up -d terragrunt-mcp
    log "✅ Servidor iniciado via Docker Compose!"
}

# Função para executar em modo interativo (para debugging)
run_interactive() {
    log "Executando em modo interativo..."
    docker run -it --rm \
        --name terragrunt-mcp-interactive \
        -v "$(pwd)/examples:/workspace/examples:ro" \
        terragrunt-mcp-server:1.0.0 \
        /bin/sh
}

# Função para executar exemplo de análise
run_example() {
    local project_path=${1:-"/workspace/examples"}
    log "Executando exemplo de análise..."

    docker run --rm \
        -v "$(pwd)/examples:/workspace/examples:ro" \
        terragrunt-mcp-server:1.0.0 \
        node -e "
            console.log('🔍 Exemplo de uso do MCP Server');
            console.log('Project path: $project_path');
            console.log('Para integrar com IDE, use o comando: node dist/index.js');
        "
}

# Função para mostrar logs
show_logs() {
    log "Mostrando logs do servidor..."
    docker logs -f terragrunt-mcp-server
}

# Função para parar o servidor
stop_server() {
    log "Parando Terragrunt MCP Server..."
    docker stop terragrunt-mcp-server &> /dev/null || true
    docker rm terragrunt-mcp-server &> /dev/null || true
    log "✅ Servidor parado!"
}

# Função para limpeza
cleanup() {
    log "Limpando recursos Docker..."
    docker stop terragrunt-mcp-server &> /dev/null || true
    docker rm terragrunt-mcp-server &> /dev/null || true
    docker rmi terragrunt-mcp-server:1.0.0 &> /dev/null || true
    log "✅ Limpeza completa!"
}

# Menu principal
case "${1:-help}" in
    build)
        build_image
        ;;
    run)
        build_image
        run_server
        ;;
    compose)
        run_compose
        ;;
    interactive|shell)
        build_image
        run_interactive
        ;;
    example)
        build_image
        run_example "$2"
        ;;
    logs)
        show_logs
        ;;
    stop)
        stop_server
        ;;
    cleanup)
        cleanup
        ;;
    help|*)
        echo -e "${BLUE}Terragrunt MCP Server - Docker Management${NC}"
        echo ""
        echo "Uso: $0 [comando] [argumentos]"
        echo ""
        echo "Comandos disponíveis:"
        echo "  build      - Build da imagem Docker"
        echo "  run        - Build e executa o servidor"
        echo "  compose    - Executa via Docker Compose"
        echo "  interactive - Executa em modo interativo"
        echo "  example    - Executa exemplo de uso"
        echo "  logs       - Mostra logs do servidor"
        echo "  stop       - Para o servidor"
        echo "  cleanup    - Remove todos os recursos"
        echo "  help       - Mostra esta ajuda"
        echo ""
        echo "Exemplos:"
        echo "  $0 run                    # Inicia o servidor"
        echo "  $0 example /my/project    # Testa com projeto específico"
        echo "  $0 logs                   # Visualiza logs"
        echo ""
        ;;
esac
