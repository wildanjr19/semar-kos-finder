# syntax=docker/dockerfile:1

FROM node:20-slim AS builder
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next

RUN chown -R node:node /app

USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "const net=require('net');const s=net.connect(3001,'127.0.0.1');s.on('connect',()=>process.exit(0));s.on('error',()=>process.exit(1))"

CMD ["npm", "start"]
