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

import { defaultClient, setup, TelemetryClient } from 'applicationinsights';
import { ConfigManager } from '../config';

export class AzureLogger {
    /**
     * Log level static
     */

    public static DEBUG = 'DEBUG';
    public static INFO = 'INFO';
    public static WARNING = 'WARNING';
    public static ERROR = 'ERROR';

    public static getInstance(): AzureLogger {
        if (!this.instance) {
            this.instance = new AzureLogger();
        }
        return this.instance;
    }
    private static instance: AzureLogger;
    private scraperMode: string;
    private isEnabled: boolean = false;
    private appInsightClient: TelemetryClient;
    private constructor() {
        if (process.env.APPINSIGHTS_INSTRUMENTATIONKEY) {
            setup()
                .setAutoDependencyCorrelation(false)
                .setAutoCollectRequests(false)
                .setAutoCollectExceptions(false)
                .setAutoCollectPerformance(false)
                .setAutoCollectHeartbeat(false)
                .setAutoCollectConsole(false);

            this.isEnabled = true;

            this.appInsightClient = defaultClient;
            const config = new ConfigManager();
            config.load();
            this.scraperMode = config.mode;
        }
    }

    public log(eventName: string, message: string, level: string, meta: {[key: string]: string}): void {
        this.appInsightClient.trackEvent({
            name: eventName,
            properties: {
                level,
                message,
                meta,
                scraperMode: this.scraperMode
            }
        });
    }
}
