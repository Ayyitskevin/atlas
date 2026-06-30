FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN corepack enable && corepack pnpm install --frozen-lockfile

COPY . .

RUN corepack pnpm --filter @atlas/db exec prisma generate --schema prisma/schema.prisma \
  && corepack pnpm --filter @atlas/shared build \
  && corepack pnpm --filter @atlas/db build

EXPOSE 4000
