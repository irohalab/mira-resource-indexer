FROM ghcr.io/puppeteer/puppeteer:latest AS base
WORKDIR /irohalab/indexer

FROM base AS dev
USER root
RUN chown -R node:node /irohalab/indexer
RUN usermod -a -G audio,video node
USER node
COPY package.json package-lock.json ./
RUN npm ci
RUN mkdir dist
COPY --chown=node:node . .

FROM dev AS prod
RUN npm run build
