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
import { AxiosError } from 'axios';

/**
 * HTTP status codes that indicate the target site is down or having issues,
 * rather than a problem with our request.
 */
const KNOWN_SERVER_ERROR_CODES = new Set([500, 502, 524, 525]);

/**
 * Error messages (substrings) that indicate network-level failures,
 * typically caused by the target site being unreachable or unstable.
 */
const KNOWN_NETWORK_ERROR_MESSAGES = [
    'socket hang up',
    'ECONNRESET',
    'Client network socket disconnected before secure TLS connection was established',
];

/**
 * Error messages that must match exactly (using ===) to avoid false positives
 * from generic words that appear in unrelated error messages.
 */
const KNOWN_NETWORK_ERROR_EXACT_MESSAGES = [
    'aborted',
];

/**
 * Determines whether an error is a known network / site-down error
 * that should be tracked internally rather than sent to Sentry immediately.
 */
export function isKnownNetworkError(e: Error | AxiosError): boolean {
    if (e instanceof AxiosError && e.response) {
        if (KNOWN_SERVER_ERROR_CODES.has(e.response.status)) {
            return true;
        }
    }

    const message = e.message || '';
    return KNOWN_NETWORK_ERROR_MESSAGES.some(known => message.includes(known));
}
