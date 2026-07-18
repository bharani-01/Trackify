const holidayRepository = require('../repositories/holidayRepository');
const auditLogRepository = require('../repositories/auditLogRepository');

// Get all holidays (Admin)
const getAdminHolidays = async (req, res) => {
  try {
    const holidays = await holidayRepository.getAll();
    return res.status(200).json({
      success: true,
      holidays
    });
  } catch (error) {
    console.error('getAdminHolidays error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve holidays list'
    });
  }
};

// Create a holiday (Admin)
const createAdminHoliday = async (req, res) => {
  try {
    const { name, date, department, semester } = req.body;
    if (!name || !date) {
      return res.status(400).json({
        success: false,
        message: 'Name and date are required'
      });
    }

    const holiday = await holidayRepository.create({ name, date, department, semester });

    // Log action
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await auditLogRepository.logAction(
      req.user.id,
      'CREATE_HOLIDAY',
      `Created holiday "${name}" for date ${date}`,
      ip
    );

    return res.status(201).json({
      success: true,
      message: 'Holiday created successfully',
      holiday
    });
  } catch (error) {
    console.error('createAdminHoliday error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create holiday (date/target combination might already exist)'
    });
  }
};

// Delete a holiday (Admin)
const deleteAdminHoliday = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await holidayRepository.deleteById(id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Holiday not found'
      });
    }

    // Log action
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await auditLogRepository.logAction(
      req.user.id,
      'DELETE_HOLIDAY',
      `Deleted holiday "${deleted.name}" for date ${deleted.date}`,
      ip
    );

    return res.status(200).json({
      success: true,
      message: 'Holiday deleted successfully',
      holiday: deleted
    });
  } catch (error) {
    console.error('deleteAdminHoliday error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete holiday'
    });
  }
};

// Get holidays for logged-in student (Student)
const getStudentHolidays = async (req, res) => {
  try {
    const dept = req.user.department;
    const sem = req.user.semester;
    const holidays = await holidayRepository.getByTarget(dept, sem);

    return res.status(200).json({
      success: true,
      holidays
    });
  } catch (error) {
    console.error('getStudentHolidays error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve holidays list'
    });
  }
};

module.exports = {
  getAdminHolidays,
  createAdminHoliday,
  deleteAdminHoliday,
  getStudentHolidays
};
