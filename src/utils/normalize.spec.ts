import { Expect, Test, TestFixture } from 'alsatian';
import { toUTCDate, trimDomain } from './normalize';

@TestFixture('Normalize utility methods specs')
export class NormalizeSpec {

    @Test('trimDomain should drop domain part from url')
    public trimDomainTest(): void {
        const domainList = [{
            input: 'https://share.dmhy.org/topics/view/525154_Skytree_ONE_PIECE_903_X264_720P_GB_JP_MP4_CRRIP.html',
            output: '/topics/view/525154_Skytree_ONE_PIECE_903_X264_720P_GB_JP_MP4_CRRIP.html'
        }];
        for (let domain of domainList) {
            Expect(trimDomain(domain.input)).toBe(domain.output);
        }
    }

    @Test('toUTCDate should convert date string to UTC Date with a timezone')
    public toUTCDateConvertTest(): void {
        const dateStr = '2019/09/22 14:27';
        const timezoneOffset = 8;
        const dateObj = Date.UTC(2019, 8, 22, 14 + timezoneOffset, 27, 0, 0);
        Expect(toUTCDate(dateStr, timezoneOffset).valueOf()).toEqual(dateObj.valueOf());
    }
}
