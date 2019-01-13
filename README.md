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