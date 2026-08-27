FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/server/package.json apps/server/package.json
COPY packages/engine/package.json packages/engine/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN corepack pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN corepack pnpm prisma:generate
RUN corepack pnpm --filter @free-frees/server build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
COPY --from=build /app ./
EXPOSE 3000
CMD ["node", "apps/server/dist/index.js"]
