# Multi-stage build. The Playwright base ships Chromium + system libs the
# browser tools need. ~700 MB base — tolerable for Cloud Run.
FROM mcr.microsoft.com/playwright:v1.59.1-jammy AS base
WORKDIR /app

FROM base AS deps
COPY package*.json ./
RUN npm ci --omit=dev

FROM base AS build
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM base AS runtime
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/workspace.example ./workspace.example
# Defence-in-depth: drop root before running the agent process.
RUN useradd -m -u 1000 agent && chown -R agent:agent /app
USER agent
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080
CMD ["node", "dist/index.js"]
