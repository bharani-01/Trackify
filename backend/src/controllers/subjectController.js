const subjectRepository = require('../repositories/subjectRepository');

/**
 * Get all subjects for the logged-in student
 */
const getSubjects = async (req, res) => {
  try {
    const subjects = await subjectRepository.getAllByUserId(req.user.id);
    return res.status(200).json({
      success: true,
      subjects
    });
  } catch (error) {
    console.error('getSubjects controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve subjects'
    });
  }
};

/**
 * Add a new subject
 */
const createSubject = async (req, res) => {
  const { subject_code, subject_name, credits, color } = req.body;

  if (!subject_code || !subject_name) {
    return res.status(400).json({
      success: false,
      message: 'Please provide subject code and subject name'
    });
  }

  try {
    const newSubject = await subjectRepository.create({
      user_id: req.user.id,
      subject_code,
      subject_name,
      credits,
      color
    });

    return res.status(201).json({
      success: true,
      subject: newSubject
    });
  } catch (error) {
    console.error('createSubject controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create subject'
    });
  }
};

/**
 * Update subject details
 */
const updateSubject = async (req, res) => {
  const { id } = req.params;
  const { subject_code, subject_name, credits, color } = req.body;

  if (!subject_code || !subject_name) {
    return res.status(400).json({
      success: false,
      message: 'Please provide subject code and subject name'
    });
  }

  try {
    const updatedSubject = await subjectRepository.update(id, req.user.id, {
      subject_code,
      subject_name,
      credits,
      color
    });

    if (!updatedSubject) {
      return res.status(404).json({
        success: false,
        message: 'Subject not found or unauthorized'
      });
    }

    return res.status(200).json({
      success: true,
      subject: updatedSubject
    });
  } catch (error) {
    console.error('updateSubject controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update subject'
    });
  }
};

/**
 * Delete a subject
 */
const deleteSubject = async (req, res) => {
  const { id } = req.params;

  try {
    const isDeleted = await subjectRepository.delete(id, req.user.id);

    if (!isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Subject not found or unauthorized'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Subject deleted successfully'
    });
  } catch (error) {
    console.error('deleteSubject controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete subject'
    });
  }
};

module.exports = {
  getSubjects,
  createSubject,
  updateSubject,
  deleteSubject
};
