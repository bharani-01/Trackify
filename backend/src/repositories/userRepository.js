const db = require('../config/db');

/**
 * Retrieve user record by email
 * @param {string} email 
 * @returns {Promise<object|null>}
 */
const findByEmail = async (email) => {
  const query = `
    SELECT u.*, d.code AS department_code, d.name AS department_name 
    FROM users u
    LEFT JOIN departments d ON u.department_id = d.id
    WHERE u.email = $1
  `;
  const result = await db.query(query, [email.toLowerCase().trim()]);
  return result.rows[0] || null;
};

/**
 * Retrieve user record by ID
 * @param {string} id 
 * @returns {Promise<object|null>}
 */
const findById = async (id) => {
  const query = `
    SELECT u.id, u.name, u.register_number, u.email, u.role, u.avatar, 
           u.department, u.department_id, d.name AS department_name, u.semester, 
           u.is_suspended, u.is_approved, u.created_at, u.updated_at 
    FROM users u
    LEFT JOIN departments d ON u.department_id = d.id
    WHERE u.id = $1
  `;
  const result = await db.query(query, [id]);
  return result.rows[0] || null;
};

/**
 * Create a new user in the database
 * @param {object} user - { name, register_number, email, password_hash, role, department, semester, is_approved }
 * @returns {Promise<object>}
 */
const createUser = async (user) => {
  const { name, register_number, email, password_hash, role, department, semester, is_approved } = user;
  const approvedStatus = is_approved !== undefined ? is_approved : true;
  
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Resolve department_id from department code string if department provided
    let departmentId = null;
    let deptCode = department || null;
    if (deptCode) {
      const deptRes = await client.query(
        'SELECT id, code FROM departments WHERE UPPER(code) = UPPER($1)',
        [deptCode.trim()]
      );
      if (deptRes.rows.length > 0) {
        departmentId = deptRes.rows[0].id;
        deptCode = deptRes.rows[0].code;
      }
    }
    
    // 1. Insert User
    const insertUserQuery = `
      INSERT INTO users (name, register_number, email, password_hash, role, department, department_id, semester, is_approved)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, name, register_number, email, role, department, department_id, semester, is_approved, created_at
    `;
    const userResult = await client.query(insertUserQuery, [
      name.trim(),
      register_number ? register_number.trim().toUpperCase() : null,
      email.toLowerCase().trim(),
      password_hash,
      role || 'student',
      deptCode,
      departmentId,
      semester || null,
      approvedStatus
    ]);
    
    const createdUser = userResult.rows[0];

    // 2. Setup Student Account Defaults
    if (createdUser.role === 'student' && approvedStatus) {
      const insertSettingsQuery = `
        INSERT INTO settings (user_id, minimum_attendance, theme, notifications)
        VALUES ($1, 80, 'light', TRUE)
        ON CONFLICT (user_id) DO NOTHING
      `;
      await client.query(insertSettingsQuery, [createdUser.id]);
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

/**
 * Update reset password token and expiry date for a user
 */
const updateResetToken = async (userId, token, expires) => {
  const query = `
    UPDATE users 
    SET reset_password_token = $1, reset_password_expires = $2, updated_at = CURRENT_TIMESTAMP
    WHERE id = $3
    RETURNING id, email
  `;
  const result = await db.query(query, [token, expires, userId]);
  return result.rows[0];
};

/**
 * Find user by reset token that hasn't expired yet
 */
const findByResetToken = async (token) => {
  const query = `
    SELECT id, email, reset_password_expires 
    FROM users 
    WHERE reset_password_token = $1 AND reset_password_expires > NOW()
  `;
  const result = await db.query(query, [token]);
  return result.rows[0];
};

/**
 * Update user's password and wipe out reset tokens
 */
const updatePasswordAndClearToken = async (userId, passwordHash) => {
  const query = `
    UPDATE users 
    SET password_hash = $1, reset_password_token = NULL, reset_password_expires = NULL, updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING id, email, role
  `;
  const result = await db.query(query, [passwordHash, userId]);
  return result.rows[0];
};

/**
 * Retrieve all self-registered student request directory profiles pending approval
 */
const findPendingUsers = async () => {
  const query = `
    SELECT u.id, u.name, u.email, u.register_number, u.department, u.department_id, d.name AS department_name, u.semester, u.created_at 
    FROM users u
    LEFT JOIN departments d ON u.department_id = d.id
    WHERE u.is_approved = FALSE
    ORDER BY u.created_at DESC
  `;
  const result = await db.query(query);
  return result.rows;
};

/**
 * Approve a student account
 */
const approveUser = async (userId) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    
    // Update user to be approved
    const approveQuery = `
      UPDATE users 
      SET is_approved = TRUE, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id, name, register_number, email, role, department, department_id, semester
    `;
    const userResult = await client.query(approveQuery, [userId]);
    const user = userResult.rows[0];
    
    if (!user) {
      throw new Error('User account not found');
    }

    if (user.role === 'student') {
      const insertSettingsQuery = `
        INSERT INTO settings (user_id, minimum_attendance, theme, notifications)
        VALUES ($1, 80, 'light', TRUE)
        ON CONFLICT (user_id) DO NOTHING
      `;
      await client.query(insertSettingsQuery, [user.id]);
    }

    await client.query('COMMIT');
    return user;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Reject a student account registration request
 */
const rejectUser = async (userId) => {
  const query = 'DELETE FROM users WHERE id = $1 AND is_approved = FALSE RETURNING id';
  const result = await db.query(query, [userId]);
  return result.rows[0];
};

/**
 * Update user's name and email profile info
 */
const updateProfile = async (userId, name, email) => {
  const query = `
    UPDATE users 
    SET name = $1, email = $2, updated_at = CURRENT_TIMESTAMP
    WHERE id = $3
    RETURNING id, name, email, register_number, role, department, department_id, semester
  `;
  const result = await db.query(query, [name.trim(), email.toLowerCase().trim(), userId]);
  return result.rows[0];
};

/**
 * Update user record with generated OTP and expiry
 */
const updateOtp = async (userId, otp, expires) => {
  const query = `
    UPDATE users 
    SET otp_code = $1, otp_expires = $2, updated_at = CURRENT_TIMESTAMP
    WHERE id = $3
    RETURNING id, email
  `;
  const result = await db.query(query, [otp, expires, userId]);
  return result.rows[0];
};

/**
 * Clear user record's OTP columns
 */
const clearOtp = async (userId) => {
  const query = `
    UPDATE users 
    SET otp_code = NULL, otp_expires = NULL, updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING id, email
  `;
  const result = await db.query(query, [userId]);
  return result.rows[0];
};

module.exports = {
  findByEmail,
  findById,
  createUser,
  updateResetToken,
  findByResetToken,
  updatePasswordAndClearToken,
  findPendingUsers,
  approveUser,
  rejectUser,
  updateProfile,
  updateOtp,
  clearOtp
};
