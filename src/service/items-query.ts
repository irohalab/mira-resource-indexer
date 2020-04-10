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
        let items = await this._storage.searchItem(keyword);
        if (!items) {
            items = [];
        }
        items.forEach(item => {
            item._id = undefined;
        });
        return this.json(items, 200);
    }
}
