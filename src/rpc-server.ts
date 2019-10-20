import { loadSync } from '@grpc/proto-loader';
import { GrpcObject, loadPackageDefinition, Server } from 'grpc';
import { inject, injectable } from 'inversify';
import { join } from 'path';
import { ConfigManager } from './config';
import { Item } from './entity/Item';
import { ConfigLoader, PersistentStorage, TYPES } from './types';

@injectable()
export class RpcServer<T> {

    private _queryItem: GrpcObject;
    private _server: Server;

    constructor(@inject(TYPES.PersistentStorage) private _storage: PersistentStorage<T>,
                @inject(TYPES.ConfigLoader) private _config: ConfigLoader) {
        const PROTO_PATH = join(__dirname, 'protos/query-item.proto');

        const packageDefinition = loadSync(PROTO_PATH, {
            defaults: true,
            enums: String,
            includeDirs: [join(__dirname, 'protos')],
            keepCase: true,
            longs: String,
            oneofs: true
        });

        const protoDescriptor = loadPackageDefinition(packageDefinition);

        this._queryItem = protoDescriptor.queryItem as GrpcObject;
    }

    public start(host: string, port: number): void {

        this._server = new Server();
        if (this._config.mode === ConfigManager.DMHY) {
            this._server.addService(this._queryItem.QueryItem.service, {
                dmhy: (call, callback) => {
                    this.dmhy(call.request).then((items) => {
                        callback(null, items);
                    }, (reason) => {
                        callback(reason, null);
                    });
                }
            });
        }
        if (this._config.mode === ConfigManager.BANGUMI_MOE) {
            this._server.addService(this._queryItem.QueryItem.service, {
                bangumiMoe: (call, callback) => {
                    this.bangumiMoe(call.request).then((items) => {
                        callback(null, items);
                    }, (reason) => {
                        callback(reason, null);
                    });
                }
            });
        }
        this._server.bind(host, port);
        this._server.start();
    }

    public async stop(): Promise<void> {
        return new Promise<void>((resolve) => {
            this._server.tryShutdown(() => {
                resolve();
            });
        });
    }

    private async bangumiMoe(params: any): Promise<Item[]> {
        return await this._storage.getItemsByKeyword(params.keyword);
    }

    private async dmhy(params: any): Promise<Item[]> {
        return await this._storage.getItemsByKeyword(params.keyword);
    }
}
