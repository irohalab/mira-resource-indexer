import { Expect, Test, TestCase, TestFixture } from 'alsatian';
import { toUTCDate, trimDomain } from './normalize';

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
}
