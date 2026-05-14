FROM node:20-bookworm-slim AS builder

WORKDIR /app

COPY server/package*.json ./server/
COPY client/package*.json ./client/

RUN npm ci --prefix server
RUN npm ci --prefix client

COPY server ./server
COPY client ./client

RUN npm --prefix client run build

FROM node:20-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY server/package*.json ./server/
RUN npm ci --omit=dev --prefix server

COPY server ./server
COPY --from=builder /app/client/dist ./client/dist

EXPOSE 3001

CMD ["npm", "--prefix", "server", "start"]
