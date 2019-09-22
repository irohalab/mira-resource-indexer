# Indexer for Albireo

requirements: Postgres >= 9.5

Indexer can be configured to different modes: dmhy, Bangumi.moe

## For Dmhy

set the following environment variable.

- INDEXER_MODE what mode this indexer will work at. should be 'dmhy' for this case.
- DB_HOST host for postgres instance, default is `localhost`
- DB_PORT port for postgres, default is 5432
- DB_USER user for postgres access, default is `process.env.USER`
- DB_NAME database name, default is `dmhy_indexer`
- DB_PASS password for postgres access, default is 123456

## For bangumi.moe

set the following environment variable.

- INDEXER_MODE what mode this indexer will work at. should be 'bangumi_moe' for this case.
- DB_HOST host for postgres instance, default is `localhost`
- DB_PORT port for postgres, default is 5432
- DB_USER user for postgres access, default is `process.env.USER`
- DB_NAME database name, default is `bangumi_moe_indexer`
- DB_PASS password for postgres access, default is 123456

## Start from docker

### Setup Requirements

* Install [Docker](https://www.docker.com/community-edition#/download)

### Boot up

```
$ docker-compose up --build
```

To run it in background (detached mode), just add `-d` option
```
$ docker-compose up --build -d
```

Create a `main` container and enter bash:

```
$ docker-compose start pg
$ docker-compose run --no-deps --rm --service-ports main bash
node@add8121dc7c5:/irohalab/indexer$ npm run start
```
