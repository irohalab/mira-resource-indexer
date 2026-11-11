# CHANG LOG

## 3.0.2
Update dependencies:
- puppeteer-core 25.17.0
- mongodb 7.8.0

Update Node.js version to 24 in both workflow and Dockerfile.

Update local dev docker-compose Mongodb service to Mongodb 8.

### MongoDB storage and operation

The `mongo` service runs MongoDB **8.0.34**, uses the persistent
`mongo_data_v8` volume, and listens only on the host's
`127.0.0.1:${DB_PORT:-27017}`. With the default Compose project name, the
Docker volume is `indexer_mongo_data_v8`. Because the services use host
networking, `mongo` is not a Docker DNS hostname for the application.

MongoDB 8.0 is supported through October 2029. The image is pinned to an
exact patch; apply tested 8.0 patch updates regularly. The health check uses
`mongosh`, since modern MongoDB images no longer include the legacy `mongo`
shell.

Authentication remains disabled to preserve the existing local development
deployment. Existing users and credentials are preserved, and no different
administrator is initialized. Clients that explicitly authenticate must
still use valid existing credentials. Do not expose this unauthenticated
service on external interfaces.

Start only MongoDB when RabbitMQ already runs elsewhere on the host:

```bash
docker compose up -d --no-deps --wait mongo
docker compose ps mongo
docker compose exec -T mongo mongosh --quiet --host 127.0.0.1 --eval \
  'db.getSiblingDB("admin").runCommand({ getParameter: 1, featureCompatibilityVersion: 1 })'
```

The feature compatibility version (FCV) should be `8.0`. Keep the native
`mongod` service stopped and disabled to avoid competing for port 27017.

For a full logical backup, pause writers and use the tools bundled with the
current image rather than old host-installed MongoDB tools:

```bash
umask 077
backup_dir="$HOME/backups/mongodb/8.0-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$backup_dir"
docker compose exec -T mongo mongodump --host 127.0.0.1 --port 27017 \
  --gzip --archive >"$backup_dir/mongodb.archive.gz"
sha256sum "$backup_dir/mongodb.archive.gz" >"$backup_dir/mongodb.archive.gz.sha256"
```

The archive includes application data, indexes, users, and roles, but not
the `local` database. Protect it because it contains credential hashes.
A standalone server does not support `mongodump --oplog`; writes must be
paused for a consistent backup. Copy backups outside the VM before an OS
upgrade, and never run `docker compose down -v` or prune the data volume.

### Upgrading or migrating older MongoDB data

The development database was upgraded using this sequence:

```text
4.4.24 -> 4.4.30 -> 5.0.33 -> 6.0.28 -> 7.0.45 -> 8.0.34
```

Each major version must be upgraded in sequence with a compatible driver.
Before proceeding to the next major version:

1. Pause all writers and take a current logical backup.
2. Stop the current database cleanly. Make a cold backup and upgrade a copy
   of the data volume, retaining the original for rollback.
3. Start the next version on a staging port such as 27018 and verify the
   server version and current FCV.
4. Fully validate collections and compare document contents, indexes,
   collection options/UUIDs, and users/roles against the original baseline.
   Exclude transient internal `config`/`local` state and the FCV system
   collection from data comparisons.
5. Advance FCV to that major version only after validation succeeds.
   MongoDB 7.0 and newer require `confirm: true`, for example:

   ```javascript
   db.adminCommand({ setFeatureCompatibilityVersion: "8.0", confirm: true })
   ```

6. Verify the new FCV and data again, take a stage backup, and confirm a
   clean shutdown before changing binaries again.
7. After the final stage, persist the new image, volume, and health check
   in [docker-compose.yml](./docker-compose.yml), switch back to port
   27017, and verify application access before resuming writers.

For a new migration from a 4.4 host, first restore into a matching 4.4
container and then follow the sequential upgrade process. Do not mount
4.4 data files into the current 8.0 image or restore a 4.4 archive directly
into 8.0. See the official [standalone upgrade procedure](https://www.mongodb.com/docs/v8.0/release-notes/8.0-upgrade-standalone/).

### Pre-upgrade rollback

The original `indexer_mongo_data` volume was retained separately and was
not opened by newer MongoDB binaries. A cold archive and the original
`pre-upgrade-compose.yml` configuration are saved with the upgrade backups.

Before accepting new writes, stop the upgraded service and use that saved
configuration with the original project directory and project name:

```bash
docker compose stop mongo
docker compose --project-name indexer --project-directory "$PWD" \
  -f /absolute/path/to/pre-upgrade-compose.yml \
  up -d --no-deps --wait mongo
```

Run these commands from the indexer project directory and replace the
backup path with the actual saved file. This starts 4.4.24 against its
original volume, not the upgraded `mongo_data_v8` volume.

Never downgrade by changing only the image while retaining upgraded data
files. After accepting writes on 8.0, the original volume is stale; rollback
requires a separate, compatible data migration to avoid losing new writes.
