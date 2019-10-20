import { injectable } from 'inversify';
import { ConfigLoader } from '../types';

@injectable()
export class FakeConfigManager implements ConfigLoader {

    public dbHost: string;
    public dbPort: number;
    private _mode: string;
    private _dbMode: string;
    private _dbUser: string;
    private _dbName: string;
    private _dbPass: string;

    public get mode(): string {
        return this._mode;
    }

    public get dbMode(): string {
        return this._dbMode;
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
        this._mode = process.env.INDEXER_MODE;
        if (!this._mode) {
            throw new Error('No mode specified!');
        }
        this._dbMode = process.env.DB_MODE || 'mongo';
        this.dbHost = process.env.DB_HOST || 'localhost';
        this.dbPort = parseInt(process.env.DB_PORT, 10) || 5432;
        this._dbUser = process.env.DB_USER || process.env.USER;
        if (process.env.DB_NAME) {
            this._dbName = process.env.DB_NAME;
        } else {
            this._dbName = this._mode + '_indexer';
        }
        this._dbPass = process.env.DB_PASS || '123456';
    }
}
