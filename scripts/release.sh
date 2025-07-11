#!/bin/bash

# Script para criar releases manuais
# Uso: ./scripts/release.sh [major|minor|patch] [opcional: tag personalizada]

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

show_help() {
    echo -e "${BLUE}🚀 Script de Release${NC}"
    echo ""
    echo "Uso: $0 [major|minor|patch] [tag_personalizada]"
    echo ""
    echo -e "${YELLOW}Tipos de release:${NC}"
    echo -e "  ${GREEN}major${NC}:  Mudanças incompatíveis (1.0.0 -> 2.0.0)"
    echo -e "  ${GREEN}minor${NC}:  Nova funcionalidade compatível (1.0.0 -> 1.1.0)"
    echo -e "  ${GREEN}patch${NC}:  Correção de bug (1.0.0 -> 1.0.1)"
    echo ""
    echo -e "${YELLOW}Exemplos:${NC}"
    echo "  $0 patch"
    echo "  $0 minor"
    echo "  $0 major"
    echo "  $0 patch v1.0.1-hotfix"
    echo ""
}

check_git_status() {
    if [[ -n $(git status --porcelain) ]]; then
        echo -e "${RED}❌ Há mudanças não commitadas. Commit ou stash antes de criar release.${NC}"
        git status --short
        exit 1
    fi
}

get_current_version() {
    if [[ -f "package.json" ]]; then
        node -p "require('./package.json').version"
    else
        echo "0.0.0"
    fi
}

bump_version() {
    local current_version="$1"
    local bump_type="$2"
    
    IFS='.' read -ra VERSION_PARTS <<< "$current_version"
    local major=${VERSION_PARTS[0]}
    local minor=${VERSION_PARTS[1]}
    local patch=${VERSION_PARTS[2]}
    
    case "$bump_type" in
        "major")
            major=$((major + 1))
            minor=0
            patch=0
            ;;
        "minor")
            minor=$((minor + 1))
            patch=0
            ;;
        "patch")
            patch=$((patch + 1))
            ;;
    esac
    
    echo "${major}.${minor}.${patch}"
}

update_package_version() {
    local new_version="$1"
    if [[ -f "package.json" ]]; then
        npm version "$new_version" --no-git-tag-version
    fi
}

run_tests() {
    echo -e "${YELLOW}🧪 Executando testes...${NC}"
    if ! npm test; then
        echo -e "${RED}❌ Testes falharam. Abortando release.${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Testes passaram!${NC}"
}

build_project() {
    echo -e "${YELLOW}🏗️ Fazendo build...${NC}"
    if ! npm run build; then
        echo -e "${RED}❌ Build falhou. Abortando release.${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Build concluído!${NC}"
}

create_changelog_entry() {
    local version="$1"
    local date=$(date '+%Y-%m-%d')
    
    # Backup do changelog atual
    cp CHANGELOG.md CHANGELOG.md.bak
    
    # Criar nova entrada no changelog
    cat > temp_changelog.md << EOF
# CHANGELOG

Todas as mudanças notáveis ​​neste projeto serão documentadas neste arquivo.

O formato é baseado em [Mantenha um Changelog](https://keepachangelog.com/pt-BR/1.1.0/)
e este projeto adere a [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [${version}] - ${date}

### Changed
- Release ${version}

EOF
    
    # Adicionar conteúdo existente (pular as primeiras 6 linhas do cabeçalho)
    tail -n +7 CHANGELOG.md.bak >> temp_changelog.md
    mv temp_changelog.md CHANGELOG.md
    rm CHANGELOG.md.bak
}

create_git_tag() {
    local version="$1"
    local tag_name="v${version}"
    
    # Commit das mudanças
    git add .
    git commit -m "chore(release): ${version}"
    
    # Criar tag
    git tag -a "$tag_name" -m "Release ${version}"
    
    echo -e "${GREEN}✅ Tag ${tag_name} criada!${NC}"
}

push_changes() {
    local tag_name="$1"
    
    echo -e "${YELLOW}🚀 Enviando para repositório remoto...${NC}"
    git push origin main
    git push origin "$tag_name"
    echo -e "${GREEN}✅ Release enviado para GitHub!${NC}"
}

main() {
    if [[ $# -eq 0 ]] || [[ "$1" == "-h" ]] || [[ "$1" == "--help" ]]; then
        show_help
        exit 0
    fi
    
    local bump_type="$1"
    local custom_tag="$2"
    
    # Validar tipo de bump
    if [[ ! "$bump_type" =~ ^(major|minor|patch)$ ]]; then
        echo -e "${RED}❌ Tipo de release inválido: $bump_type${NC}"
        show_help
        exit 1
    fi
    
    echo -e "${BLUE}🚀 Iniciando processo de release...${NC}"
    
    # Verificações
    check_git_status
    
    # Obter versão atual
    local current_version
    current_version=$(get_current_version)
    echo -e "${YELLOW}📦 Versão atual: ${current_version}${NC}"
    
    # Calcular nova versão
    local new_version
    if [[ -n "$custom_tag" ]]; then
        new_version="${custom_tag#v}"  # Remove 'v' prefix if present
    else
        new_version=$(bump_version "$current_version" "$bump_type")
    fi
    
    echo -e "${YELLOW}📦 Nova versão: ${new_version}${NC}"
    
    # Confirmar
    read -p "Continuar com release v${new_version}? (y/N): " confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}⚠️ Release cancelado.${NC}"
        exit 0
    fi
    
    # Executar testes
    run_tests
    
    # Fazer build
    build_project
    
    # Atualizar package.json
    if [[ -f "package.json" ]]; then
        update_package_version "$new_version"
    fi
    
    # Atualizar changelog
    create_changelog_entry "$new_version"
    
    # Criar tag Git
    create_git_tag "$new_version"
    
    # Push para repositório
    read -p "Enviar para repositório remoto? (y/N): " push_confirm
    if [[ "$push_confirm" =~ ^[Yy]$ ]]; then
        push_changes "v${new_version}"
        echo ""
        echo -e "${GREEN}🎉 Release v${new_version} criado com sucesso!${NC}"
        echo -e "${BLUE}🔗 Acesse: https://github.com/nataliagranato/terragrunt-mcp-server/releases/tag/v${new_version}${NC}"
    else
        echo -e "${YELLOW}⚠️ Release criado localmente. Use 'git push origin main && git push origin v${new_version}' para enviar.${NC}"
    fi
}

main "$@"
