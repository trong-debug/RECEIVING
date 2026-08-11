const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'deliveries.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS deliveries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    driver_name TEXT NOT NULL,
    site_name TEXT NOT NULL,
    address TEXT,
    arrived_at TEXT NOT NULL,
    submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
    num_pallets INTEGER,
    num_cartons INTEGER,
    num_satchels INTEGER,
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

// Seed some default drivers and sites if empty
const driverCount = db.prepare('SELECT COUNT(*) as n FROM drivers').get().n;
if (driverCount === 0) {
  const insertDriver = db.prepare('INSERT OR IGNORE INTO drivers (name) VALUES (?)');
  ['Add New Driver...'].forEach(n => insertDriver.run(n));
}

module.exports = db;
