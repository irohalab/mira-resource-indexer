import { init, captureMessage as sentryCaptureMessage, captureException as sentryCaptureException } from '@sentry/node';
// tslint:disable-next-line
const { version } = require('../package.json');
const DSN = process.env.SENTRY_DSN;
if (DSN) {
    init({ dsn: DSN, release: `indexer@v${version}` });
}

export function captureException(err: any) {
    if (DSN) {
        sentryCaptureException(err);
    }
}

export function captureMessage(msg: any) {
    if (DSN) {
        sentryCaptureMessage(msg);
    }
}
