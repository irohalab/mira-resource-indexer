import { readFileSync } from 'fs';
import { join } from 'path';

export const items = JSON.parse(readFileSync(join(__dirname, './items.json'), {encoding: 'utf-8'}));

items.forEach((item: any) => {
    delete item._id;
    item.timestamp = new Date(item.timestamp.$date);
});
