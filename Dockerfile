FROM node:24-alpine AS builder
RUN npm i -g pnpm@11

WORKDIR /app

# Workspace manifests first (maximizes Docker layer cache)
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc ./
COPY packages/shared/package.json  ./packages/shared/
COPY packages/backend/package.json ./packages/backend/

RUN pnpm install --frozen-lockfile

# Source
COPY tsconfig.base.json ./
COPY packages/shared  ./packages/shared
COPY packages/backend ./packages/backend

RUN pnpm --filter @quiz/shared build
RUN pnpm --filter @quiz/backend build

# Produce a standalone deployment with a flat, complete node_modules
RUN pnpm --filter @quiz/backend deploy --prod /deploy

FROM node:24-alpine
WORKDIR /app
COPY --from=builder /deploy/node_modules ./node_modules
COPY --from=builder /app/packages/backend/dist ./dist
EXPOSE 3000
CMD ["node", "dist/main.js"]
