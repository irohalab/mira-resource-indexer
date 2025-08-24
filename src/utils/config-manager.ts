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

import { BaseConfigManager } from '@irohalab/mira-shared';

export const DMHY = 'dmhy';
export const BANGUMI_MOE = 'bangumi_moe';
export const NYAA = 'nyaa';
export const ACG_RIP = 'acg_rip';

export interface ConfigManager extends BaseConfigManager {
    getMode(): string;
    getDbMode(): string;
    getDbHost(): string;
    getDbPort(): number;
    getDbUser(): string;
    getDbName(): string;
    getDbPass(): string;
    getAuthSource(): string; // see: https://docs.mongodb.com/manual/core/security-users/#user-authentication-database
    getServerHost(): string;
    getServerPort(): number;
    getMinInterval(): number; // for task, unit is millisecond
    getMinCheckInterval(): number; // for main task, unit is millisecond
    getMinFailedTaskCheckInterval(): number; // how much time is need between check failed task.
    getMaxPageNo(): number; // max page number for scrapping
    getMaxSearchCount(): number; // max search result count
    getMaxRetryCount(): number; // max retry times for a task

    prepare(): void;
}
