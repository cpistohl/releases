FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# Build CSS (needs devDependencies for tailwind)
FROM base AS build
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run css

# Production image
FROM base AS runtime
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
# Copy built CSS last so it overwrites the source copy
COPY --from=build /app/src/client/compiled.css ./src/client/compiled.css

ENV NODE_ENV=production
EXPOSE 3000

CMD ["bun", "run", "src/server/server.ts"]
