-- Seed Departments
INSERT INTO departments (code, name) VALUES
('CSE', 'Computer Science & Engineering'),
('ECE', 'Electronics & Communication Engineering'),
('EEE', 'Electrical & Electronics Engineering'),
('ME', 'Mechanical Engineering'),
('CE', 'Civil Engineering'),
('IT', 'Information Technology')
ON CONFLICT (code) DO NOTHING;

-- Seed Users
-- The hashes will be replaced dynamically during database initialization
INSERT INTO users (name, register_number, email, password_hash, role, department, semester)
VALUES 
('System Administrator', 'ADMIN001', 'admin@trackify.com', '__ADMIN_PASSWORD_HASH__', 'admin', 'Management', 1),
('Demo Student', 'STUD001', 'student@trackify.com', '__STUDENT_PASSWORD_HASH__', 'student', 'CSE', 1)
ON CONFLICT (email) DO NOTHING;

-- Seed Default Settings for Users
INSERT INTO settings (user_id, minimum_attendance, theme, notifications)
SELECT id, 80, 'light', TRUE FROM users WHERE email = 'student@trackify.com'
ON CONFLICT (user_id) DO NOTHING;

-- Seed Master Subjects (Admin created, user_id is NULL)
-- Department CSE, Semester 1
INSERT INTO subjects (user_id, subject_code, subject_name, credits, color, department, semester)
VALUES
(NULL, 'CS101', 'Computer Programming', 4, '#3b82f6', 'CSE', 1),
(NULL, 'MA101', 'Engineering Mathematics I', 4, '#ec4899', 'CSE', 1),
(NULL, 'PH101', 'Engineering Physics', 3, '#f59e0b', 'CSE', 1),
(NULL, 'ME101', 'Engineering Graphics', 3, '#10b981', 'CSE', 1),
(NULL, 'EN101', 'Professional English', 2, '#06b6d4', 'CSE', 1)
ON CONFLICT DO NOTHING;

-- Seed Master Timetable Templates (Admin created, user_id is NULL)
-- Monday
INSERT INTO timetable (user_id, subject_id, day, period, start_time, end_time, room, department, semester)
SELECT NULL, id, 'Monday', 1, '08:05:00', '08:55:00', 'Room B15', 'CSE', 1 FROM subjects WHERE subject_code = 'CS101' AND user_id IS NULL;

INSERT INTO timetable (user_id, subject_id, day, period, start_time, end_time, room, department, semester)
SELECT NULL, id, 'Monday', 2, '09:00:00', '09:50:00', 'Room B15', 'CSE', 1 FROM subjects WHERE subject_code = 'MA101' AND user_id IS NULL;

-- Tuesday
INSERT INTO timetable (user_id, subject_id, day, period, start_time, end_time, room, department, semester)
SELECT NULL, id, 'Tuesday', 1, '08:05:00', '08:55:00', 'Graphics Lab', 'CSE', 1 FROM subjects WHERE subject_code = 'ME101' AND user_id IS NULL;

INSERT INTO timetable (user_id, subject_id, day, period, start_time, end_time, room, department, semester)
SELECT NULL, id, 'Tuesday', 2, '09:00:00', '09:50:00', 'Room B12', 'CSE', 1 FROM subjects WHERE subject_code = 'EN101' AND user_id IS NULL;

-- Wednesday
INSERT INTO timetable (user_id, subject_id, day, period, start_time, end_time, room, department, semester)
SELECT NULL, id, 'Wednesday', 1, '08:05:00', '08:55:00', 'Room B15', 'CSE', 1 FROM subjects WHERE subject_code = 'MA101' AND user_id IS NULL;

INSERT INTO timetable (user_id, subject_id, day, period, start_time, end_time, room, department, semester)
SELECT NULL, id, 'Wednesday', 2, '09:00:00', '09:50:00', 'Room B15', 'CSE', 1 FROM subjects WHERE subject_code = 'PH101' AND user_id IS NULL;

-- Thursday
INSERT INTO timetable (user_id, subject_id, day, period, start_time, end_time, room, department, semester)
SELECT NULL, id, 'Thursday', 1, '08:05:00', '08:55:00', 'Room B15', 'CSE', 1 FROM subjects WHERE subject_code = 'CS101' AND user_id IS NULL;

INSERT INTO timetable (user_id, subject_id, day, period, start_time, end_time, room, department, semester)
SELECT NULL, id, 'Thursday', 2, '09:00:00', '09:50:00', 'Room B12', 'CSE', 1 FROM subjects WHERE subject_code = 'EN101' AND user_id IS NULL;

-- Friday
INSERT INTO timetable (user_id, subject_id, day, period, start_time, end_time, room, department, semester)
SELECT NULL, id, 'Friday', 1, '08:05:00', '08:55:00', 'Room B15', 'CSE', 1 FROM subjects WHERE subject_code = 'PH101' AND user_id IS NULL;

INSERT INTO timetable (user_id, subject_id, day, period, start_time, end_time, room, department, semester)
SELECT NULL, id, 'Friday', 2, '09:00:00', '09:50:00', 'Graphics Lab', 'CSE', 1 FROM subjects WHERE subject_code = 'ME101' AND user_id IS NULL;


-- Seed Personal Subjects for Demo Student (cloned from CSE 1 Master Templates)
INSERT INTO subjects (user_id, subject_code, subject_name, credits, color)
SELECT 
  (SELECT id FROM users WHERE email = 'student@trackify.com'),
  subject_code,
  subject_name,
  credits,
  color
FROM subjects
WHERE user_id IS NULL AND department = 'CSE' AND semester = 1
ON CONFLICT DO NOTHING;

-- Seed Personal Timetable slots for Demo Student
INSERT INTO timetable (user_id, subject_id, day, period, start_time, end_time, room)
SELECT 
  (SELECT id FROM users WHERE email = 'student@trackify.com'),
  (SELECT s_child.id FROM subjects s_child WHERE s_child.user_id = (SELECT id FROM users WHERE email = 'student@trackify.com') AND s_child.subject_code = s_master.subject_code),
  t.day,
  t.period,
  t.start_time,
  t.end_time,
  t.room
FROM timetable t
JOIN subjects s_master ON t.subject_id = s_master.id
WHERE t.user_id IS NULL AND t.department = 'CSE' AND t.semester = 1
ON CONFLICT DO NOTHING;
