import { run } from './orchestrator.js';
import { log } from './log.js';

run()
  .then(() => process.exit(0))
  .catch((err) => { log.error('fatal:', err.stack || err.message); process.exit(1); });
