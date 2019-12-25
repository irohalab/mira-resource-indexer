# Indexer for Albireo [![GitHub Actions status](https://github.com/irohalab/indexer/workflows/lint-and-unit-test/badge.svg)](https://github.com/irohalab/indexer)

requirements: mongodb

Indexer can be configured to different modes: dmhy, Bangumi.moe

## Set environment variables

- INDEXER_MODE what mode this indexer will work at. set `dmhy` or `bangumi_moe`
- DB_HOST host for database instance, default is `mongo`
- DB_PORT port for database, default is `27017`
- DB_USER user for database access, default is `admin`
- DB_NAME database name, default is `dmhy_indexer`
- DB_PASS password for postgres access, default is 123456
- AUTH_SOURCE see https://docs.mongodb.com/manual/core/authentication/
- SERVER_HOST the REST API server host, default is `0.0.0.0`
- MIN_INTERVAL the minimal time between two query on source site
- MIN_CHECK_INTERVAL the minimal time between two query on list page of source site

## Start from docker

### Setup Requirements

* Install [Docker](https://www.docker.com/community-edition#/download)

### Boot up

You can start container by:

- Start all service defined in docker-compose.yml using docker-compose up

```
$ docker-compose up --build
```
To run it in background (detached mode), just add `-d` option
```
$ docker-compose up --build -d
```

- Run `main` container in bash mode

```
$ docker-compose start pg
$ docker-compose run --no-deps --rm --service-ports main bash
node@add8121dc7c5:/irohalab/indexer$ npm run start
```
