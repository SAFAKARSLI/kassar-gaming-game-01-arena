# Game server container (Colyseus). Build context = repo root.
# Used by Railway (auto-detected) and Render (see render.yaml).
FROM node:22-alpine
WORKDIR /app

# Install workspace deps first for better layer caching.
# --ignore-scripts skips the root postinstall (which needs sources not yet copied).
COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
COPY apps/client/package.json apps/client/
RUN npm install --ignore-scripts

# Copy sources and build the shared package + server.
COPY packages/shared packages/shared
COPY apps/server apps/server
RUN npm run build:shared && npm run build -w @arena/server

ENV NODE_ENV=production
# Railway/Render inject PORT; the server reads it (defaults to 2567).
EXPOSE 2567
CMD ["node", "apps/server/dist/index.js"]
