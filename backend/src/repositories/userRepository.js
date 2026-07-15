const db = require('../config/db');
const subjectRepository = require('./subjectRepository');
const timetableRepository = require('./timetableRepository');

/**
 * Retrieve user record by email
 * @param {string} email 
 * @returns {Promise<object|null>}
 */
const findByEmail = async (email) => {
  const query = 'SELECT * FROM users WHERE email = $1';
  const result = await db.query(query, [email.toLowerCase().trim()]);
  return result.rows[0] || null;
};

/**
 * Retrieve user record by ID
 * @param {string} id 
 * @returns {Promise<object|null>}
 */
const findById = async (id) => {
  const query = 'SELECT id, name, register_number, email, role, avatar, department, semester, is_suspended, created_at, updated_at FROM users WHERE id = $1';
  const result = await db.query(query, [id]);
  return result.rows[0] || null;
};

/**
 * Create a new user in the database and copy template subjects/timetable if they are a student
 * @param {object} user - { name, register_number, email, password_hash, role, department, semester }
 * @returns {Promise<object>}
 */
const createUser = async (user) => {
  const { name, register_number, email, password_hash, role, department, semester } = user;
  
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    
    // 1. Insert User
    const insertUserQuery = `
      INSERT INTO users (name, register_number, email, password_hash, role, department, semester)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, name, register_number, email, role, department, semester, created_at
    `;
    const userResult = await client.query(insertUserQuery, [
      name.trim(),
      register_number.trim().toUpperCase(),
      email.toLowerCase().trim(),
      password_hash,
      role || 'student',
      department || null,
      semester || null
    ]);
    
    const createdUser = userResult.rows[0];

    // 2. Setup Student Account Defaults (only for student role)
    if (createdUser.role === 'student') {
      // Create settings record
      const insertSettingsQuery = `
        INSERT INTO settings (user_id, minimum_attendance, theme, notifications)
        VALUES ($1, 75, 'light', TRUE)
      `;
      await client.query(insertSettingsQuery, [createdUser.id]);

      // Copy Master Subjects and get the Subject Mapping
      if (department && semester) {
        const subjectMap = await subjectRepository.copyMasterSubjects(
          client,
          createdUser.id,
          department,
          semester
        );

        // Copy Master Timetable using the Subject Mapping
        await timetableRepository.copyMasterTimetable(
          client,
          createdUser.id,
          department,
          semester,
          subjectMap
        );
      }
    }
    
    await client.query('COMMIT');
    return createdUser;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  findByEmail,
  findById,
  createUser
};
