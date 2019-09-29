import { inject, injectable } from 'inversify';
import { basename, extname } from 'path';
import { Browser, launch, Page } from 'puppeteer';
import { resolve } from 'url';
import { Item } from '../entity/Item';
import { ItemType } from '../entity/item-type';
import { MediaFile } from '../entity/media-file';
import { Publisher } from '../entity/publisher';
import { Team } from '../entity/Team';
import { PersistentStorage, Scraper, TYPES } from '../types';
import { toUTCDate, trimDomain } from '../utils/normalize';

@injectable()
export class DmhyScraper implements Scraper {
    private static _host = 'https://share.dmhy.org';
    private _browser: Browser;
    constructor(@inject(TYPES.PersistentStorage) private _store: PersistentStorage<number>) {

    }

    public async start(): Promise<any> {
        this._browser = await launch();
        const page = await this._browser.newPage();
        const items = await this.scrapListPage(page);
        // console.log(items);
        for (let item of items) {
            await this.scrapDetailPage(this._browser, item);
        }
    }

    public async end(): Promise<any> {
        await this._browser.close();
        return undefined;
    }

    public async scrapListPage(page: Page): Promise<Array<Item<number>>> {
        await page.goto(DmhyScraper._host, {
            waitUntil: 'domcontentloaded'
        });
        let tableElement = await page.$('#topic_list');
        let trList = await tableElement.$$('tbody>tr');
        let items = [];
        for (let tr of trList) {
            let item = new Item<number>();
            item.uri = trimDomain(await page.evaluate(el => {
                let titleLink = el.querySelector('td.title>a');
                if (titleLink && titleLink.getAttribute('href')) {
                    return titleLink.getAttribute('href').trim();
                }
                return null;
            }, tr));
            item.id = this.getIdFromUri(item.uri);
            items.push(item);

            // type
            item.type = new ItemType<number>();
            item.type.id = this.getIdFromUri(
                await page.evaluate(
                    el => el.querySelector('td:nth-child(2) > a').getAttribute('href'), tr),
                /\/topics\/list\/sort_id\/(\d+)/);
            item.type.name = await page.evaluate(
                el => el.querySelector('td:nth-child(2) > a font').textContent.trim(), tr);
        }
        let newIds = await this._store.filterItemNotStored(items.map(item => item.id));
        return items.filter(item => {
            return newIds.includes(item.id);
        });
    }

    public async scrapDetailPage(browser: Browser, item: Item<number>): Promise<void> {
        const page = await browser.newPage();
        await page.goto(DmhyScraper._host + item.uri, {
            waitUntil: 'domcontentloaded'
        });
        let mainArea = await page.$('.main > .topics_bk');

        item.title = await page.evaluate(el => {
            const h3El = el.querySelector('.topic-main > .topic-title > h3');
            return h3El.textContent.trim();
        }, mainArea);
        // console.log(item.title);
        let publisherElement = await mainArea.$('.user-sidebar > .avatar.box:nth-child(1) > p:nth-child(2) > a');
        console.log(publisherElement.toString());
        item.publisher = new Publisher<number>();
        item.publisher.id = this.getIdFromUri(await page.evaluate(el => el.getAttribute('href'), publisherElement),
            /\/topics\/list\/user_id\/(\d+)/);
        // console.log(item.publisher);
        item.publisher.name = await page.evaluate(el => {
            let name = el.textContent;
            if (name) {
                name = name.trim();
            }
            return name;
        }, publisherElement);

        let teamElement = await mainArea.$('.user-sidebar > .avatar.box:nth-child(2) > p:nth-child(2) > a');
        if (teamElement) {
            item.team = new Team<number>();
            item.team.id = this.getIdFromUri(await page.evaluate(el => el.getAttribute('href'), teamElement),
                /\/topics\/list\/team_id\/(\d+)/);
            item.team.name = await page.evaluate(el => {
                let name = el.textContent;
                if (name) {
                    name = name.trim();
                }
                return name;
            }, teamElement);
            // console.log(item.team);
        }
        let resourceInfoElement = await mainArea.$('.info.resource-info.right > ul');
        item.timestamp = toUTCDate(await page.evaluate(el => {
            const spanEl = el.querySelector('li:nth-child(2) > span');
            let timeStr = spanEl.textContent;
            if (timeStr) {
                return timeStr.trim();
            }
            return Date.now();
        }, resourceInfoElement), 8);
        // console.log(item.timestamp);
        let btResourceElement = await mainArea.$('#tabs-1');
        item.torrent_url = resolve('https://', await page.evaluate(el => {
            const anchor = el.querySelector('p:nth-child(1) > a');
            return anchor.getAttribute('href');
        }, btResourceElement));
        item.magnet_uri = await page.evaluate(el => {
            const anchor = el.querySelector('#a_magnet');
            return anchor.getAttribute('href');
        }, btResourceElement);

        item.files = [];
        let fileElHandlerList = await btResourceElement.$$('.file_list > ul > li');
        for (let fileElHandler of fileElHandlerList) {
            let mediaFile = new MediaFile();
            mediaFile.size = await page.evaluate(
                el => el.querySelector('.bt_file_size').textContent.trim(), fileElHandler);
            mediaFile.path = await page.evaluate(el => el.textContent.trim(), fileElHandler);
            let match = mediaFile.path.match(/(.+?)\t/);
            if (match) {
                mediaFile.path = match[1];
            }
            mediaFile.ext = extname(mediaFile.path);
            mediaFile.name = basename(mediaFile.path, mediaFile.ext);
            item.files.push(mediaFile);
        }
        await this._store.putItem(item);
        await page.close();
    }

    private getIdFromUri(uri: string, regex: RegExp = /\/topics\/view\/(\d+)_.+/): number {
        const match = uri.match(regex);
        if (match) {
            return parseInt(match[1], 10);
        }
        return 0;
    }
}
