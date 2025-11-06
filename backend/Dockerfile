# syntax=docker/dockerfile:1
FROM node:20-bullseye-slim AS base

WORKDIR /app

# Copy package files from backend directory
COPY backend/package*.json ./
RUN npm ci --omit=dev

# Copy backend source
COPY backend/src ./src

# Copy docs directory for API documentation
COPY docs ./docs

ENV NODE_ENV=production
EXPOSE 4000

CMD ["node", "src/server.js"]
