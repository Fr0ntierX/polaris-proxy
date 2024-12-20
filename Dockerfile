FROM node:22-slim AS dependencies-production

WORKDIR /app

COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn .yarn

RUN corepack enable
RUN NODE_ENV=production yarn install



FROM node:22-slim AS build

WORKDIR /app

COPY package.json yarn.lock .yarnrc.yml tsconfig.json ./
COPY .yarn .yarn
COPY src src

RUN corepack enable
RUN yarn install
RUN yarn build 



FROM gcr.io/distroless/nodejs22-debian12 AS release

WORKDIR /app

COPY --from=dependencies-production /app/node_modules /app/node_modules
COPY --from=build /app/dist /app/dist

EXPOSE 3000

CMD ["dist/src/index.js"]
