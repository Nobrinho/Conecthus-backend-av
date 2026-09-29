# syntax=docker/dockerfile:1

# ----------------------------------------------------------------- deps
# Dependências completas (dev incluídas) para compilar o projeto.
# `--ignore-scripts` impede que o postinstall rode aqui; o `prisma generate`
# acontece no estágio seguinte, quando o schema já está no contexto.
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# ---------------------------------------------------------------- build
# Gera o Prisma Client e compila o TypeScript. Esta imagem também é a que o
# docker-compose usa para aplicar as migrations, porque tem a CLI do Prisma.
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

# ------------------------------------------------------------ prod-deps
# Só o que o runtime precisa. Instalado a partir do lockfile, então a imagem
# final é reprodutível e não carrega compilador nem ferramenta de teste.
#
# `--omit=optional` é o que corta de verdade: `@prisma/client` declara a CLI do
# Prisma e o TypeScript como peers opcionais, e sem essa flag o npm os mantém
# mesmo com `--omit=dev`, somando centenas de megabytes à imagem.
FROM node:22-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --omit=optional --ignore-scripts

# --------------------------------------------------------------- runner
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# tini como PID 1 encaminha o SIGTERM para o Node e recolhe processos órfãos,
# o que faz o desligamento gracioso do Nest realmente acontecer.
RUN apk add --no-cache tini

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main.js"]
