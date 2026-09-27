import { createServer } from 'node:http';

import { createHandler } from './app.ts';
import { loadConfig } from './config.ts';
import { Store } from './db.ts';
import { stripeGateway } from './payments.ts';

const config = loadConfig();
const store = new Store(config.dbPath);
const payments = config.billingMode === 'stripe' ? stripeGateway(config) : null;
const server = createServer(createHandler({ config, store, payments }));
server.listen(config.port, () => {
  console.log(`KinéSyP API sur http://localhost:${config.port} (paiement : ${config.billingMode})`);
});
const stop = () => server.close(() => (store.close(), process.exit(0)));
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
