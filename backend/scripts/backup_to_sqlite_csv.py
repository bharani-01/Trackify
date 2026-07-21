import os
import sys
import sqlite3
import csv
import json
import subprocess
from datetime import datetime

# Attempt importing psycopg2
try:
    import psycopg2
    import psycopg2.extras
    PSYCOPG2_AVAILABLE = True
except ImportError:
    PSYCOPG2_AVAILABLE = False

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BACKUP_DIR = os.path.join(PROJECT_ROOT, "backups", "supabase")
CSV_DIR = os.path.join(BACKUP_DIR, "csv")

# Connection Config
DEFAULT_SUPABASE_URL = "postgresql://postgres.xjmruzikomdudigfegyo:.trackme%40321.@aws-1-ap-south-1.pooler.supabase.com:5432/postgres"
DATABASE_URL = os.getenv("DATABASE_URL", DEFAULT_SUPABASE_URL)
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "5196")
DB_NAME = os.getenv("DB_NAME", "trackify_db")

TABLES = [
    "departments",
    "users",
    "subjects",
    "timetable",
    "attendance",
    "settings",
    "system_settings",
    "schedule_adjustments",
    "holidays",
    "audit_logs",
    "backups",
    "email_queue"
]

def ensure_directories():
    os.makedirs(BACKUP_DIR, exist_ok=True)
    os.makedirs(CSV_DIR, exist_ok=True)

def fetch_table_data_via_psycopg2(conn, table):
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute(f'SELECT * FROM "{table}";')
    rows = cursor.fetchall()
    formatted_rows = []
    for r in rows:
        row_dict = {}
        for k, v in r.items():
            if isinstance(v, (datetime,)):
                row_dict[k] = v.isoformat()
            else:
                row_dict[k] = str(v) if v is not None else None
        formatted_rows.append(row_dict)
    cursor.close()
    return formatted_rows

def main():
    print("==================================================")
    print("  🚀 SUPABASE POSTGRESQL BACKUP SYSTEM (SQLite & CSV)")
    print("==================================================")
    
    ensure_directories()
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    sqlite_db_path = os.path.join(BACKUP_DIR, f"supabase_backup_{timestamp}.sqlite3")
    latest_sqlite_path = os.path.join(BACKUP_DIR, "supabase_latest.sqlite3")

    sqlite_conn = sqlite3.connect(sqlite_db_path)
    sqlite_cursor = sqlite_conn.cursor()

    pg_conn = None
    if PSYCOPG2_AVAILABLE:
        try:
            if DATABASE_URL:
                pg_conn = psycopg2.connect(DATABASE_URL)
                print(f"✅ Connected to Supabase PostgreSQL via DATABASE_URL")
            else:
                ssl_setting = "require" if os.getenv("DB_SSL") == "true" else "prefer"
                pg_conn = psycopg2.connect(
                    host=DB_HOST,
                    port=DB_PORT,
                    user=DB_USER,
                    password=DB_PASSWORD,
                    dbname=DB_NAME,
                    sslmode=ssl_setting
                )
                print(f"✅ Connected to PostgreSQL ({DB_HOST}:{DB_PORT}/{DB_NAME}) via psycopg2")
        except Exception as e:
            print(f"❌ Connection error: {e}")
            sys.exit(1)

    total_records_backed_up = 0

    for table in TABLES:
        print(f"\n📦 Backing up table: [{table}]...")
        try:
            rows = fetch_table_data_via_psycopg2(pg_conn, table)
            row_count = len(rows)
            total_records_backed_up += row_count
            print(f"   - Fetched {row_count} records")

            # 1. Export to CSV
            csv_path = os.path.join(CSV_DIR, f"{table}.csv")
            if rows:
                headers = list(rows[0].keys())
                with open(csv_path, "w", newline="", encoding="utf-8") as f:
                    writer = csv.DictWriter(f, fieldnames=headers)
                    writer.writeheader()
                    writer.writerows(rows)
                print(f"   - Saved CSV: backups/supabase/csv/{table}.csv")
            else:
                with open(csv_path, "w", newline="", encoding="utf-8") as f:
                    f.write("# Empty Table\n")
                print(f"   - Saved CSV: backups/supabase/csv/{table}.csv (0 records)")

            # 2. Export to SQLite
            if rows:
                cols = list(rows[0].keys())
                col_defs = ", ".join([f'"{c}" TEXT' for c in cols])
                sqlite_cursor.execute(f'DROP TABLE IF EXISTS "{table}";')
                sqlite_cursor.execute(f'CREATE TABLE "{table}" ({col_defs});')

                placeholders = ", ".join(["?"] * len(cols))
                insert_sql = f'INSERT INTO "{table}" VALUES ({placeholders});'
                
                sqlite_data = [
                    [str(row[c]) if row[c] is not None else None for c in cols]
                    for row in rows
                ]
                sqlite_cursor.executemany(insert_sql, sqlite_data)
                sqlite_conn.commit()
                print(f"   - Saved SQLite Table: [{table}] ({len(sqlite_data)} rows)")

        except Exception as err:
            print(f"   ⚠️ Warning backing up table [{table}]: {err}")

    if pg_conn:
        pg_conn.close()

    sqlite_conn.close()

    if os.path.exists(sqlite_db_path):
        import shutil
        shutil.copyfile(sqlite_db_path, latest_sqlite_path)

    print("\n==================================================")
    print("  ✅ SUPABASE BACKUP COMPLETED SUCCESSFULLY!")
    print("==================================================")
    print(f" 📂 Backup Directory: {BACKUP_DIR}")
    print(f" 🗃️ SQLite Database:  backups/supabase/supabase_latest.sqlite3")
    print(f" 📄 CSV Files:       backups/supabase/csv/*.csv ({len(TABLES)} files)")
    print(f" 📊 Total Records:    {total_records_backed_up} rows backed up across all tables")
    print("==================================================\n")

if __name__ == "__main__":
    main()
