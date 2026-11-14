// Saves your MongoDB Atlas database password into backend/.env without showing it
// on screen, then tests the connection. Run with: npm run db:set-password

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { askHidden } from './lib/prompt.js';

const BACKEND_DIR = fileURLToPath(new URL('..', import.meta.url));
const ENV_PATH = fileURLToPath(new URL('../.env', import.meta.url));
const URI_WITH_PASSWORD = /^(MONGODB_URI=mongodb(?:\+srv)?:\/\/[^:/@\s]+:)([^@\s]*)(@.*)$/m;

if (!fs.existsSync(ENV_PATH)) {
  console.error('backend/.env does not exist yet. Follow the Setup steps in README.md first.');
  process.exit(1);
}

const current = fs.readFileSync(ENV_PATH, 'utf8');

if (!URI_WITH_PASSWORD.test(current)) {
  console.error(
    'MONGODB_URI in backend/.env is not an Atlas address with a username.\n' +
      'It should look like: mongodb+srv://USERNAME:PASSWORD@cluster0.xxxxx.mongodb.net/medicare?retryWrites=true&w=majority',
  );
  process.exit(1);
}

console.log('Copy your Atlas database password, then paste it here with a right-click, or type it.');
console.log('You will see only * symbols. Press Enter when finished.\n');

const entered = await askHidden('Password: ');
const password = entered?.trim();

if (!password) {
  console.log('No password entered. Nothing was changed.');
  process.exit(1);
}

// Encoding keeps symbols such as @ / : from breaking the address.
fs.writeFileSync(
  ENV_PATH,
  current.replace(URI_WITH_PASSWORD, (_match, start, _old, end) => `${start}${encodeURIComponent(password)}${end}`),
);
console.log('\nPassword saved to backend/.env.\n');

const check = spawnSync(process.execPath, ['scripts/check-database.js'], { cwd: BACKEND_DIR, stdio: 'inherit' });
process.exitCode = check.status ?? 1;
