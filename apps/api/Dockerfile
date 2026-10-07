FROM node:22-alpine AS build

WORKDIR /app

COPY package.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/pokedata-normalization/package.json packages/pokedata-normalization/package.json

RUN npm install

COPY apps/api apps/api
COPY packages/pokedata-normalization packages/pokedata-normalization

RUN npm run --workspace @poke-event-alert/api typecheck
RUN npm run --workspace @poke-event-alert/api build

FROM node:22-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
ENV HOST=0.0.0.0

COPY package.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/pokedata-normalization/package.json packages/pokedata-normalization/package.json

RUN npm install --omit=dev

COPY --from=build /app/apps/api/dist /app/apps/api/dist
COPY apps/api/migrations /app/apps/api/migrations
COPY packages/pokedata-normalization packages/pokedata-normalization

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/health >/dev/null 2>&1 || exit 1

CMD ["node", "apps/api/dist/cli/serve.js"]
