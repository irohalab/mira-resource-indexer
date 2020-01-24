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

import { Expect, Test, TestCase, TestFixture } from 'alsatian';
import { escapeRegExp, toUTCDate, trimDomain } from './normalize';

@TestFixture('Normalize utility methods specs')
export class NormalizeSpec {

    @Test('trimDomain should drop domain part from url')
    @TestCase(
        'https://share.dmhy.org/topics/view/525154_Skytree_ONE_PIECE_903_X264_720P_GB_JP_MP4_CRRIP.html',
        '/topics/view/525154_Skytree_ONE_PIECE_903_X264_720P_GB_JP_MP4_CRRIP.html'
    )
    public trimDomainTest(input: string, output: string): void {
        Expect(trimDomain(input)).toBe(output);
    }

    @Test('toUTCDate should convert date string to UTC Date with a timezone')
    public toUTCDateConvertTest(): void {
        const dateStr = '2019/09/22 14:27';
        const timezoneOffset = 8;
        const dateObj = Date.UTC(2019, 8, 22, 14 + timezoneOffset, 27, 0, 0);
        Expect(toUTCDate(dateStr, timezoneOffset).valueOf()).toEqual(dateObj.valueOf());
    }

    @Test('Should able to escape string')
    @TestCase('Can Do.', 'Can Do\\.')
    public escapeRegExpTest(testStr: string, desiredResult: string): void {
        Expect(escapeRegExp(testStr)).toBe(desiredResult);
    }
}
