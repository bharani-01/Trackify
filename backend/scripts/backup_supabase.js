const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SUPABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres.xjmruzikomdudigfegyo:.trackme%40321.@aws-1-ap-south-1.pooler.supabase.com:5432/postgres';

const BACKUP_DIR = path.join(__dirname, '..', '..', 'backups', 'supabase');
const CSV_DIR = path.join(BACKUP_DIR, 'csv');

const TABLES = [
  'departments',
  'users',
  'subjects',
  'timetable',
  'attendance',
  'settings',
  'system_settings',
  'schedule_adjustments',
  'holidays',
  'audit_logs',
  'backups',
  'email_queue',
  'notifications'
];

function ensureDirectories() {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  if (!fs.existsSync(CSV_DIR)) fs.mkdirSync(CSV_DIR, { recursive: true });
}

function escapeCsvField(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

async function backupSupabase() {
  console.log('==================================================');
  console.log('  🚀 SUPABASE POSTGRESQL BACKUP SYSTEM (SQLite & CSV)');
  console.log('==================================================');

  ensureDirectories();

  const client = new Client({ connectionString: SUPABASE_URL });

  try {
    await client.connect();
    console.log('✅ Connected to Supabase Cloud PostgreSQL database!');

    let totalRecordsBackedUp = 0;
    const dumpedTablesData = {};

    for (const table of TABLES) {
      console.log(`\n📦 Backing up Supabase table: [${table}]...`);
      try {
        const res = await client.query(`SELECT * FROM "${table}"`);
        const rows = res.rows;
        dumpedTablesData[table] = rows;
        totalRecordsBackedUp += rows.length;

        console.log(`   - Fetched ${rows.length} records`);

        // Export to CSV
        const csvPath = path.join(CSV_DIR, `${table}.csv`);
        if (rows.length > 0) {
          const headers = Object.keys(rows[0]);
          const csvLines = [headers.join(',')];
          for (const row of rows) {
            const line = headers.map(h => escapeCsvField(row[h])).join(',');
            csvLines.push(line);
          }
          fs.writeFileSync(csvPath, csvLines.join('\n'), 'utf8');
          console.log(`   - Saved CSV: backups/supabase/csv/${table}.csv`);
        } else {
          fs.writeFileSync(csvPath, '# Empty Table\n', 'utf8');
          console.log(`   - Saved CSV: backups/supabase/csv/${table}.csv (0 records)`);
        }
      } catch (err) {
        console.error(`   ⚠️ Table error for [${table}]:`, err.message);
      }
    }

    await client.end();

    // Export to SQLite using Python sqlite3 script
    const jsonDumpPath = path.join(BACKUP_DIR, 'temp_dump.json');
    fs.writeFileSync(jsonDumpPath, JSON.stringify(dumpedTablesData), 'utf8');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const sqlitePath = path.join(BACKUP_DIR, `supabase_backup_${timestamp}.sqlite3`);
    const latestSqlitePath = path.join(BACKUP_DIR, 'supabase_latest.sqlite3');

    const pyScript = `
import json, sqlite3, os, shutil
json_file = r"${jsonDumpPath.replace(/\\/g, '/')}"
sqlite_file = r"${sqlitePath.replace(/\\/g, '/')}"
latest_file = r"${latestSqlitePath.replace(/\\/g, '/')}"

with open(json_file, 'r', encoding='utf-8') as f:
    data = json.load(f)

conn = sqlite3.connect(sqlite_file)
cur = conn.cursor()

for table, rows in data.items():
    if rows:
        cols = list(rows[0].keys())
        col_defs = ", ".join([f'"{c}" TEXT' for c in cols])
        cur.execute(f'DROP TABLE IF EXISTS "{table}";')
        cur.execute(f'CREATE TABLE "{table}" ({col_defs});')
        placeholders = ", ".join(["?"] * len(cols))
        insert_sql = f'INSERT INTO "{table}" VALUES ({placeholders});'
        sqlite_data = [[str(r[c]) if r[c] is not None else None for c in cols] for r in rows]
        cur.executemany(insert_sql, sqlite_data)
        conn.commit()

conn.close()
shutil.copyfile(sqlite_file, latest_file)
if os.path.exists(json_file): os.remove(json_file)
print("SQLite database written successfully!")
`;

    const pyScriptPath = path.join(BACKUP_DIR, 'convert_sqlite.py');
    fs.writeFileSync(pyScriptPath, pyScript, 'utf8');

    execSync(`python "${pyScriptPath}"`);
    if (fs.existsSync(pyScriptPath)) fs.unlinkSync(pyScriptPath);

    console.log('\n==================================================');
    console.log('  ✅ SUPABASE BACKUP COMPLETED SUCCESSFULLY!');
    console.log('==================================================');
    console.log(` 📂 Backup Directory: ${BACKUP_DIR}`);
    print(` 🗃️ SQLite Database:  backups/supabase/supabase_latest.sqlite3`);
    print(` 📄 CSV Files:       backups/supabase/csv/*.csv (${TABLES.length} files)`);
    console.log(` 📊 Total Records:    ${totalRecordsBackedUp} rows backed up from Supabase`);
    console.log('==================================================\n');

  } catch (error) {
    console.error('❌ Supabase Backup Error:', error.message);
  }
}

function print(msg) { console.log(msg); }

backupSupabase();
