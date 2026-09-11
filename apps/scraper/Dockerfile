# Playwright já inclui Chromium e as dependências do sistema.
# Manter a tag alinhada com a versão do playwright em package.json.
FROM mcr.microsoft.com/playwright:v1.51.0-noble

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

RUN corepack enable && corepack prepare pnpm@11.22.0 --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/scraper/package.json ./apps/scraper/

RUN pnpm install --filter @orbixlead/scraper... --frozen-lockfile

COPY packages/shared ./packages/shared
COPY apps/scraper ./apps/scraper

RUN pnpm --filter @orbixlead/shared build \
  && pnpm --filter @orbixlead/scraper build

WORKDIR /app/apps/scraper

# concurrency=1 no código; um container = um worker
CMD ["node", "dist/index.js"]
