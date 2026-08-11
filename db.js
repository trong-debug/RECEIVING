const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'deliveries.db');
const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS deliveries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    driver_name TEXT NOT NULL,
    site_name TEXT NOT NULL,
    address TEXT,
    arrived_at TEXT NOT NULL,
    submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
    num_pallets INTEGER DEFAULT 0,
    num_cartons INTEGER DEFAULT 0,
    num_satchels INTEGER DEFAULT 0,
    chep_count INTEGER DEFAULT 0,
    chep_disposition TEXT,
    loscam_count INTEGER DEFAULT 0,
    loscam_disposition TEXT,
    plain_count INTEGER DEFAULT 0,
    plain_disposition TEXT,
    condition TEXT NOT NULL DEFAULT 'Good',
    recipient_name TEXT,
    notes TEXT
  );

  CREATE TABLE IF NOT EXISTS drivers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS sites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    address TEXT
  );
`);

// Migrate existing DB — add pallet columns if missing
const existingCols = db.prepare('PRAGMA table_info(deliveries)').all().map(c => c.name);
const migrations = [
  ['chep_count',        'INTEGER DEFAULT 0'],
  ['chep_disposition',  'TEXT'],
  ['loscam_count',      'INTEGER DEFAULT 0'],
  ['loscam_disposition','TEXT'],
  ['plain_count',       'INTEGER DEFAULT 0'],
  ['plain_disposition', 'TEXT'],
  ['transport_name',    'TEXT'],
  ['temperature',       'TEXT'],
  ['chep_docket',       'TEXT'],
];
for (const [col, def] of migrations) {
  if (!existingCols.includes(col)) {
    db.exec(`ALTER TABLE deliveries ADD COLUMN ${col} ${def}`);
  }
}

// Seed some default drivers and sites if empty
const driverCount = db.prepare('SELECT COUNT(*) as n FROM drivers').get().n;
if (driverCount === 0) {
  const insertDriver = db.prepare('INSERT OR IGNORE INTO drivers (name) VALUES (?)');
  ['Add New Driver...'].forEach(n => insertDriver.run(n));
}

module.exports = db;
