# ──────────────────────────────────────
# Stage 1: Build
# ──────────────────────────────────────
FROM node:24-alpine AS builder

WORKDIR /app

# Copy package files first for layer caching
COPY package.json package-lock.json ./

RUN npm ci

# Copy source files
COPY tsconfig.json ./
COPY src/ ./src/
COPY convex/ ./convex/

# Build TypeScript
RUN npm run build

# ──────────────────────────────────────
# Stage 2: Production
# ──────────────────────────────────────
FROM node:24-alpine AS production

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S botuser && \
    adduser -S botuser -u 1001

# Copy package files and install production deps only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy built files
COPY --from=builder /app/dist ./dist

# Copy convex for API types (needed at runtime by ConvexHttpClient)
COPY --from=builder /app/convex ./convex

# Switch to non-root user
USER botuser

# Health check (process is alive)
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD node -e "process.exit(0)"

CMD ["node", "dist/src/index.js"]
