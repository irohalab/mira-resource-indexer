import { inject } from 'inversify';
import { controller, httpGet, queryParam, BaseHttpController } from 'inversify-express-utils';
import { interfaces } from 'inversify-express-utils/dts/interfaces';
import { PersistentStorage, TYPES } from '../types';

@controller('/item')
export class ItemsQuery<T> extends BaseHttpController {

    constructor(@inject(TYPES.PersistentStorage) private _storage: PersistentStorage<T>) {
        super();
    }

    @httpGet('/')
    public async search(@queryParam('keyword') keyword: string): Promise<interfaces.IHttpActionResult> {
        if (!keyword) {
            return this.badRequest('keyword required');
        }
        return this.json(await this._storage.searchItem(keyword), 200);
    }
}
