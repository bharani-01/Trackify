const db = require('../config/db');

/**
 * Get schedule adjustments for a department/semester on a date
 */
const getByCohort = async (department, semester, date) => {
  const query = `
    SELECT sa.*, 
           s.subject_name as adjusted_subject_name, s.subject_code as adjusted_subject_code, s.color as adjusted_subject_color,
           o.subject_name as original_subject_name, o.subject_code as original_subject_code
    FROM schedule_adjustments sa
    LEFT JOIN subjects s ON sa.adjusted_subject_id = s.id
    LEFT JOIN subjects o ON sa.original_subject_id = o.id
    WHERE sa.department = $1 AND sa.semester = $2 AND sa.date = $3
  `;
  const result = await db.query(query, [department, semester, date]);
  return result.rows;
};

/**
 * Save schedule adjustments for a department/semester on a date
 */
const saveCohortAdjustments = async (department, semester, date, adjustments) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Delete existing adjustments
    await client.query(
      'DELETE FROM schedule_adjustments WHERE department = $1 AND semester = $2 AND date = $3',
      [department, semester, date]
    );

    // 2. Insert new adjustments
    if (adjustments && adjustments.length > 0) {
      for (const adj of adjustments) {
        const { period, original_subject_id, adjusted_subject_id, adjustment_type, remarks } = adj;
        const query = `
          INSERT INTO schedule_adjustments 
            (department, semester, date, period, original_subject_id, adjusted_subject_id, adjustment_type, remarks)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `;
        await client.query(query, [
          department,
          semester,
          date,
          period,
          original_subject_id || null,
          adjusted_subject_id || null,
          adjustment_type,
          remarks || null
        ]);
      }
    }

    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error in saveCohortAdjustments:', error);
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  getByCohort,
  saveCohortAdjustments
};
