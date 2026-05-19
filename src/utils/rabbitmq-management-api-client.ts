/*
 * Copyright 2026 IROHA LAB
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

import { MQControlAPIClient } from './mq-control-api-client';
import { inject, injectable } from 'inversify';
import { TYPES } from '@irohalab/mira-shared';
import { ConfigManager } from './config-manager';
import axios from 'axios';

@injectable()
export class RabbitMQManagementAPIClient implements MQControlAPIClient {
    private readonly _baseUrl: string;
    constructor(@inject(TYPES.ConfigManager) _configManager: ConfigManager) {
        this._baseUrl = _configManager.amqpManagementAPIUrl();
    }

    public async getQueueInfo(vhost: string, queueName: string): Promise<{ len: number; consumers: number }> {
        const encodedVhost = encodeURIComponent(vhost);
        const encodedQueueName = encodeURIComponent(queueName);
        const resp = await axios.get(`${this._baseUrl}/queues/${encodedVhost}/${encodedQueueName}`);
        const len = resp.data.messages || 0;
        return { len, consumers: resp.data.consumers };
    }

    public async getQueueLength(vhost: string, queueName: string): Promise<number> {
        const encodedVhost = encodeURIComponent(vhost);
        const encodedQueueName = encodeURIComponent(queueName);
        const resp = await axios.get(`${this._baseUrl}/queues/${encodedVhost}/${encodedQueueName}`);
        return resp.data.backing_queue_status ? resp.data.backing_queue_status.len : 0;
    }
}
