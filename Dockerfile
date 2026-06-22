FROM node:20-alpine AS builder

WORKDIR /app

# Copy package manifests for workspace
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/shared/package*.json ./packages/shared/

# Install dependencies
RUN npm ci

# Copy source code
COPY packages/shared/ ./packages/shared/
COPY apps/api/ ./apps/api/

# Build shared packages
RUN npm run build:shared

FROM node:20-alpine

WORKDIR /app

# Copy built workspace and node_modules from builder
COPY --from=builder /app /app

EXPOSE 3001

ENV PORT=3001
ENV HOST=0.0.0.0
ENV FEATURE_ENABLE_AUTH=false

WORKDIR /app/apps/api

CMD ["node", "index.js"]
