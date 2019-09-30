import { injectable } from 'inversify';
import { ConfigLoader } from './types';

@injectable()
export class ConfigManager implements ConfigLoader {

    public static DMHY = 'dmhy';
    public static BANGUMI_MOE = 'bangumi_moe';
    
    private  _mode: string;
    private _dbHost: string;
    private _dbPort: number;
    private _dbUser: string;
    private _dbName: string;
    private _dbPass: string;

    public get mode(): string {
        return this._mode;
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
        this._mode = process.env.INDEXER_MODE;
        if (!this._mode) {
            throw new Error('No mode specified!');
        }
        this._dbHost = process.env.DB_HOST || 'localhost';
        this._dbPort = parseInt(process.env.DB_PORT, 10) || 5432;
        this._dbUser = process.env.DB_USER || process.env.USER;
        if (process.env.DB_NAME) {
            this._dbName = process.env.DB_NAME;
        } else {
            this._dbName = this._mode + '_indexer';
        }
        this._dbPass = process.env.DB_PASS || '123456';
    }
}
