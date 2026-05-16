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

import { injectable } from 'inversify';

/**
 * A round-robin mutex that ensures fair scheduling across modes.
 * When multiple modes have tasks waiting, they are served in round-robin order
 * instead of FIFO, preventing any single mode from starving others.
 */
@injectable()
export class AsyncMutex {
    private _modeQueues: Map<string, (() => void)[]> = new Map();
    private _modeOrder: string[] = [];
    private _currentIndex = 0;
    private _locked = false;

    /**
     * Register a mode for round-robin scheduling.
     * Must be called before acquire/runExclusive for that mode.
     */
    public registerMode(mode: string): void {
        if (!this._modeQueues.has(mode)) {
            this._modeQueues.set(mode, []);
            this._modeOrder.push(mode);
        }
    }

    public async acquire(mode: string): Promise<void> {
        if (!this._locked) {
            this._locked = true;
            return;
        }
        return new Promise<void>((resolve) => {
            this._modeQueues.get(mode)!.push(resolve);
        });
    }

    public release(): void {
        // Round-robin: scan from current index to find next mode with waiting tasks
        const len = this._modeOrder.length;
        for (let i = 0; i < len; i++) {
            const idx = (this._currentIndex + i) % len;
            const mode = this._modeOrder[idx];
            const queue = this._modeQueues.get(mode)!;
            if (queue.length > 0) {
                this._currentIndex = (idx + 1) % len;
                const next = queue.shift()!;
                next();
                return;
            }
        }
        this._locked = false;
    }

    /**
     * Execute a function while holding the mutex lock.
     * Tasks are scheduled in round-robin order across modes.
     */
    public async runExclusive<T>(mode: string, fn: () => Promise<T>): Promise<T> {
        await this.acquire(mode);
        try {
            return await fn();
        } finally {
            this.release();
        }
    }
}
