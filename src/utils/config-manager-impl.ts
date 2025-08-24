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

import { MikroORMOptions } from '@mikro-orm/core';
import { SqlEntityManager } from '@mikro-orm/knex';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { ConfigManager } from './config-manager';
import { injectable } from 'inversify';
import { Options } from 'amqplib';
import * as process from 'node:process';

@injectable()
export class ConfigManagerImpl implements ConfigManager {
    prepare(): void {
        if (!this.getMode()) {
            throw new Error('No mode specified!');
        }
    }
    getMode(): string {
        return process.env.INDEXER_MODE;
    }
    getDbMode(): string {
        return process.env.DB_MODE || 'mongo';
    }
    getDbHost(): string {
        return process.env.DB_HOST || 'localhost';
    }
    getDbPort(): number {
        return parseInt(process.env.DB_PORT, 10) || 27017;
    }
    getDbUser(): string {
        return process.env.DB_USER || process.env.USER;
    }
    getDbName(): string {
        if (process.env.DB_NAME) {
            return process.env.DB_NAME;
        } else {
            return this.getMode() + '_indexer';
        }
    }
    getDbPass(): string {
        return process.env.DB_PASS || '123456';
    }
    getAuthSource(): string {
        return process.env.AUTH_SOURCE || 'admin';
    }
    getServerHost(): string {
        return process.env.SERVER_HOST || '0.0.0.0';
    }
    getServerPort(): number {
        return parseInt(process.env.SERVER_PORT, 10) || 35120;
    }
    getMinInterval(): number {
        return parseInt(process.env.MIN_INTERVAL, 10) || 10000;
    }
    getMinCheckInterval(): number {
        return parseInt(process.env.MIN_CHECK_INTERVAL, 10) || (15 * 60 * 1000);
    }
    getMinFailedTaskCheckInterval(): number {
        return parseInt(process.env.MIN_FAILED_TASK_CHECK_INTERVAL, 10) || (60 * 1000);
    }
    getMaxPageNo(): number {
        return parseInt(process.env.MAX_PAGE_NO, 10) || 5;
    }
    getMaxSearchCount(): number {
        return parseInt(process.env.MAX_SEARCH_COUNT, 10) || 100;
    }
    getMaxRetryCount(): number {
        return parseInt(process.env.MAX_RETRY_COUNT, 10) || 5;
    }
    amqpConfig(): Options.Connect {
        return {
            hostname: process.env.AMQP_HOST || 'localhost',
            protocol: 'amqp',
            port: process.env.AMQP_PORT ? parseInt(process.env.AMQP_PORT, 10) : 5672,
            username: process.env.AMQP_USER || 'guest',
            password: process.env.AMQP_PASS || 'guest',
            locale: 'en_US',
            frameMax: 0,
            heartbeat: 0,
            vhost: '/'
        }
    }
    amqpServerUrl(): string {
        return process.env.AMQP_URL;
    }
    databaseConfig(): MikroORMOptions<PostgreSqlDriver, SqlEntityManager<PostgreSqlDriver>> {
        throw new Error('Method not implemented.');
    }
}
