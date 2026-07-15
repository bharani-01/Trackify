const adminRepository = require('../repositories/adminRepository');
const userRepository = require('../repositories/userRepository');
const { hashPassword } = require('../utils/authHelper');

/**
 * Get all registered student users
 */
const getUsers = async (req, res) => {
  try {
    const users = await adminRepository.getStudents();
    return res.status(200).json({
      success: true,
      users
    });
  } catch (error) {
    console.error('getUsers controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve registered users'
    });
  }
};

/**
 * Toggle user account suspension
 */
const toggleUserSuspension = async (req, res) => {
  const { id } = req.params;
  const { is_suspended } = req.body;

  if (is_suspended === undefined) {
    return res.status(400).json({
      success: false,
      message: 'Please provide is_suspended value'
    });
  }

  try {
    const success = await adminRepository.setSuspension(id, !!is_suspended);
    if (!success) {
      return res.status(404).json({
        success: false,
        message: 'User account not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: `User suspension status updated to ${is_suspended}`
    });
  } catch (error) {
    console.error('toggleUserSuspension controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update suspension status'
    });
  }
};

/**
 * Delete a user account completely
 */
const deleteUser = async (req, res) => {
  const { id } = req.params;

  try {
    const success = await adminRepository.deleteUser(id);
    if (!success) {
      return res.status(404).json({
        success: false,
        message: 'User account not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'User account deleted successfully'
    });
  } catch (error) {
    console.error('deleteUser controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete user account'
    });
  }
};

/**
 * Get system statistics for Admin Dashboard
 */
const getDashboardStats = async (req, res) => {
  try {
    const stats = await adminRepository.getStats();
    return res.status(200).json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('getDashboardStats controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve system statistics'
    });
  }
};

/**
 * Get master subjects templates
 */
const getMasterSubjects = async (req, res) => {
  const { department, semester } = req.query;

  if (!department || !semester) {
    return res.status(400).json({
      success: false,
      message: 'Please provide department and semester'
    });
  }

  try {
    const subjects = await adminRepository.getMasterSubjects(department, semester);
    return res.status(200).json({
      success: true,
      subjects
    });
  } catch (error) {
    console.error('getMasterSubjects controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve master subjects templates'
    });
  }
};

/**
 * Add a master subject template
 */
const createMasterSubject = async (req, res) => {
  const { subject_code, subject_name, credits, color, department, semester } = req.body;

  if (!subject_code || !subject_name || !department || !semester) {
    return res.status(400).json({
      success: false,
      message: 'Please provide subject code, name, department, and semester'
    });
  }

  try {
    const newSubject = await adminRepository.createMasterSubject({
      subject_code,
      subject_name,
      credits,
      color,
      department,
      semester
    });

    return res.status(201).json({
      success: true,
      subject: newSubject
    });
  } catch (error) {
    console.error('createMasterSubject controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create master subject template'
    });
  }
};

/**
 * Remove a master subject template
 */
const deleteMasterSubject = async (req, res) => {
  const { id } = req.params;

  try {
    const success = await adminRepository.deleteMasterSubject(id);
    if (!success) {
      return res.status(404).json({
        success: false,
        message: 'Master subject template not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Master subject template deleted successfully'
    });
  } catch (error) {
    console.error('deleteMasterSubject controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete master subject template'
    });
  }
};

/**
 * Get master timetable templates
 */
const getMasterTimetable = async (req, res) => {
  const { department, semester } = req.query;

  if (!department || !semester) {
    return res.status(400).json({
      success: false,
      message: 'Please provide department and semester'
    });
  }

  try {
    const timetable = await adminRepository.getMasterTimetable(department, semester);
    return res.status(200).json({
      success: true,
      timetable
    });
  } catch (error) {
    console.error('getMasterTimetable controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve master timetable templates'
    });
  }
};

/**
 * Create a master timetable slot template
 */
const createMasterTimetableSlot = async (req, res) => {
  const { subject_id, day, period, start_time, end_time, room, department, semester } = req.body;

  if (!subject_id || !day || !period || !start_time || !end_time || !department || !semester) {
    return res.status(400).json({
      success: false,
      message: 'Please provide all required fields'
    });
  }

  try {
    const newSlot = await adminRepository.createMasterTimetableSlot({
      subject_id,
      day,
      period,
      start_time,
      end_time,
      room,
      department,
      semester
    });

    return res.status(201).json({
      success: true,
      slot: newSlot
    });
  } catch (error) {
    console.error('createMasterTimetableSlot controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create master timetable slot template'
    });
  }
};

/**
 * Remove a master timetable slot template
 */
const deleteMasterTimetableSlot = async (req, res) => {
  const { id } = req.params;

  try {
    const success = await adminRepository.deleteMasterTimetableSlot(id);
    if (!success) {
      return res.status(404).json({
        success: false,
        message: 'Master timetable slot template not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Master timetable slot template deleted successfully'
    });
  } catch (error) {
    console.error('deleteMasterTimetableSlot controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete master timetable slot template'
    });
  }
};

/**
 * Update student profile (department and semester)
 */
const updateStudentProfile = async (req, res) => {
  const { id } = req.params;
  const { department, semester } = req.body;

  if (!department || !semester) {
    return res.status(400).json({
      success: false,
      message: 'Please provide both department and semester'
    });
  }

  try {
    const success = await adminRepository.updateStudentProfile(id, department, parseInt(semester, 10));
    if (!success) {
      return res.status(404).json({
        success: false,
        message: 'Student account not found'
      });
    }

    // Initialize subjects and timetable templates according to the new department/semester
    await adminRepository.initializeStudentSubjectsAndTimetable(id, department, parseInt(semester, 10));

    return res.status(200).json({
      success: true,
      message: 'Student department and semester updated and schedule initialized successfully'
    });
  } catch (error) {
    console.error('updateStudentProfile controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update student profile and initialize schedules'
    });
  }
};

/**
 * Create a new user (student or admin) dynamically from the admin panel
 */
const createUser = async (req, res) => {
  const { name, register_number, email, password, role, department, semester } = req.body;

  try {
    // 1. Validation
    if (!name || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email, password, and role'
      });
    }

    if (role === 'student' && !register_number) {
      return res.status(400).json({
        success: false,
        message: 'Registration number is required for students'
      });
    }

    // 2. Check if user already exists
    const userExists = await userRepository.findByEmail(email);
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: 'A user with this email already exists'
      });
    }

    // 3. Hash password
    const password_hash = await hashPassword(password);

    // 4. Create user record and clone templates if student
    const newUser = await userRepository.createUser({
      name,
      register_number: role === 'student' ? register_number : `ADMIN-${Date.now().toString().slice(-4)}`,
      email,
      password_hash,
      role,
      department: role === 'student' ? department : null,
      semester: role === 'student' && semester ? parseInt(semester, 10) : null
    });

    return res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role
      }
    });
  } catch (error) {
    console.error('Admin createUser controller error:', error);
    if (error.code === '23505') {
      return res.status(400).json({
        success: false,
        message: 'Registration number or email already in use'
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Server error during user creation'
    });
  }
};

module.exports = {
  getUsers,
  toggleUserSuspension,
  deleteUser,
  updateStudentProfile,
  getDashboardStats,
  getMasterSubjects,
  createMasterSubject,
  deleteMasterSubject,
  getMasterTimetable,
  createMasterTimetableSlot,
  deleteMasterTimetableSlot,
  createUser
};
