import { injectable } from 'inversify';
import { ConfigLoader } from '../types';

@injectable()
export class FakePostgresConfigManager implements ConfigLoader {

    private _mode: string;
    private _dbMode: string
    private _dbHost: string;
    private _dbPort: number;
    private _dbUser: string;
    private _dbName: string;
    private _dbPass: string;

    public get mode(): string {
        return this._mode;
    }

    public get dbMode(): string {
        return this._dbMode;
    }

    public get dbHost(): string {
        return this._dbHost;
    }

    public get dbPort(): number {
        return this._dbPort;
    }

    public get dbUser(): string {
        return this._dbUser;
    }

    public get dbName(): string {
        return this._dbName;
    }

    public get dbPass(): string {
        return this._dbPass;
    }

    public load(): void {
        this._mode = 'dmhy';
        this._dbMode = 'postgres';
        this._dbHost = 'pg';
        this._dbPort = 5432;
        this._dbUser = 'admin';
        this._dbName = 'dmhy_indexer';
        this._dbPass = '123456';
    }
}
