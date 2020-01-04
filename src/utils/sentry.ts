import {init} from '@sentry/node';

const DSN = process.env.SENTRY_DSN;
if (DSN) {
    init({dsn: DSN});
}
