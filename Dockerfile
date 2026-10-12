FROM node:22.17.0-bookworm-slim AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.1.1 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY . .
RUN pnpm install --frozen-lockfile --ignore-scripts && pnpm build
RUN mkdir -p /app/data && chown node:node /app/data
USER node
ENV API_HOST=0.0.0.0
EXPOSE 8787
CMD ["pnpm", "api"]
