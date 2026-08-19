const db = require('../backend/src/config/db');

async function dedupeE06() {
  const client = await db.pool.connect();
  try {
    console.log('====================================================');
    console.log('=== DEDUPLICATING E06 MASTER SUBJECTS ===');
    console.log('====================================================\n');

    await client.query('BEGIN');

    // 1. Fetch department E06 ID
    const dRes = await client.query("SELECT id FROM departments WHERE UPPER(code) = 'E06'");
    const deptId = dRes.rows[0].id;

    // 2. Identify canonical master subject for each code (earliest created_at)
    const canonicalRes = await client.query(`
      SELECT DISTINCT ON (UPPER(COALESCE(subject_code, code)))
             id as canonical_id, UPPER(COALESCE(subject_code, code)) as code
      FROM subjects
      WHERE (department_id = $1 OR UPPER(department) = 'E06')
        AND semester = 5
        AND user_id IS NULL
      ORDER BY UPPER(COALESCE(subject_code, code)), created_at ASC, id ASC
    `, [deptId]);

    const canonicalMap = {};
    canonicalRes.rows.forEach(r => canonicalMap[r.code] = r.canonical_id);

    console.log(`Identified ${Object.keys(canonicalMap).length} canonical master subjects for E06.`);

    // 3. Remap timetable slots to canonical subject IDs
    const remapTt = await client.query(`
      UPDATE timetable
      SET subject_id = master.id
      FROM subjects s
      JOIN (
        SELECT DISTINCT ON (UPPER(COALESCE(subject_code, code)))
               id, UPPER(COALESCE(subject_code, code)) as code
        FROM subjects
        WHERE (department_id = $1 OR UPPER(department) = 'E06')
          AND semester = 5 AND user_id IS NULL
        ORDER BY UPPER(COALESCE(subject_code, code)), created_at ASC, id ASC
      ) master ON UPPER(COALESCE(s.subject_code, s.code)) = master.code
      WHERE timetable.subject_id = s.id
        AND (timetable.department_id = $1 OR UPPER(timetable.department) = 'E06')
        AND timetable.subject_id != master.id
      RETURNING timetable.id;
    `, [deptId]);

    console.log(`[Remapped Timetable Slots]: ${remapTt.rows.length} timetable entries updated.`);

    // 4. Remap attendance records to canonical subject IDs (if any exist)
    const remapAtt = await client.query(`
      UPDATE attendance
      SET subject_id = master.id
      FROM subjects s
      JOIN (
        SELECT DISTINCT ON (UPPER(COALESCE(subject_code, code)))
               id, UPPER(COALESCE(subject_code, code)) as code
        FROM subjects
        WHERE (department_id = $1 OR UPPER(department) = 'E06')
          AND semester = 5 AND user_id IS NULL
        ORDER BY UPPER(COALESCE(subject_code, code)), created_at ASC, id ASC
      ) master ON UPPER(COALESCE(s.subject_code, s.code)) = master.code
      WHERE attendance.subject_id = s.id
        AND (s.department_id = $1 OR UPPER(s.department) = 'E06')
        AND attendance.subject_id != master.id
      RETURNING attendance.id;
    `, [deptId]);

    console.log(`[Remapped Attendance Logs]: ${remapAtt.rows.length} attendance records updated.`);

    // 5. Safely delete duplicate unreferenced subject header rows
    const purgeDupes = await client.query(`
      DELETE FROM subjects
      WHERE (department_id = $1 OR UPPER(department) = 'E06')
        AND semester = 5
        AND user_id IS NULL
        AND id NOT IN (
          SELECT DISTINCT ON (UPPER(COALESCE(subject_code, code))) id
          FROM subjects
          WHERE (department_id = $1 OR UPPER(department) = 'E06')
            AND semester = 5 AND user_id IS NULL
          ORDER BY UPPER(COALESCE(subject_code, code)), created_at ASC, id ASC
        )
      RETURNING id, subject_code;
    `, [deptId]);

    console.log(`[Purged Duplicate Header Rows]: ${purgeDupes.rows.length} duplicate subject rows purged.`);

    await client.query('COMMIT');
    console.log('\n====================================================');
    console.log('=== E06 DEDUPLICATION COMPLETED WITH 100% SUCCESS ===');
    console.log('====================================================');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Deduplication Error:', err);
  } finally {
    client.release();
    process.exit(0);
  }
}

dedupeE06();
