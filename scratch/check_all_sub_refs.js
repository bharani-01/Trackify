const db = require('../backend/src/config/db');

async function checkAllReferences() {
  const client = await db.pool.connect();
  try {
    const ttRef = await client.query(`
      SELECT COUNT(*) as tt_on_user_sub
      FROM timetable t
      JOIN subjects s ON t.subject_id = s.id
      WHERE s.user_id IS NOT NULL;
    `);

    const adjRef = await client.query(`
      SELECT COUNT(*) as adj_on_user_sub
      FROM schedule_adjustments sa
      JOIN subjects s ON sa.adjusted_subject_id = s.id OR sa.original_subject_id = s.id
      WHERE s.user_id IS NOT NULL;
    `);

    console.log('Timetable references to user_sub:', ttRef.rows[0]);
    console.log('Adjustment references to user_sub:', adjRef.rows[0]);
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await db.pool.end();
  }
}

checkAllReferences();
