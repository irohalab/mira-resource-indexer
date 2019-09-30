import { Item } from '../entity/Item';
import { ItemType } from '../entity/item-type';
import { MediaFile } from '../entity/media-file';
import { Publisher } from '../entity/publisher';
import { Team } from '../entity/Team';
import { toUTCDate } from './normalize';

export const items: Array<Item<number>> = [];
items[0] = new Item<number>();
items[0].id = 525501;
items[0].title = '【千夏字幕組&喵萌奶茶屋】★7月新番★[街角魔族/Machikado Mazoku][12END][1080p][繁體][完結撒花][優子生快]';
items[0].files = [];
items[0].files[0] = new MediaFile();
// items[0].files[0].id =
items[0].files[0].item_id = items[0].id;
items[0].files[0].path = '[Airota&Nekomoe kissaten][Machikado Mazoku][12END][1080p][CHT].mp4';
items[0].files[0].name = '[Airota&Nekomoe kissaten][Machikado Mazoku][12END][1080p][CHT].mp4';
items[0].files[0].ext = '.mp4';
items[0].files[0].size = '372.9MB';

items[0].type = new ItemType<number>();
items[0].type.id = 2;
items[0].type.name = '動畫';
items[0].team = new Team();
items[0].team.id = 283;
items[0].team.name = '千夏字幕组';
items[0].timestamp = toUTCDate('2019/09/28 0:04', 8);
items[0].uri = '/topics/view/525501_7_Machikado_Mazoku_12END_1080p.html';
items[0].publisher = new Publisher();
items[0].publisher.id = 635133;
items[0].publisher.name = '千夏字幕組';
items[0].torrent_url = 'https://dl.dmhy.org/2019/09/28/f2a31debcceb68407ddba32cd1c9ff2b0c409ec7.torrent';
items[0].magnet_uri = 'magnet:?xt=urn:btih:6KRR326M5NUEA7O3UMWNDSP7FMGEBHWH&dn=&tr=http%3A%2F%2F104.238.19' +
    '8.186%3A8000%2Fannounce&tr=udp%3A%2F%2F104.238.198.186%3A8000%2Fannounce&tr=http%3A%2F%2Ftracker.openb' +
    'ittorrent.com%3A80%2Fannounce&tr=udp%3A%2F%2Ftracker3.itzmx.com%3A6961%2Fannounce&tr=http%3A%2F%2Ftrac' +
    'ker4.itzmx.com%3A2710%2Fannounce&tr=http%3A%2F%2Ftracker.publicbt.com%3A80%2Fannounce&tr=http%3A%2F%2Ft' +
    'racker.prq.to%2Fannounce&tr=http%3A%2F%2Fopen.acgtracker.com%3A1096%2Fannounce&tr=https%3A%2F%2Ft-115.rhc' +
    'loud.com%2Fonly_for_ylbud&tr=http%3A%2F%2Ftracker1.itzmx.com%3A8080%2Fannounce&tr=http%3A%2F%2Ftracker' +
    '2.itzmx.com%3A6961%2Fannounce&tr=udp%3A%2F%2Ftracker1.itzmx.com%3A8080%2Fannounce&tr=udp%3A%2F%2Ftracke' +
    'r2.itzmx.com%3A6961%2Fannounce&tr=udp%3A%2F%2Ftracker3.itzmx.com%3A6961%2Fannounce&tr=udp%3A%2F%2Ftrack' +
    'er4.itzmx.com%3A2710%2Fannounce&tr=http%3A%2F%2Ftr.bangumi.moe%3A6969%2Fannounce';
