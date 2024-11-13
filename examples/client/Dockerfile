FROM node:22-slim

WORKDIR /app

COPY examples/workload/package.json examples/workload/yarn.lock examples/workload/index.js .yarnrc.yml ./
COPY .yarn .yarn

RUN corepack enable
RUN yarn install

CMD ["node", "index.js"]
