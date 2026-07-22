const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_development';
const JWT_EXPIRE = process.env.JWT_EXPIRE || '180d';

/**
 * Hash a plain text password using bcrypt
 * @param {string} password 
 * @returns {Promise<string>}
 */
const hashPassword = async (password) => {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
};

/**
 * Compare plain text password with hashed password
 * @param {string} password 
 * @param {string} hashedPassword 
 * @returns {Promise<boolean>}
 */
const comparePassword = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
};

/**
 * Generate a JWT token for the user payload
 * @param {object} payload - { id, role, email }
 * @returns {string}
 */
const generateToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRE
  });
};

/**
 * Verify JWT token and decode its payload with strict algorithm checking
 * @param {string} token 
 * @returns {object|null}
 */
const verifyToken = (token) => {
  try {
    if (!token || typeof token !== 'string') return null;
    // Explicitly enforce HS256 algorithm to prevent 'none' algorithm bypass and algorithm confusion
    return jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
  } catch (error) {
    return null;
  }
};

module.exports = {
  hashPassword,
  comparePassword,
  generateToken,
  verifyToken
};
