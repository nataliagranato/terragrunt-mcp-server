#!/bin/bash

# Script para facilitar commits seguindo Conventional Commits
# Uso: ./scripts/commit.sh [tipo] [escopo] "mensagem"

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Tipos de commit válidos
VALID_TYPES=(
    "feat:Nova funcionalidade"
    "fix:Correção de bug"
    "docs:Alterações na documentação"
    "style:Mudanças de formatação, ponto e vírgula, etc"
    "refactor:Refatoração de código"
    "perf:Melhoria de performance"
    "test:Adição ou modificação de testes"
    "build:Mudanças no sistema de build"
    "ci:Mudanças nos arquivos de CI"
    "chore:Outras mudanças que não modificam src ou test"
    "revert:Reverte um commit anterior"
)

show_help() {
    echo -e "${BLUE}🚀 Script de Commit Convencional${NC}"
    echo ""
    echo "Uso: $0 [tipo] [escopo] \"mensagem\""
    echo ""
    echo -e "${YELLOW}Tipos disponíveis:${NC}"
    for type_desc in "${VALID_TYPES[@]}"; do
        type=$(echo "$type_desc" | cut -d: -f1)
        desc=$(echo "$type_desc" | cut -d: -f2)
        echo -e "  ${GREEN}$type${NC}: $desc"
    done
    echo ""
    echo -e "${YELLOW}Exemplos:${NC}"
    echo "  $0 feat mcp \"add new analyzer for stack validation\""
    echo "  $0 fix parser \"resolve HCL parsing issue with nested blocks\""
    echo "  $0 docs \"update installation instructions\""
    echo ""
}

validate_type() {
    local input_type="$1"
    for type_desc in "${VALID_TYPES[@]}"; do
        type=$(echo "$type_desc" | cut -d: -f1)
        if [[ "$type" == "$input_type" ]]; then
            return 0
        fi
    done
    return 1
}

interactive_mode() {
    echo -e "${BLUE}🚀 Modo Interativo - Commit Convencional${NC}"
    echo ""
    
    # Mostrar tipos disponíveis
    echo -e "${YELLOW}Tipos disponíveis:${NC}"
    for i in "${!VALID_TYPES[@]}"; do
        type_desc="${VALID_TYPES[$i]}"
        type=$(echo "$type_desc" | cut -d: -f1)
        desc=$(echo "$type_desc" | cut -d: -f2)
        printf "%2d) ${GREEN}%-10s${NC} %s\n" $((i+1)) "$type" "$desc"
    done
    echo ""
    
    # Selecionar tipo
    while true; do
        read -p "Selecione o tipo (1-${#VALID_TYPES[@]}): " type_num
        if [[ "$type_num" =~ ^[0-9]+$ ]] && [ "$type_num" -ge 1 ] && [ "$type_num" -le "${#VALID_TYPES[@]}" ]; then
            selected_type=$(echo "${VALID_TYPES[$((type_num-1))]}" | cut -d: -f1)
            break
        else
            echo -e "${RED}❌ Seleção inválida. Tente novamente.${NC}"
        fi
    done
    
    # Escopo (opcional)
    read -p "Escopo (opcional, ex: mcp, parser, docs): " scope
    
    # Mensagem
    while true; do
        read -p "Mensagem do commit: " message
        if [[ -n "$message" ]]; then
            break
        else
            echo -e "${RED}❌ Mensagem não pode estar vazia.${NC}"
        fi
    done
    
    # Construir mensagem de commit
    if [[ -n "$scope" ]]; then
        commit_msg="${selected_type}(${scope}): ${message}"
    else
        commit_msg="${selected_type}: ${message}"
    fi
    
    echo ""
    echo -e "${YELLOW}Mensagem do commit:${NC} $commit_msg"
    echo ""
    
    # Confirmar
    read -p "Confirmar commit? (y/N): " confirm
    if [[ "$confirm" =~ ^[Yy]$ ]]; then
        git add .
        git commit -m "$commit_msg"
        echo -e "${GREEN}✅ Commit realizado com sucesso!${NC}"
    else
        echo -e "${YELLOW}⚠️  Commit cancelado.${NC}"
        exit 1
    fi
}

# Verificar argumentos
if [[ $# -eq 0 ]]; then
    interactive_mode
    exit 0
fi

if [[ "$1" == "-h" ]] || [[ "$1" == "--help" ]]; then
    show_help
    exit 0
fi

if [[ $# -lt 2 ]]; then
    echo -e "${RED}❌ Argumentos insuficientes.${NC}"
    show_help
    exit 1
fi

# Validar tipo
commit_type="$1"
if ! validate_type "$commit_type"; then
    echo -e "${RED}❌ Tipo '$commit_type' inválido.${NC}"
    show_help
    exit 1
fi

# Construir mensagem
if [[ $# -eq 3 ]]; then
    # Com escopo: tipo(escopo): mensagem
    scope="$2"
    message="$3"
    commit_msg="${commit_type}(${scope}): ${message}"
elif [[ $# -eq 2 ]]; then
    # Sem escopo: tipo: mensagem
    message="$2"
    commit_msg="${commit_type}: ${message}"
else
    echo -e "${RED}❌ Muitos argumentos.${NC}"
    show_help
    exit 1
fi

# Realizar commit
echo -e "${YELLOW}Adicionando arquivos...${NC}"
git add .

echo -e "${YELLOW}Fazendo commit...${NC}"
git commit -m "$commit_msg"

echo -e "${GREEN}✅ Commit realizado: $commit_msg${NC}"
