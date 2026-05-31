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
import { inject, injectable } from 'inversify';
import { Sentry, TYPES } from '@irohalab/mira-shared';
import { TYPES_IDX } from '../TYPES_IDX';
import { logger } from './logger-factory';
import { ConfigManager } from './config-manager';

/**
 * Tracks known network errors per scraper mode using a sliding time window.
 * When the threshold is exceeded, sends a single Sentry alert and suppresses
 * further reports until a successful task resets the state.
 */
@injectable()
export class SiteHealthMonitor {
    private _errorTimestamps: number[] = [];
    private _alerted = false;

    private readonly _windowMs: number;
    private readonly _threshold: number;

    constructor(
        @inject(TYPES.Sentry) private _sentry: Sentry,
        @inject(TYPES_IDX.Mode) private _mode: string,
        @inject(TYPES.ConfigManager) config: ConfigManager
    ) {
        this._windowMs = config.getSiteHealthErrorWindowMs();
        this._threshold = config.getSiteHealthErrorThreshold();
    }

    /**
     * Record a known network error.
     * Returns true if Sentry was notified (threshold just crossed).
     */
    public recordError(e: Error): boolean {
        const now = Date.now();
        this._errorTimestamps.push(now);
        this.pruneOldEntries(now);

        if (this._alerted) {
            logger.info('site_health_error_suppressed', {
                mode: this._mode,
                errorCount: this._errorTimestamps.length,
                message: e.message
            });
            return false;
        }

        if (this._errorTimestamps.length >= this._threshold) {
            this._alerted = true;
            const alertError = new Error(
                `[${this._mode}] Target site may be down: ${this._errorTimestamps.length} known network errors in the last ${this._windowMs / 60000} minutes. Latest: ${e.message}`
            );
            this._sentry.capture(alertError);
            logger.warn('site_health_alert', {
                mode: this._mode,
                errorCount: this._errorTimestamps.length,
                windowMinutes: this._windowMs / 60000
            });
            return true;
        }

        return false;
    }

    /**
     * Call when a task completes successfully to reset the health state.
     */
    public reportSuccess(): void {
        if (this._alerted || this._errorTimestamps.length > 0) {
            logger.info('site_health_recovered', {
                mode: this._mode,
                previousErrorCount: this._errorTimestamps.length,
                wasAlerted: this._alerted
            });
        }
        this._errorTimestamps = [];
        this._alerted = false;
    }

    private pruneOldEntries(now: number): void {
        const cutoff = now - this._windowMs;
        this._errorTimestamps = this._errorTimestamps.filter(ts => ts > cutoff);
    }
}
