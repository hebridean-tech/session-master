FROM node:22-slim AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-slim
WORKDIR /app
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/build ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/drizzle.config.ts ./

EXPOSE 3000
ENV HOST=0.0.0.0 PORT=3000
ENV DATABASE_URL="postgres://postgres@localhost:5432/session_master"
ENV BETTER_AUTH_URL="https://session.projectveritos.com"
ENV BETTER_AUTH_SECRET=""

CMD ["node", "build"]
