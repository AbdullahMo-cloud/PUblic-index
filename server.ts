import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { INITIAL_CCF_DATA } from './src/utils/sampleData';
import { DEFAULT_USER_ALLOCATIONS } from './src/types/allocation';

// Dual ESM / CommonJS directory resolution
let _currentDirname = process.cwd();
try {
  if (typeof __dirname !== 'undefined') {
    _currentDirname = __dirname;
  } else {
    const metaUrl = (import.meta as any)?.url;
    if (metaUrl) {
      _currentDirname = path.dirname(fileURLToPath(metaUrl));
    }
  }
} catch {
  _currentDirname = process.cwd();
}

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// High limit (50MB) for handling enterprise sheets with tens of thousands of rows
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Storage Strategy:
// - Portable Electron app: process.env.APP_DATA_DIR points to folder beside .exe
// - Installed Electron app: process.env.APP_DATA_DIR points to %APPDATA%/Change Factory Index/data
// - Dev / Web fallback: ./data directory
const DATA_DIR = process.env.APP_DATA_DIR
  ? path.resolve(process.env.APP_DATA_DIR)
  : path.resolve(_currentDirname, 'data');

const DB_FILE = fs.existsSync(path.join(DATA_DIR, 'ccf_database.json'))
  ? path.join(DATA_DIR, 'ccf_database.json')
  : fs.existsSync(path.join(DATA_DIR, 'data', 'ccf_database.json'))
  ? path.join(DATA_DIR, 'data', 'ccf_database.json')
  : path.join(DATA_DIR, 'ccf_database.json');

// Ensure database directory exists
const dbDir = path.dirname(DB_FILE);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

interface DatabasePayload {
  version: number;
  engine: string;
  lastUpdated: string | null;
  count: number;
  rows: any[];
}

function readDatabase(): DatabasePayload {
  if (!fs.existsSync(DB_FILE)) {
    return {
      version: 1,
      engine: 'Local JSON File Database (Portable Electron Ready)',
      lastUpdated: null,
      count: 0,
      rows: [],
    };
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading ccf_database.json:', err);
    return {
      version: 1,
      engine: 'Local JSON File Database (Portable Electron Ready)',
      lastUpdated: null,
      count: 0,
      rows: [],
    };
  }
}

function writeDatabase(data: DatabasePayload): void {
  const tmpFile = `${DB_FILE}.tmp.${Date.now()}`;
  fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmpFile, DB_FILE);
}

// -------------------------------------------------------------
// REST API STORAGE ENGINE ENDPOINTS
// -------------------------------------------------------------

// 1. GET /api/database -> Retrieve full persisted database
app.get('/api/database', (_req, res) => {
  try {
    const db = readDatabase();
    res.json({
      success: true,
      engine: db.engine || 'Local JSON File Database (Portable Electron Ready)',
      count: db.count || db.rows.length,
      lastUpdated: db.lastUpdated,
      rows: db.rows,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to read database' });
  }
});

// 2. POST /api/database -> Save/persist database atomically
app.post('/api/database', (req, res) => {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows)) {
      return res.status(400).json({ success: false, error: 'Expected "rows" to be an array' });
    }

    const payload: DatabasePayload = {
      version: 1,
      engine: 'Local JSON File Database (Portable Electron Ready)',
      lastUpdated: new Date().toISOString(),
      count: rows.length,
      rows,
    };

    writeDatabase(payload);
    console.log(`[StorageEngine] Persisted ${rows.length} rows to ${DB_FILE}`);

    res.json({
      success: true,
      count: rows.length,
      lastUpdated: payload.lastUpdated,
      message: `Persisted ${rows.length} records to local database file successfully`,
    });
  } catch (err: any) {
    console.error('Failed to write database:', err);
    res.status(500).json({ success: false, error: err?.message || 'Failed to write database' });
  }
});

// 3. DELETE /api/database -> Remove/wipe existing data
app.delete('/api/database', (_req, res) => {
  try {
    const payload: DatabasePayload = {
      version: 1,
      engine: 'Local JSON File Database (Portable Electron Ready)',
      lastUpdated: new Date().toISOString(),
      count: 0,
      rows: [],
    };
    writeDatabase(payload);
    console.log(`[StorageEngine] Database wiped successfully`);
    res.json({
      success: true,
      count: 0,
      message: 'All records removed from local database file.',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to wipe database' });
  }
});

// 4. POST /api/database/seed -> Restore initial sample data
app.post('/api/database/seed', async (_req, res) => {
  try {
    const payload: DatabasePayload = {
      version: 1,
      engine: 'Local JSON File Database (Portable Electron Ready)',
      lastUpdated: new Date().toISOString(),
      count: INITIAL_CCF_DATA.length,
      rows: INITIAL_CCF_DATA,
    };
    writeDatabase(payload);
    res.json({
      success: true,
      count: INITIAL_CCF_DATA.length,
      message: 'Restored sample demo seed records.',
      rows: INITIAL_CCF_DATA,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to seed database' });
  }
});

// 5. GET /api/database/info -> Status & Metadata for Electron & Portable setup
app.get('/api/database/info', (_req, res) => {
  try {
    const exists = fs.existsSync(DB_FILE);
    let sizeBytes = 0;
    if (exists) {
      const stats = fs.statSync(DB_FILE);
      sizeBytes = stats.size;
    }
    const db = readDatabase();
    res.json({
      success: true,
      engine: 'Local File JSON Database (Portable Electron Ready)',
      dbFileName: 'ccf_database.json',
      relativeLocation: './data/ccf_database.json',
      absoluteLocation: DB_FILE,
      folderLocation: DATA_DIR,
      isPortableElectronReady: true,
      sizeBytes,
      recordCount: db.count || db.rows.length,
      lastUpdated: db.lastUpdated,
      portableEngineGuide: {
        type: 'Zero-install standalone JSON/SQL engine',
        bestFitReason:
          'Local JSON file database requires zero native C++ runtime compilation, avoiding Electron packaging crashes common with SQLite (node-gyp/better-sqlite3). The database file resides right beside the portable app executable.',
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to get database info' });
  }
});

// 5b. GET /api/allocations -> Get user and HOD allocations table
const ALLOC_FILE = path.join(DATA_DIR, 'user_allocations.json');

app.get('/api/allocations', async (_req, res) => {
  try {
    if (!fs.existsSync(ALLOC_FILE)) {
      fs.writeFileSync(ALLOC_FILE, JSON.stringify(DEFAULT_USER_ALLOCATIONS, null, 2), 'utf-8');
      return res.json(DEFAULT_USER_ALLOCATIONS);
    }
    const raw = fs.readFileSync(ALLOC_FILE, 'utf-8');
    res.json(JSON.parse(raw));
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to read allocations' });
  }
});

// 5c. POST /api/allocations -> Save user and HOD allocations table
app.post('/api/allocations', (req, res) => {
  try {
    const allocations = req.body;
    if (!Array.isArray(allocations)) {
      return res.status(400).json({ error: 'Expected array of allocations' });
    }
    const tmpFile = `${ALLOC_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tmpFile, JSON.stringify(allocations, null, 2), 'utf-8');
    fs.renameSync(tmpFile, ALLOC_FILE);
    res.json({ success: true, count: allocations.length });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to save allocations' });
  }
});

// 6. GET /api/database/export/json -> Direct JSON database file download
app.get('/api/database/export/json', (_req, res) => {
  try {
    const db = readDatabase();
    const filename = `ccf_database_${new Date().toISOString().slice(0, 10)}.json`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(db, null, 2));
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to export JSON' });
  }
});

// 7. GET /api/database/export/sql -> Generate ANSI / SQLite SQL Dump
app.get('/api/database/export/sql', (_req, res) => {
  try {
    const db = readDatabase();
    const rows = db.rows || [];

    let sql = `-- ==========================================================\n`;
    sql += `-- Change Factory Index - CCF Database SQL Dump\n`;
    sql += `-- Engine: SQLite / PostgreSQL / MySQL Compatible\n`;
    sql += `-- Generated: ${new Date().toISOString()}\n`;
    sql += `-- Total Records: ${rows.length}\n`;
    sql += `-- ==========================================================\n\n`;

    sql += `CREATE TABLE IF NOT EXISTS ccf_records (\n`;
    sql += `  id VARCHAR(64) PRIMARY KEY,\n`;
    sql += `  issue_key VARCHAR(64) NOT NULL,\n`;
    sql += `  summary TEXT,\n`;
    sql += `  assignee VARCHAR(128),\n`;
    sql += `  hod VARCHAR(128),\n`;
    sql += `  status VARCHAR(64),\n`;
    sql += `  created_date VARCHAR(64),\n`;
    sql += `  created_year INTEGER,\n`;
    sql += `  created_month VARCHAR(32),\n`;
    sql += `  monitoring_start_date VARCHAR(64),\n`;
    sql += `  sla_days INTEGER,\n`;
    sql += `  sla_duration VARCHAR(32),\n`;
    sql += `  committed_end_date VARCHAR(64),\n`;
    sql += `  sla_progress_status VARCHAR(32),\n`;
    sql += `  ccf_type VARCHAR(32),\n`;
    sql += `  is_new_case BOOLEAN,\n`;
    sql += `  raw_payload TEXT\n`;
    sql += `);\n\n`;

    sql += `BEGIN TRANSACTION;\n`;
    for (const r of rows) {
      const escape = (val: any) =>
        val == null ? 'NULL' : `'${String(val).replace(/'/g, "''")}'`;

      const id = escape(r.issueKey || r.id || Math.random().toString(36).slice(2));
      const issueKey = escape(r.issueKey || '');
      const summary = escape(r.summary || '');
      const assignee = escape(r.assignee || '');
      const hod = escape(r.hod || '');
      const status = escape(r.status || '');
      const createdDate = escape(r.created || '');
      const createdYear = r.createdYear ? Number(r.createdYear) : 'NULL';
      const createdMonth = escape(r.createdMonth || '');
      const monitoringStartDate = escape(r.monitoringStartDate || '');
      const slaDays = r.slaDays != null ? Number(r.slaDays) : 'NULL';
      const slaDuration = escape(r.slaDuration || '');
      const committedEndDate = escape(r.committedEndDate || '');
      const slaProgress = escape(r.slaProgressStatus || '');
      const ccfType = escape(r.ccfType || 'Internal');
      const isNewCase = r.isNewCase ? 1 : 0;
      const rawPayload = escape(JSON.stringify(r.rawRowData || {}));

      sql += `INSERT OR REPLACE INTO ccf_records (id, issue_key, summary, assignee, hod, status, created_date, created_year, created_month, monitoring_start_date, sla_days, sla_duration, committed_end_date, sla_progress_status, ccf_type, is_new_case, raw_payload) VALUES (${id}, ${issueKey}, ${summary}, ${assignee}, ${hod}, ${status}, ${createdDate}, ${createdYear}, ${createdMonth}, ${monitoringStartDate}, ${slaDays}, ${slaDuration}, ${committedEndDate}, ${slaProgress}, ${ccfType}, ${isNewCase}, ${rawPayload});\n`;
    }
    sql += `COMMIT;\n`;

    const filename = `ccf_database_${new Date().toISOString().slice(0, 10)}.sql`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/sql');
    res.send(sql);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to export SQL' });
  }
});

// -------------------------------------------------------------
// VITE DEV MIDDLEWARE & PRODUCTION SERVING
// -------------------------------------------------------------
async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = fs.existsSync(path.resolve(_currentDirname, 'dist', 'index.html'))
      ? path.resolve(_currentDirname, 'dist')
      : fs.existsSync(path.resolve(_currentDirname, 'index.html'))
      ? _currentDirname
      : path.resolve(process.cwd(), 'dist');

    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Change Factory Index Server online at http://0.0.0.0:${PORT}`);
    console.log(`📁 Database File: ${DB_FILE}`);
  });
}

startServer();
