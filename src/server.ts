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

import { createServer, Server } from 'http';
import { Container } from 'inversify';
import { InversifyExpressServer } from 'inversify-express-utils';
import { ConfigLoader } from './types';

export class RESTServer {
    private _server: InversifyExpressServer;
    private _config: ConfigLoader;
    constructor(container: Container, config: ConfigLoader) {
        this._config = config;
        this._server = new InversifyExpressServer(container);
    }

    public start(): Server {
        const app = this._server.build();
        const httpServer = createServer(app);
        process.on('SIGINT', () => {
            console.log('stopping REST server...');
            httpServer.close();
        });
        return httpServer.listen(this._config.serverPort, this._config.serverHost);
    }
}
