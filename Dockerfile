FROM node:22-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist

# workspace/ is a Docker volume — don't bake it into the image
RUN mkdir -p /data/workspace /data/db

EXPOSE 3000
VOLUME ["/data/workspace", "/data/db"]

CMD ["node", "dist/index.js"]
