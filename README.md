# Mira Resource Indexer [![GitHub Actions status](https://github.com/irohalab/indexer/workflows/lint-and-unit-test/badge.svg)](https://github.com/irohalab/indexer)

A part of Project Mira

requirements: mongodb

Indexer can be configured to different modes: dmhy, Bangumi.moe, nyaa, acg.rip

## Set environment variables

- INDEXER_MODE what mode this indexer will work at. set `dmhy` or `bangumi_moe` or `nyaa` or `acg_rip`
- DB_HOST host for database instance, default is `mongo`
- DB_PORT port for database, default is `27017`
- DB_USER user for database access, default is `admin`
- DB_NAME database name, default is `dmhy_indexer`
- DB_PASS password for database access, default is 123456
- AUTH_SOURCE see https://docs.mongodb.com/manual/core/authentication/, default is `admin`
- SERVER_HOST the REST API server host, default is `0.0.0.0`
- MIN_INTERVAL the minimal time between two query on source site, default is `10000` millisecond
- MIN_CHECK_INTERVAL the minimal time between two query on list page of source site, default is `900000` millisecond
- MAX_PAGE_NO the scraping max page number, default is `5`
- MAX_SEARCH_COUNT the REST API search max result count, default is `100`
- SENTRY_DSN (optional) the dsn required for your sentry project. see the [Sentry](#Sentry) section

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
$ docker-compose start mongo
$ docker-compose run --no-deps --rm --service-ports main bash
node@add8121dc7c5:/irohalab/indexer$ npm run start
```

## Sentry

When deploy to test or production server. it's important to know the health of application. For example, you may need to
 know a unusual network issue caused by source sites or you may experience incorrect format of scrapped page. All of these
 information help you improve the application by analyzing data collected from error log.

Sentry is an easy to use SaaS error log collect and analytics service. We have already integrated with its SDK. all you
 need to do is registering your account and set up the environment variable SENTRY_DSN to your `dsn`. and wait for events.
