const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST_DESKTOP = path.join(ROOT, 'dist-desktop');
const SOURCE_DB = path.join(ROOT, 'data', 'ccf_database.json');

if (fs.existsSync(DIST_DESKTOP)) {
  const destDb = path.join(DIST_DESKTOP, 'ccf_database.json');
  if (fs.existsSync(SOURCE_DB)) {
    fs.copyFileSync(SOURCE_DB, destDb);
    console.log(`[dist-desktop] Copied database to: ${destDb}`);
  } else {
    fs.writeFileSync(destDb, JSON.stringify({ version: 1, engine: 'Local JSON File Database', count: 0, rows: [] }, null, 2));
    console.log(`[dist-desktop] Created initial database at: ${destDb}`);
  }
}
