FROM node:20-alpine AS builder
RUN npm i -g pnpm@11

WORKDIR /app

# Workspace manifests first (maximizes Docker layer cache)
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc ./
COPY packages/shared/package.json  ./packages/shared/
COPY packages/backend/package.json ./packages/backend/

RUN pnpm install --frozen-lockfile

# Source
COPY packages/shared  ./packages/shared
COPY packages/backend ./packages/backend

RUN pnpm --filter @quiz/backend build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/packages/backend/dist ./dist
COPY --from=builder /app/node_modules          ./node_modules
EXPOSE 3000
CMD ["node", "dist/main.js"]
