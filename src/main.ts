/*
 * Copyright 2020 IROHA LAB
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import 'reflect-metadata';
import { Container, interfaces } from 'inversify';
import { BangumiMoe } from './scraper/bangumi-moe';
import { NyaaScraper } from './scraper/nyaa';
import { AcgRipScraper } from './scraper/acg-rip';
import { RESTServer } from './server';
import { DatabaseService } from './service/database-service';
import { MongoClientProvider } from './service/mongo-client-provider';
import { MongodbItemStore } from './storage/mongodb-item-store';
import { MongodbTaskStore } from './storage/mongodb-task-store';
import { TaskOrchestra } from './task/task-orchestra';
import { TaskTiming } from './task/task-timing';
import { EventLogStore, ItemStorage, Scraper, TaskQueue, ThrottleStore, TYPES_IDX } from './TYPES_IDX';
import './rest-api/items-query';
import { logger } from './utils/logger-factory';
import { MongodbThrottleStore } from './storage/mongodb-throttle-store';
import { RabbitMQService, Sentry, SentryImpl, TYPES } from '@irohalab/mira-shared';
import { RascalImpl } from '@irohalab/mira-shared/services/RascalImpl';
import { ConfigManagerImpl } from './utils/config-manager-impl';
import { ACG_RIP, BANGUMI_MOE, ConfigManager, DMHY, MIKANANI_ME, NYAA } from './utils/config-manager';
import { hostname } from 'os';
import { MongodbEventLogStore } from './storage/mongodb-event-log-store';
import { MikananiMeLight } from './scraper/mikanani-me-light';
import { DmhyLightScraper } from './scraper/dmhy-light';
import { AsyncMutex } from './utils/async-mutex';
import { ScraperCoordinator } from './task/scraper-coordinator';
import { MQControlAPIClient } from './utils/mq-control-api-client';
import { RabbitMQManagementAPIClient } from './utils/rabbitmq-management-api-client';
import { LavinMQManagementAPIClient } from './utils/lavinmq-management-api-client';
import { AMQPServerType } from './utils/amqp-server-type';

/* ===== Root container: shared infrastructure only ===== */
const container = new Container();
container.bind<ConfigManager>(TYPES.ConfigManager).to(ConfigManagerImpl).inSingletonScope();

const config = container.get<ConfigManager>(TYPES.ConfigManager);

// tslint:disable-next-line
const { version } = require('../package.json');
container.bind<Sentry>(TYPES.Sentry).to(SentryImpl).inSingletonScope();
const sentry = container.get<Sentry>(TYPES.Sentry);

sentry.setup(`${hostname()}`, 'indexer', version);

/* Shared MongoClient (single connection pool for all modes) */
container.bind<MongoClientProvider>(MongoClientProvider).toSelf().inSingletonScope();

/* Shared message queue (single AMQP connection) */
container.bind<RabbitMQService>(TYPES.RabbitMQService).to(RascalImpl).inSingletonScope();

/* Shared task timing factory */
container.bind<interfaces.Factory<number>>(TYPES_IDX.TaskTimingFactory).toFactory<number>(TaskTiming);

/* Shared AsyncMutex: ensures only one scraper task runs at a time */
container.bind<AsyncMutex>(TYPES_IDX.AsyncMutex).to(AsyncMutex).inSingletonScope();

/* MQ management API client for queue depth checks */
if (config.getAmqpServerType() === AMQPServerType.LavinMQ) {
    container.bind<MQControlAPIClient>(TYPES_IDX.MQControlAPIClient).to(LavinMQManagementAPIClient).inSingletonScope();
} else {
    container.bind<MQControlAPIClient>(TYPES_IDX.MQControlAPIClient).to(RabbitMQManagementAPIClient).inSingletonScope();
}

/* ===== Child containers: one per mode with ALL mode-dependent services ===== */
const modes = config.getModeList();
const childContainers: Container[] = [];

for (const mode of modes) {
    const child = container.createChild();

    /* Mode identifier */
    child.bind<string>(TYPES_IDX.Mode).toConstantValue(mode);
    child.bind<string>(TYPES_IDX.DBName).toConstantValue(`${mode}_indexer`);

    /* Per-mode database service (shares MongoClient from parent) */
    child.bind<DatabaseService>(DatabaseService).toSelf().inSingletonScope();

    /* Per-mode storage (each operates on its own database) */
    child.bind<TaskQueue>(TYPES_IDX.TaskStorage).to(MongodbTaskStore).inSingletonScope();
    child.bind<ThrottleStore>(TYPES_IDX.ThrottleStore).to(MongodbThrottleStore).inSingletonScope();
    child.bind<EventLogStore>(TYPES_IDX.EventLogStore).to(MongodbEventLogStore).inSingletonScope();

    /* Per-mode task orchestration */
    child.bind<TaskOrchestra>(TaskOrchestra).toSelf().inSingletonScope();

    /* Per-mode scraper + item storage */
    switch (mode) {
        case DMHY:
            child.bind<ItemStorage<number>>(TYPES_IDX.ItemStorage).to(MongodbItemStore).inSingletonScope();
            child.bind<Scraper>(TYPES_IDX.Scraper).to(DmhyLightScraper).inSingletonScope();
            break;
        case BANGUMI_MOE:
            child.bind<ItemStorage<string>>(TYPES_IDX.ItemStorage).to(MongodbItemStore).inSingletonScope();
            child.bind<Scraper>(TYPES_IDX.Scraper).to(BangumiMoe).inSingletonScope();
            break;
        case NYAA:
            child.bind<ItemStorage<number>>(TYPES_IDX.ItemStorage).to(MongodbItemStore).inSingletonScope();
            child.bind<Scraper>(TYPES_IDX.Scraper).to(NyaaScraper).inSingletonScope();
            break;
        case ACG_RIP:
            child.bind<ItemStorage<number>>(TYPES_IDX.ItemStorage).to(MongodbItemStore).inSingletonScope();
            child.bind<Scraper>(TYPES_IDX.Scraper).to(AcgRipScraper).inSingletonScope();
            break;
        case MIKANANI_ME:
            child.bind<ItemStorage<string>>(TYPES_IDX.ItemStorage).to(MongodbItemStore).inSingletonScope();
            child.bind<Scraper>(TYPES_IDX.Scraper).to(MikananiMeLight).inSingletonScope();
            break;
        default:
            throw new Error('Mode is not supported yet');
    }

    childContainers.push(child);
}

/* ===== Build the coordinator from all child containers ===== */
const coordinator = new ScraperCoordinator();
const itemStorageMap = new Map<string, ItemStorage<any>>();
for (let i = 0; i < modes.length; i++) {
    const scraper = childContainers[i].get<Scraper>(TYPES_IDX.Scraper);
    coordinator.addScraper(modes[i], scraper);
    itemStorageMap.set(modes[i], childContainers[i].get<ItemStorage<any>>(TYPES_IDX.ItemStorage));
}

/* Bind the storage map in root container for REST API */
container.bind<Map<string, ItemStorage<any>>>(TYPES_IDX.ItemStorageMap).toConstantValue(itemStorageMap);

const mongoClientProvider = container.get<MongoClientProvider>(MongoClientProvider);

process.on('unhandledRejection', (reason) => {
    logger.error('unhandled_rejection', { reason: String(reason), stack: (reason as Error)?.stack });
    sentry.capture(reason as Error);
});

process.on('uncaughtException', (err) => {
    logger.error('uncaught_exception', { message: err.message, stack: err.stack });
    sentry.capture(err);
    process.exit(1);
});

// catches Ctrl+C event
process.on('SIGINT', async () => {
    logger.info('stopping scrapper and store...');
    await coordinator.end();
    await mongoClientProvider.close();
    process.exit();
});

(async () => {
    /* Connect shared MongoClient first */
    await mongoClientProvider.connect();

    /* Initialize each mode's database service */
    for (const child of childContainers) {
        const dbService = child.get<DatabaseService>(DatabaseService);
        await dbService.onStart();
    }

    /* Start all scrapers (each with its own TaskOrchestra, serialized via AsyncMutex) */
    await coordinator.start();
})().catch((err) => {
    logger.error('startup_error', { message: err.message, stack: err.stack });
    sentry.capture(err);
    process.exit(1);
});

sentry.capture(`starting scraper, REST service listening ${config.getServerHost()}:${config.getServerPort()}`);

/* REST server uses root container (ItemStorageMap is bound there) */
const server = new RESTServer(container, config);
server.start();
