const db = require('../config/db');

/**
 * Retrieve timetable slots for a specific student with subject details
 * @param {string} userId 
 * @returns {Promise<Array>}
 */
const getByUserId = async (userId) => {
  const query = `
    SELECT 
      t.id,
      COALESCE(s_personal.id, s_direct.id) AS subject_id,
      t.day,
      t.period,
      t.start_time,
      t.end_time,
      t.room,
      COALESCE(s_personal.subject_name, s_direct.subject_name) AS subject_name,
      COALESCE(s_personal.subject_code, s_direct.subject_code) AS subject_code,
      COALESCE(s_personal.color, s_direct.color) AS color,
      COALESCE(s_personal.credits, s_direct.credits) AS credits
    FROM timetable t
    LEFT JOIN subjects s_master ON t.subject_id = s_master.id AND t.user_id IS NULL
    LEFT JOIN users u ON u.id = $1
    LEFT JOIN subjects s_personal ON s_personal.user_id = u.id AND s_personal.subject_code = s_master.subject_code AND t.user_id IS NULL
    LEFT JOIN subjects s_direct ON t.subject_id = s_direct.id AND t.user_id = u.id
    WHERE (t.user_id = $1)
       OR (t.user_id IS NULL 
           AND t.department = u.department 
           AND t.semester = u.semester
           AND NOT EXISTS (
             SELECT 1 FROM timetable t2 
             WHERE t2.user_id = $1 AND t2.day = t.day AND t2.period = t.period
           )
       )
    ORDER BY 
      CASE t.day
        WHEN 'Monday' THEN 1
        WHEN 'Tuesday' THEN 2
        WHEN 'Wednesday' THEN 3
        WHEN 'Thursday' THEN 4
        WHEN 'Friday' THEN 5
        WHEN 'Saturday' THEN 6
        WHEN 'Sunday' THEN 7
      END,
      t.period ASC
  `;
  const result = await db.query(query, [userId]);
  return result.rows;
};

/**
 * Add a slot in student's timetable
 * @param {object} slot - { user_id, subject_id, day, period, start_time, end_time, room }
 * @returns {Promise<object>}
 */
const create = async (slot) => {
  const { user_id, subject_id, day, period, start_time, end_time, room } = slot;
  const query = `
    INSERT INTO timetable (user_id, subject_id, day, period, start_time, end_time, room)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `;
  const result = await db.query(query, [
    user_id,
    subject_id,
    day,
    parseInt(period, 10),
    start_time,
    end_time,
    room ? room.trim() : null
  ]);
  return result.rows[0];
};

/**
 * Update timetable slot details
 * @param {string} id 
 * @param {string} userId 
 * @param {object} slot - { subject_id, day, period, start_time, end_time, room }
 * @returns {Promise<object|null>}
 */
const update = async (id, userId, slot) => {
  const { subject_id, day, period, start_time, end_time, room } = slot;
  const query = `
    UPDATE timetable
    SET subject_id = $1, day = $2, period = $3, start_time = $4, end_time = $5, room = $6
    WHERE id = $7 AND user_id = $8
    RETURNING *
  `;
  const result = await db.query(query, [
    subject_id,
    day,
    parseInt(period, 10),
    start_time,
    end_time,
    room ? room.trim() : null,
    id,
    userId
  ]);
  return result.rows[0] || null;
};

/**
 * Delete a timetable slot
 * @param {string} id 
 * @param {string} userId 
 * @returns {Promise<boolean>}
 */
const deleteSlot = async (id, userId) => {
  const query = 'DELETE FROM timetable WHERE id = $1 AND user_id = $2 RETURNING id';
  const result = await db.query(query, [id, userId]);
  return result.rowCount > 0;
};

/**
 * Transaction helper: Copies master timetable schedule for CSE/Department/Sem to student,
 * mapping old master subject IDs to newly cloned student subject IDs.
 * @param {object} client - pg client transaction instance
 * @param {string} userId 
 * @param {string} department 
 * @param {number} semester 
 * @param {object} subjectMap - old subject ID -> new subject ID
 */
const copyMasterTimetable = async (client, userId, department, semester, subjectMap) => {
  const getMasterQuery = `
    SELECT id, subject_id, day, period, start_time, end_time, room 
    FROM timetable 
    WHERE user_id IS NULL AND department = $1 AND semester = $2
  `;
  const masterResult = await client.query(getMasterQuery, [department, semester]);

  for (const masterSlot of masterResult.rows) {
    const studentSubjectId = subjectMap[masterSlot.subject_id];
    
    // Only copy if the associated subject was also successfully copied
    if (studentSubjectId) {
      const insertQuery = `
        INSERT INTO timetable (user_id, subject_id, day, period, start_time, end_time, room)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `;
      await client.query(insertQuery, [
        userId,
        studentSubjectId,
        masterSlot.day,
        masterSlot.period,
        masterSlot.start_time,
        masterSlot.end_time,
        masterSlot.room
      ]);
    }
  }
};

module.exports = {
  getByUserId,
  create,
  update,
  delete: deleteSlot,
  copyMasterTimetable
};
