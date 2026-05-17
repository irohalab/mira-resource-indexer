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
import { controller, httpGet, queryParam, requestParam, BaseHttpController, interfaces } from 'inversify-express-utils';
import { ItemStorage, TYPES_IDX } from '../TYPES_IDX';
import { JsonResultFactory } from '@irohalab/mira-shared';

@controller('/:mode/item')
export class ItemsQuery extends BaseHttpController implements interfaces.Controller {

    constructor(@inject(TYPES_IDX.ItemStorageMap) private _storageMap: Map<string, ItemStorage<any>>) {
        super();
    }

    @httpGet('/')
    public async search(
        @requestParam('mode') mode: string,
        @queryParam('keyword') keyword: string
    ): Promise<interfaces.IHttpActionResult> {
        const normalizedMode = mode.replace(/-/g, '_');
        const storage = this._storageMap.get(normalizedMode);
        if (!storage) {
            return this.json({ error: `Unknown mode: ${mode}` }, 404);
        }
        if (!keyword) {
            return this.badRequest('keyword required');
        }
        try {
            let items = await storage.searchItem(keyword);
            if (!items) {
                items = [];
            }
            items.forEach(item => {
                item._id = undefined;
            });
            return this.json(items, 200);
        } catch (e) {
            return JsonResultFactory(500);
        }

    }
}
