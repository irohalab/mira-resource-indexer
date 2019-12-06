import { injectable } from 'inversify';
import { ConfigLoader } from './types';

@injectable()
export class ConfigManager implements ConfigLoader {

    public static DMHY = 'dmhy';
    public static BANGUMI_MOE = 'bangumi_moe';
    
    public static PG = 'postgres';
    public static MONGO = 'mongo';

    private  _mode: string;
    private _dbMode: string;
    private _dbHost: string;
    private _dbPort: number;
    private _dbUser: string;
    private _dbName: string;
    private _dbPass: string;
    private _authSource: string;
    private _serverPort: number;
    private _minInterval: number;
    private _minCheckInterval: number;

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

    public get authSource(): string {
        return this._authSource;
    }

    public get serverPort(): number {
        return this._serverPort;
    }

    public get minInterval(): number {
        return this._minInterval;
    }

    public get minCheckInterval(): number {
        return this._minCheckInterval;
    }

    public load(): void {
        this._mode = process.env.INDEXER_MODE;
        if (!this._mode) {
            throw new Error('No mode specified!');
        }
        this._dbMode = process.env.DB_MODE || 'mongo';
        this._dbHost = process.env.DB_HOST || 'localhost';
        this._dbPort = parseInt(process.env.DB_PORT, 10) || 27017;
        this._dbUser = process.env.DB_USER || process.env.USER;
        if (process.env.DB_NAME) {
            this._dbName = process.env.DB_NAME;
        } else {
            this._dbName = this._mode + '_indexer';
        }
        this._dbPass = process.env.DB_PASS || '123456';
        this._serverPort = parseInt(process.env.SERVER_PORT, 10) || 35120;
        this._minInterval = parseInt(process.env.MIN_INTERVAL, 10) || 10;
        this._minCheckInterval = parseInt(process.env.MIN_CHECK_INTERVAL, 10) || (15 * 60);
    }
}
