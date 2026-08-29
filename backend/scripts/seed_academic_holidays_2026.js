const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;

const pool = new Pool({
  connectionString,
  ssl: process.env.DB_SSL === 'true' || connectionString.includes('supabase') || connectionString.includes('pooler')
    ? { rejectUnauthorized: false }
    : false
});

const ACADEMIC_HOLIDAYS = [
  { date: '2026-08-26', name: 'Milad-un-Nabi', dayName: 'Wednesday' },
  { date: '2026-09-12', name: '2nd Saturday', dayName: 'Saturday' },
  { date: '2026-09-14', name: 'Vinayakar Chathurthi', dayName: 'Monday' },
  { date: '2026-09-26', name: '4th Saturday', dayName: 'Saturday' },
  { date: '2026-10-02', name: 'Gandhi Jayanthi', dayName: 'Friday' },
  { date: '2026-10-10', name: '2nd Saturday', dayName: 'Saturday' },
  { date: '2026-10-19', name: 'Ayutha Pooja', dayName: 'Monday' },
  { date: '2026-10-20', name: 'Vijaya Dasami', dayName: 'Tuesday' },
  { date: '2026-10-24', name: '4th Saturday', dayName: 'Saturday' },
  { date: '2026-11-14', name: '2nd Saturday', dayName: 'Saturday' },
  { date: '2026-11-28', name: '4th Saturday', dayName: 'Saturday' }
];

async function seedAcademicHolidays() {
  console.log('🚀 Starting Academic Calendar 2026-2027 Holiday Seeding (Post 24-08-2026)...');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Fetch admin user for audit logging
    const adminRes = await client.query("SELECT id FROM users WHERE role = 'admin' LIMIT 1;");
    const adminId = adminRes.rows.length > 0 ? adminRes.rows[0].id : null;

    let updatedCount = 0;
    let insertedCount = 0;
    let purgedAttendanceCount = 0;

    for (const h of ACADEMIC_HOLIDAYS) {
      // Check if holiday already exists on this date (global / null department)
      const existing = await client.query(
        "SELECT id, name, TO_CHAR(date, 'YYYY-MM-DD') as date_str FROM holidays WHERE date = $1 AND department_id IS NULL AND department IS NULL;",
        [h.date]
      );

      if (existing.rows.length > 0) {
        const currentName = existing.rows[0].name;
        if (currentName !== h.name) {
          await client.query(
            "UPDATE holidays SET name = $1 WHERE id = $2;",
            [h.name, existing.rows[0].id]
          );
          console.log(`✏️ Updated holiday on ${h.date} (${h.dayName}): '${currentName}' -> '${h.name}'`);
          updatedCount++;
        } else {
          console.log(`ℹ️ Holiday on ${h.date} (${h.dayName}) already set as '${h.name}'`);
        }
      } else {
        await client.query(
          "INSERT INTO holidays (name, date, department_id, department, semester) VALUES ($1, $2, NULL, NULL, NULL);",
          [h.name, h.date]
        );
        console.log(`➕ Added holiday on ${h.date} (${h.dayName}): '${h.name}'`);
        insertedCount++;
      }

      // Purge any conflicting student attendance records logged for this holiday date
      const delAttRes = await client.query(
        "DELETE FROM attendance WHERE date = $1;",
        [h.date]
      );
      if (delAttRes.rowCount > 0) {
        console.log(`🧹 Cleaned up ${delAttRes.rowCount} conflicting attendance records on holiday ${h.date}`);
        purgedAttendanceCount += delAttRes.rowCount;
      }
    }

    // 2. Add audit log
    if (adminId) {
      await client.query(
        `INSERT INTO audit_logs (user_id, action, details, ip_address)
         VALUES ($1, 'SEED_ACADEMIC_HOLIDAYS', $2, '127.0.0.1');`,
        [adminId, `Seeded academic calendar holidays post 24-08-2026: ${insertedCount} added, ${updatedCount} updated, ${purgedAttendanceCount} attendance logs purged.`]
      );
    }

    await client.query('COMMIT');

    console.log('\n======================================================');
    console.log('✅ Academic Calendar Holiday Seeding Completed Successfully!');
    console.log(`📊 Summary:`);
    console.log(` - ➕ Inserted: ${insertedCount} new holidays`);
    console.log(` - ✏️ Updated:  ${updatedCount} existing holidays`);
    console.log(` - 🧹 Purged:   ${purgedAttendanceCount} conflicting attendance records`);
    console.log('======================================================\n');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error during academic holiday seeding:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seedAcademicHolidays();
