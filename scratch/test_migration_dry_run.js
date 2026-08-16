const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;
const pool = new Pool({
  connectionString,
  ssl: connectionString.includes('supabase') || connectionString.includes('pooler') ? { rejectUnauthorized: false } : false
});

async function main() {
  const client = await pool.connect();
  try {
    console.log('=== DRY RUN MIGRATION TEST V3 (TRANSACTION ROLLBACK) ===\n');
    await client.query('BEGIN');

    // 1. Identify all subject groups by department, semester, and code
    const groupsRes = await client.query(`
      SELECT 
        COALESCE(department_id::text, department) as dept,
        semester,
        UPPER(COALESCE(subject_code, code)) as code,
        array_agg(id ORDER BY created_at ASC, id ASC) as ids,
        array_agg(created_at ORDER BY created_at ASC, id ASC) as created_dates,
        COUNT(*) as cnt
      FROM subjects
      WHERE (department_id IS NOT NULL OR department IS NOT NULL) AND user_id IS NULL
      GROUP BY COALESCE(department_id::text, department), semester, UPPER(COALESCE(subject_code, code))
      HAVING COUNT(*) > 1
    `);

    console.log(`Found ${groupsRes.rows.length} duplicate groups across departments.`);

    let totalAttRemapped = 0;
    let totalAttConflictingPurged = 0;
    let totalTtRemapped = 0;
    let totalAdjRemapped = 0;
    let totalDeleted = 0;

    for (const group of groupsRes.rows) {
      const primaryId = group.ids[0]; // Earliest created master subject
      const dupIds = group.ids.slice(1);

      console.log(`\nProcessing Dept [${group.dept}] Sem [${group.semester}] Subject [${group.code}]:`);
      console.log(`  - Canonical Primary ID: ${primaryId} (Created: ${group.created_dates[0]})`);
      console.log(`  - Duplicate IDs to merge: ${dupIds.join(', ')}`);

      // 1. Delete conflicting attendance records that already exist on primaryId for the same user, date, and remarks
      const purgeConflictingAtt = await client.query(`
        DELETE FROM attendance a_dup
        WHERE a_dup.subject_id = ANY($1::uuid[])
          AND EXISTS (
            SELECT 1 FROM attendance a_prim
            WHERE a_prim.subject_id = $2
              AND a_prim.user_id = a_dup.user_id
              AND a_prim.date = a_dup.date
              AND (
                a_prim.remarks = a_dup.remarks
                OR (a_prim.remarks IS NULL AND a_dup.remarks IS NULL)
              )
          )
      `, [dupIds, primaryId]);

      if (purgeConflictingAtt.rowCount > 0) {
        console.log(`  - Purged ${purgeConflictingAtt.rowCount} duplicate conflicting attendance logs.`);
        totalAttConflictingPurged += purgeConflictingAtt.rowCount;
      }

      // 2. Remap remaining non-conflicting attendance records to primaryId
      const attRes = await client.query(`
        UPDATE attendance SET subject_id = $1 WHERE subject_id = ANY($2::uuid[])
      `, [primaryId, dupIds]);
      console.log(`  - Remapped ${attRes.rowCount} attendance records.`);
      totalAttRemapped += attRes.rowCount;

      // 3. Remap timetable slots to primaryId
      const ttRes = await client.query(`
        UPDATE timetable SET subject_id = $1 WHERE subject_id = ANY($2::uuid[])
      `, [primaryId, dupIds]);
      console.log(`  - Remapped ${ttRes.rowCount} timetable slots.`);
      totalTtRemapped += ttRes.rowCount;

      // 4. Remap schedule_adjustments
      const adj1 = await client.query(`
        UPDATE schedule_adjustments SET adjusted_subject_id = $1 WHERE adjusted_subject_id = ANY($2::uuid[])
      `, [primaryId, dupIds]);
      const adj2 = await client.query(`
        UPDATE schedule_adjustments SET original_subject_id = $1 WHERE original_subject_id = ANY($2::uuid[])
      `, [primaryId, dupIds]);
      totalAdjRemapped += (adj1.rowCount + adj2.rowCount);

      // 5. Delete duplicate subject entries
      const delRes = await client.query(`
        DELETE FROM subjects WHERE id = ANY($1::uuid[])
      `, [dupIds]);
      console.log(`  - Deleted ${delRes.rowCount} duplicate subject rows.`);
      totalDeleted += delRes.rowCount;
    }

    console.log('\n--- DRY RUN SUMMARY V3 ---');
    console.log(`Total Attendance Records Remapped: ${totalAttRemapped}`);
    console.log(`Total Conflicting Duplicate Attendance Logs Purged: ${totalAttConflictingPurged}`);
    console.log(`Total Timetable Slots Consolidated: ${totalTtRemapped}`);
    console.log(`Total Schedule Adjustments Consolidated: ${totalAdjRemapped}`);
    console.log(`Total Duplicate Subject Rows Purged: ${totalDeleted}`);

    console.log('\nRolling back dry run transaction...');
    await client.query('ROLLBACK');
    console.log('DRY RUN V3 COMPLETED 100% PERFECTLY WITH ZERO ERRORS!');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error in dry run V3:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
