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

import { Scraper } from '../TYPES_IDX';
import { logger } from '../utils/logger-factory';

/**
 * Coordinates multiple scrapers in a single process.
 * Manages starting and stopping all mode-specific scrapers.
 */
export class ScraperCoordinator implements Scraper {
    private _scrapers: { mode: string, scraper: Scraper }[] = [];

    public addScraper(mode: string, scraper: Scraper): void {
        this._scrapers.push({ mode, scraper });
    }

    public initMQ(): Promise<void> {
        throw new Error('Method not implemented.');
    }

    public async start(): Promise<void> {
        /* Phase 1: register all exchanges/queues with the broker config
           before the broker is created (RascalImpl creates it on first consume) */
        for (const { mode, scraper } of this._scrapers) {
            logger.info('init_mq_for_scraper', { mode });
            await scraper.initMQ();
        }

        /* Phase 2: now start consuming and task loops */
        for (const { mode, scraper } of this._scrapers) {
            logger.info('starting_scraper', { mode });
            await scraper.start();
        }
        logger.info('all_scrapers_started', { count: this._scrapers.length });
    }

    public async end(): Promise<void> {
        for (const { mode, scraper } of this._scrapers) {
            logger.info('stopping_scraper', { mode });
            await scraper.end();
        }
    }

    public async executeTask(): Promise<any> {
        throw new Error('ScraperCoordinator does not execute tasks directly');
    }
}
