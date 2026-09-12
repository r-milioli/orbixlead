FROM node:26-alpine AS base
RUN apk add --no-cache openssl libc6-compat
RUN corepack enable && corepack prepare pnpm@11.22.0 --activate
WORKDIR /app

FROM base AS deps
RUN apk add --no-cache python3 make g++
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
RUN pnpm install --filter @orbixlead/api... --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
ENV DATABASE_URL="postgresql://orbixlead:orbixlead@localhost:5432/orbixlead?schema=public"
RUN pnpm --filter @orbixlead/shared build
RUN pnpm --filter @orbixlead/api prisma:generate
RUN pnpm --filter @orbixlead/api build

FROM base AS runner
ENV NODE_ENV=production
ENV API_PORT=4000
COPY --from=build /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/shared ./packages/shared
COPY --from=build /app/apps/api/package.json ./apps/api/
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma/schema.prisma ./apps/api/prisma/schema.prisma
COPY --from=build /app/apps/api/prisma/migrations ./apps/api/prisma/migrations
COPY --from=build /app/apps/api/docker-entrypoint.sh ./apps/api/docker-entrypoint.sh
WORKDIR /app/apps/api
RUN sed -i 's/\r$//' docker-entrypoint.sh && chmod +x docker-entrypoint.sh
# INFRA-01: roda como usuário não-root (o usuário `node` já existe na imagem oficial).
USER node
EXPOSE 4000
CMD ["./docker-entrypoint.sh"]
