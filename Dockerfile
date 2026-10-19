# CREW CAR — imagem de produção
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 STORAGE_LOCAL_DIR=/data/storage
RUN groupadd -r crewcar && useradd -r -g crewcar crewcar && mkdir -p /data/storage && chown -R crewcar:crewcar /data
COPY --from=build --chown=crewcar:crewcar /app ./
USER crewcar
EXPOSE 3000
VOLUME ["/data/storage"]
CMD ["npx", "next", "start", "-p", "3000"]
