const db = require('../config/db');

const normalizeAvatar = (avatar) => {
  if (!avatar) return null;
  if (avatar.includes('api.dicebear.com')) {
    try {
      const url = new URL(avatar);
      const seed = url.searchParams.get('seed');
      if (seed) {
        return `/assets/images/avatars/${seed}.svg`;
      }
    } catch (e) {
      // Return standard fallback
    }
    return `/assets/images/avatars/Trackify.svg`;
  }
  return avatar;
};

/**
 * Retrieve user record by email
 * @param {string} email 
 * @returns {Promise<object|null>}
 */
const findByEmail = async (email) => {
  const query = `
    SELECT u.*, d.code AS department_code, d.name AS department_name,
           uo.code AS otp_code, uo.expires_at AS otp_expires,
           pr.token AS reset_password_token, pr.expires_at AS reset_password_expires
    FROM users u
    LEFT JOIN departments d ON u.department_id = d.id
    LEFT JOIN user_otps uo ON u.id = uo.user_id
    LEFT JOIN password_resets pr ON u.id = pr.user_id
    WHERE u.email = $1
  `;
  const result = await db.query(query, [email.toLowerCase().trim()]);
  const user = result.rows[0] || null;
  if (user && user.avatar) {
    user.avatar = normalizeAvatar(user.avatar);
  }
  return user;
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
           u.is_suspended, u.is_approved, u.created_at, u.updated_at,
           uo.code AS otp_code, uo.expires_at AS otp_expires,
           pr.token AS reset_password_token, pr.expires_at AS reset_password_expires
    FROM users u
    LEFT JOIN departments d ON u.department_id = d.id
    LEFT JOIN user_otps uo ON u.id = uo.user_id
    LEFT JOIN password_resets pr ON u.id = pr.user_id
    WHERE u.id = $1
  `;
  const result = await db.query(query, [id]);
  const user = result.rows[0] || null;
  if (user && user.avatar) {
    user.avatar = normalizeAvatar(user.avatar);
  }
  return user;
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
    INSERT INTO password_resets (user_id, token, expires_at)
    VALUES ($1, $2, $3)
    ON CONFLICT (user_id) 
    DO UPDATE SET token = EXCLUDED.token, expires_at = EXCLUDED.expires_at, created_at = CURRENT_TIMESTAMP
    RETURNING user_id AS id
  `;
  const result = await db.query(query, [userId, token, expires]);
  return result.rows[0];
};

/**
 * Find user by reset token that hasn't expired yet
 */
const findByResetToken = async (token) => {
  const query = `
    SELECT u.id, u.email, pr.expires_at AS reset_password_expires 
    FROM users u
    JOIN password_resets pr ON u.id = pr.user_id
    WHERE pr.token = $1 AND pr.expires_at > NOW()
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
    SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING id, email, role
  `;
  const result = await db.query(query, [passwordHash, userId]);
  
  await db.query('DELETE FROM password_resets WHERE user_id = $1', [userId]);

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
const updateProfile = async (userId, name, email, avatar = null) => {
  const query = `
    UPDATE users 
    SET name = $1, email = $2, avatar = COALESCE($4, avatar), updated_at = CURRENT_TIMESTAMP
    WHERE id = $3
    RETURNING id, name, email, avatar
  `;
  const result = await db.query(query, [name.trim(), email.toLowerCase().trim(), userId, avatar]);
  const user = result.rows[0];
  if (user && user.avatar) {
    user.avatar = normalizeAvatar(user.avatar);
  }
  return user;
};

const updateOtp = async (userId, otp, expires) => {
  const query = `
    INSERT INTO user_otps (user_id, code, expires_at)
    VALUES ($1, $2, $3)
    ON CONFLICT (user_id)
    DO UPDATE SET code = EXCLUDED.code, expires_at = EXCLUDED.expires_at, created_at = CURRENT_TIMESTAMP
    RETURNING user_id AS id
  `;
  const result = await db.query(query, [userId, otp, expires]);
  return result.rows[0];
};

/**
 * Clear user record's OTP columns
 */
const clearOtp = async (userId) => {
  const query = `
    DELETE FROM user_otps 
    WHERE user_id = $1
    RETURNING user_id AS id
  `;
  const result = await db.query(query, [userId]);
  return result.rows[0];
};

/**
 * Retrieve students by department_id/department and semester
 */
const findStudentsByContext = async ({ department_id, department, semester }) => {
  let query = `
    SELECT u.id, u.name, u.email 
    FROM users u
    WHERE u.role = 'student' AND u.is_approved = TRUE AND u.is_suspended = FALSE
  `;
  const params = [];
  let paramIdx = 1;

  if (department_id) {
    query += ` AND u.department_id = $${paramIdx++}`;
    params.push(department_id);
  } else if (department) {
    query += ` AND (u.department = $${paramIdx++} OR u.department_id::text = $${paramIdx - 1})`;
    params.push(department);
  }

  if (semester) {
    query += ` AND u.semester = $${paramIdx++}`;
    params.push(parseInt(semester, 10));
  }

  const result = await db.query(query, params);
  return result.rows;
};

/**
 * Update user last_login timestamp
 */
const updateLastLogin = async (userId) => {
  const query = `
    UPDATE users 
    SET last_login = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING id
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
  clearOtp,
  findStudentsByContext,
  updateLastLogin
};
