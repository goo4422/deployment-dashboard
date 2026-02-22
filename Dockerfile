# ── Stage 1: Build ──────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Эхлээд package.json copy хийнэ (cache ашиглахын тулд)
COPY package*.json ./
RUN npm ci --only=production

# ── Stage 2: Production ──────────────────────────────
FROM node:20-alpine

WORKDIR /app

# Non-root user аюулгүй байдлын тулд
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Build stage-аас файл авна
COPY --from=builder /app/node_modules ./node_modules
COPY src/ ./src/
COPY public/ ./public/
COPY package.json ./

# Эзэмшлийг appuser-д өгнө
RUN chown -R appuser:appgroup /app
USER appuser

# Port нээнэ
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "src/server.js"]
