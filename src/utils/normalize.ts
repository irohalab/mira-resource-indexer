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

/**
 * Trim url and drop the domain part.
 * @param {string} uri
 * @returns {string | null}
 */
export function trimDomain(uri: string): string | null {
    if (uri) {
        const match = uri.match(/^(?:http|https):\/\/[\w\d.]+?(\/.+)/);
        // console.log('trim: ', uri, match);
        if (match) {
            return match[1];
        }
    }
    return uri;
}

/**
 * convert date string to utc date object.
 * @param {string} timestamp the string represent a local time.
 * @param {number} timezone the timezone off from UTC
 * @returns {Date}
 */
export function toUTCDate(timestamp: string, timezone: number): Date {
    if (!timestamp) {
        return new Date();
    }
    const match = timestamp.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})\s(\d{1,2}):(\d{1,2})/);
    let year = parseInt(match[1], 10);
    let month = parseInt(match[2], 10) - 1;
    let day = parseInt(match[3], 10);
    let hour = parseInt(match[4], 10);
    let minute = parseInt(match[5], 10);
    return new Date(Date.UTC(year, month, day, hour, minute) + timezone * 3600 * 1000);
}

/**
 * Replace all special characters of Regex to make sure it will work properly as a regex pattern
 * @param {string} str the string which need escape
 * @returns {string} result
 */
export function escapeRegExp(str: string): string {
    return str.replace(/[-[\]{}()*+?.\\^$|#]/g, '\\$&');
}
