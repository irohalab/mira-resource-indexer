import { inject, injectable } from 'inversify';
import { basename, extname } from 'path';
import { Browser, launch } from 'puppeteer';
import { resolve } from 'url';
import { Item } from '../entity/Item';
import { ItemType } from '../entity/item-type';
import { MediaFile } from '../entity/media-file';
import { Publisher } from '../entity/publisher';
import { Team } from '../entity/Team';
import { DmhyTask } from '../task/dmhy-task';
import { TaskOrchestra } from '../task/task-orchestra';
import { Task, TaskType } from '../task/task-types';
import { ConfigLoader, PersistentStorage, Scraper, TYPES } from '../types';
import { toUTCDate, trimDomain } from '../utils/normalize';

@injectable()
export class DmhyScraper implements Scraper {
    private static _host = 'https://share.dmhy.org';
    private _browser: Browser;
    constructor(@inject(TYPES.PersistentStorage) private _store: PersistentStorage<number>,
                @inject(TaskOrchestra) private _taskOrchestra: TaskOrchestra,
                @inject(TYPES.ConfigLoader) private _config: ConfigLoader) {

    }

    public async start(): Promise<any> {
        this._browser = await launch();
        this._taskOrchestra.queue(new DmhyTask(TaskType.MAIN));
        this._taskOrchestra.start(this);
    }

    public async end(): Promise<any> {
        this._taskOrchestra.stop();
        await this._browser.close();
        return undefined;
    }

    public async executeTask(task: Task): Promise<any> {
        if (task.type === TaskType.MAIN) {
            let result;
            if (task instanceof DmhyTask) {
                result = await this.scrapListPage((task as DmhyTask).pageNo);
            } else {
                result = await this.scrapListPage();
            }
            if (!result) {
                // retry this task
                this._taskOrchestra.queue(task);
                return;
            }
            for (let item of result.items) {
                this._taskOrchestra.queue(new DmhyTask(TaskType.SUB, item));
            }
            if (result.hasNext && (task as DmhyTask).pageNo < this._config.maxPageNo) {
                let newTask = new DmhyTask(TaskType.MAIN);
                let previousPageNo = (task as DmhyTask).pageNo;
                if (previousPageNo) {
                    newTask.pageNo = previousPageNo + 1;
                } else {
                    newTask.pageNo = 2;
                }
                this._taskOrchestra.queue(newTask);
            }
        } else {
            let item = await this.scrapDetailPage(this._browser, (task as DmhyTask).item);
            if (!item) {
                this._taskOrchestra.queue(task);
                return;
            }
            return await this._store.putItem(item);
        }
    }

    public async scrapListPage(pageNo?: number): Promise<{items: Array<Item<number>>, hasNext: boolean}> {
        const page = await this._browser.newPage();
        // page.setUserAgent('Mozilla/5.5 (X11; Linux x86_64) ' +
        //     'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/77.0.3865.90 Safari/537.36');
        try {
            let listPageUrl = DmhyScraper._host;
            if (pageNo) {
                listPageUrl += '/topics/list/page/' + pageNo;
            }
            console.log(`Scrapping ${listPageUrl}`);
            await page.goto(listPageUrl, {
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
            let newItems = items.filter(item => {
                return newIds.includes(item.id);
            });
            return {hasNext: newIds.length === items.length && newIds.length > 0, items: newItems};
        } catch (e) {
            console.error(e.stack);
            return null;
        } finally {
            await page.close();
        }
    }

    public async scrapDetailPage(browser: Browser, item: Item<number>): Promise<Item<number>> {
        const page = await browser.newPage();
        try {
            console.log(`Scrapping ${DmhyScraper._host + item.uri}`);
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
            // console.log(publisherElement.toString());
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
            return item;
        } catch (e) {
            console.error(e);
            return null;
        } finally {
            await page.close();
        }
    }

    private getIdFromUri(uri: string, regex: RegExp = /\/topics\/view\/(\d+)_.+/): number {
        const match = uri.match(regex);
        if (match) {
            return parseInt(match[1], 10);
        }
        return 0;
    }
}
