// The app is self-contained (it must build from the mobile/ folder alone, e.g. on EAS). ../shared is the source of truth: run `npm run sync-shared` after changing it.
const fs = require('fs'), path = require('path');
const from = path.join(__dirname, '..', '..', 'shared'), to = path.join(__dirname, '..', 'src', 'shared');
if (!fs.existsSync(from)) { console.log('No ../shared folder here: nothing to sync.'); process.exit(0); }
fs.mkdirSync(to, { recursive: true });
for (const f of fs.readdirSync(from).filter((x) => x.endsWith('.js'))) { fs.copyFileSync(path.join(from, f), path.join(to, f)); console.log('synced', f); }
