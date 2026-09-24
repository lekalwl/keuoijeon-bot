import { setupAllSheets } from './services/sheets.js';

const args = new Set(process.argv.slice(2));
const reset = args.has('--reset');
const seed = args.has('--seed');

const touched = await setupAllSheets(reset, seed);
console.log(`Sheet setup complete: ${touched.join(', ')}`);
console.log(`Options: reset=${reset}, seed=${seed}`);
