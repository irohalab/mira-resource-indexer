# Indexer for Albireo [![GitHub Actions status](https://github.com/irohalab/indexer/workflows/lint-and-unit-test/badge.svg)](https://github.com/irohalab/indexer)

requirements: Postgres >= 9.5

Indexer can be configured to different modes: dmhy, Bangumi.moe
Database can be configured two modes: postgres, mongo

## Set environment variables

- INDEXER_MODE what mode this indexer will work at. set `dmhy` or `bangumi_moe`
- DB_MODE for databse instance, default is `mongo`, you can select `postgres`
- DB_HOST host for database instance, default is `mongo`
- DB_PORT port for database, default is `27017`
- DB_USER user for database access, default is `admin`
- DB_NAME database name, default is `dmhy_indexer`
- DB_PASS password for postgres access, default is 123456

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
