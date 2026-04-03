# ── Stage 1: Build ──────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

# ── Stage 2: Production ──────────────────────────────
FROM node:20-alpine

# OCI стандарт metadata — build-arg-аар Jenkins дамжуулна
ARG APP_VERSION=dev
ARG BUILD_DATE
ARG GIT_COMMIT=unknown

LABEL org.opencontainers.image.title="DeployWatch" \
      org.opencontainers.image.description="CI/CD Deployment Dashboard" \
      org.opencontainers.image.version="${APP_VERSION}" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.revision="${GIT_COMMIT}" \
      org.opencontainers.image.authors="diploma-project"

WORKDIR /app

# Non-root user — аюулгүй байдлын тулд
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder /app/node_modules ./node_modules
COPY src/ ./src/
COPY public/ ./public/
COPY package.json ./

RUN mkdir -p /app/data && chown -R appuser:appgroup /app
USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "src/server.js"]
