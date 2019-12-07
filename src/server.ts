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
