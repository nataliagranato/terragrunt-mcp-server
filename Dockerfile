# Multi-stage build para otimizar o tamanho da imagem
FROM node:18-alpine AS builder

# Instalar dependências necessárias para build
RUN apk add --no-cache git

# Definir diretório de trabalho
WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./
COPY tsconfig.json ./

# Instalar todas as dependências (incluindo devDependencies para build)
RUN npm ci && npm cache clean --force

# Copiar código fonte
COPY src/ ./src/

# Build do projeto
RUN npm run build

# Stage final - imagem de produção
FROM node:18-alpine AS production

# Criar usuário não-root para segurança
RUN addgroup -g 1001 -S terragrunt && \
    adduser -S terragrunt -u 1001

# Instalar dependências do sistema
RUN apk add --no-cache \
    git \
    curl \
    && rm -rf /var/cache/apk/*

# Definir diretório de trabalho
WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./

# Instalar apenas dependências de produção
RUN npm ci --only=production && npm cache clean --force

# Copiar build do stage anterior
COPY --from=builder /app/dist ./dist

# Copiar exemplos (opcional)
COPY examples/ ./examples/

# Mudar ownership para usuário não-root
RUN chown -R terragrunt:terragrunt /app

# Usar usuário não-root
USER terragrunt

# Expor informações sobre a aplicação
LABEL maintainer="Terragrunt MCP Server" \
      version="1.0.0" \
      description="Model Context Protocol server for Terragrunt 0.82.3 analysis"

# Variáveis de ambiente
ENV NODE_ENV=production
ENV LOG_LEVEL=info

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "console.log('MCP Server is healthy')" || exit 1

# Comando padrão para executar o servidor MCP
CMD ["node", "dist/index.js"]
