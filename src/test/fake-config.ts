import { injectable } from 'inversify';
import { ConfigLoader } from '../types';

@injectable()
export class FakeConfigManager implements ConfigLoader {

    public dbHost: string;
    public dbPort: number;
    public mode: string;
    public dbMode: string;
    public dbUser: string;
    public dbName: string;
    public dbPass: string;

    public load(): void {
        this.mode = process.env.INDEXER_MODE;
        if (!this.mode) {
            throw new Error('No mode specified!');
        }
        this.dbMode = process.env.DB_MODE || 'mongo';
        this.dbHost = process.env.DB_HOST || 'localhost';
        this.dbPort = parseInt(process.env.DB_PORT, 10) || 5432;
        this.dbUser = process.env.DB_USER || process.env.USER;
        if (process.env.DB_NAME) {
            this.dbName = process.env.DB_NAME;
        } else {
            this.dbName = this.mode + '_indexer';
        }
        this.dbPass = process.env.DB_PASS || '123456';
    }
}
