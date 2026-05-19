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

import { MQControlAPIClient } from '../utils/mq-control-api-client';
import { injectable } from 'inversify';

@injectable()
export class InMemoryMQControlAPIClient implements MQControlAPIClient {
    public queueLengths = new Map<string, number>();

    async getQueueLength(vhost: string, queueName: string): Promise<number> {
        return this.queueLengths.get(queueName) || 0;
    }

    async getQueueInfo(vhost: string, queueName: string): Promise<{ len: number; consumers: number }> {
        return { len: this.queueLengths.get(queueName) || 0, consumers: 1 };
    }
}
