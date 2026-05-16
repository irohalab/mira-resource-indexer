FROM node:lts-slim AS base
WORKDIR /irohalab/indexer

FROM base AS dev
COPY package.json package-lock.json ./
RUN npm ci
RUN mkdir dist
COPY . .

FROM dev AS prod
RUN npm run build
