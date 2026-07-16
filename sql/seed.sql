-- Seed ONLY the System Administrator account for a fresh setup
-- The password hash will be replaced dynamically during database initialization
INSERT INTO users (name, register_number, email, password_hash, role, department, semester)
VALUES 
('System Administrator', 'ADMIN001', 'admin@trackify.com', '__ADMIN_PASSWORD_HASH__', 'admin', 'Management', 1)
ON CONFLICT (email) DO NOTHING;

-- Seed Departments (E02 - B.Tech - (Cyber & IoT))
INSERT INTO departments (code, name) VALUES
('E02', 'B.Tech - (Cyber & IoT)')
ON CONFLICT (code) DO NOTHING;

-- Seed Master Subjects (Admin created, user_id is NULL)
-- Department E02, Semester 5 (Y3 Sem V B.Tech CSE - Cyb & IoT)
INSERT INTO subjects (user_id, subject_code, subject_name, credits, color, department, semester)
VALUES
(NULL, 'CSE23AE302', 'Professional Coding Practice IV', 2, '#3b82f6', 'E02', 5),
(NULL, 'CSE23CL301', 'Computer Networks Laboratory', 2, '#10b981', 'E02', 5),
(NULL, 'CSE23AE301', 'Professional Competency Development - V', 2, '#f59e0b', 'E02', 5),
(NULL, 'CYB23CT302', 'Machine Learning Cloud Services', 3, '#ec4899', 'E02', 5),
(NULL, 'CYB23DLU02', 'Information Security Laboratory', 2, '#8b5cf6', 'E02', 5),
(NULL, 'CYB23CL302', 'Machine Learning Cloud Services Laboratory', 2, '#06b6d4', 'E02', 5),
(NULL, 'CYB23DEU02', 'Information Security', 3, '#14b8a6', 'E02', 5),
(NULL, 'CYB23CT301', 'Cryptography and Network Security', 4, '#ef4444', 'E02', 5),
(NULL, 'CSE23CT302', 'Theory of Computation and Compiler Design', 4, '#6366f1', 'E02', 5),
(NULL, 'CSE23CT301', 'Computer Networks', 3, '#f97316', 'E02', 5),
(NULL, 'CLUB_ACT', 'Club Activity', 1, '#84cc16', 'E02', 5),
(NULL, 'MENTOR_MEET', 'Mentor-Mentee Meeting', 1, '#6b7280', 'E02', 5),
(NULL, 'CYB23SLU07', 'LINUX Commands and UBUNTU OS', 2, '#a855f7', 'E02', 5),
(NULL, 'CYB23CL301', 'Cryptography and Network Security Laboratory', 2, '#059669', 'E02', 5)
ON CONFLICT DO NOTHING;

-- Seed Master Timetable slots for E02 Semester 5
-- Monday
INSERT INTO timetable (user_id, subject_id, day, period, start_time, end_time, room, department, semester)
SELECT NULL, id, 'Monday', 1, '08:00:00', '08:55:00', 'CR 5', 'E02', 5 FROM subjects WHERE subject_code = 'CSE23AE302' AND user_id IS NULL;
INSERT INTO timetable (user_id, subject_id, day, period, start_time, end_time, room, department, semester)
SELECT NULL, id, 'Monday', 2, '08:55:00', '09:50:00', 'CR 5', 'E02', 5 FROM subjects WHERE subject_code = 'CSE23AE302' AND user_id IS NULL;
INSERT INTO timetable (user_id, subject_id, day, period, start_time, end_time, room, department, semester)
SELECT NULL, id, 'Monday', 3, '10:10:00', '11:05:00', 'CR 5', 'E02', 5 FROM subjects WHERE subject_code = 'CSE23CL301' AND user_id IS NULL;
INSERT INTO timetable (user_id, subject_id, day, period, start_time, end_time, room, department, semester)
SELECT NULL, id, 'Monday', 4, '11:05:00', '12:00:00', 'CR 5', 'E02', 5 FROM subjects WHERE subject_code = 'CSE23CL301' AND user_id IS NULL;
INSERT INTO timetable (user_id, subject_id, day, period, start_time, end_time, room, department, semester)
SELECT NULL, id, 'Monday', 5, '13:00:00', '13:50:00', 'CR 5', 'E02', 5 FROM subjects WHERE subject_code = 'CSE23AE301' AND user_id IS NULL;
INSERT INTO timetable (user_id, subject_id, day, period, start_time, end_time, room, department, semester)
SELECT NULL, id, 'Monday', 6, '13:50:00', '14:40:00', 'CR 5', 'E02', 5 FROM subjects WHERE subject_code = 'CSE23AE301' AND user_id IS NULL;
INSERT INTO timetable (user_id, subject_id, day, period, start_time, end_time, room, department, semester)
SELECT NULL, id, 'Monday', 7, '14:55:00', '15:45:00', 'CR 5', 'E02', 5 FROM subjects WHERE subject_code = 'CYB23CT302' AND user_id IS NULL;

-- Tuesday
INSERT INTO timetable (user_id, subject_id, day, period, start_time, end_time, room, department, semester)
SELECT NULL, id, 'Tuesday', 1, '08:00:00', '08:55:00', 'IoT Lab', 'E02', 5 FROM subjects WHERE subject_code = 'CYB23DLU02' AND user_id IS NULL;
INSERT INTO timetable (user_id, subject_id, day, period, start_time, end_time, room, department, semester)
SELECT NULL, id, 'Tuesday', 2, '08:55:00', '09:50:00', 'IoT Lab', 'E02', 5 FROM subjects WHERE subject_code = 'CYB23DLU02' AND user_id IS NULL;
INSERT INTO timetable (user_id, subject_id, day, period, start_time, end_time, room, department, semester)
SELECT NULL, id, 'Tuesday', 3, '10:10:00', '11:05:00', 'IoT LAB', 'E02', 5 FROM subjects WHERE subject_code = 'CYB23CL302' AND user_id IS NULL;
INSERT INTO timetable (user_id, subject_id, day, period, start_time, end_time, room, department, semester)
SELECT NULL, id, 'Tuesday', 4, '11:05:00', '12:00:00', 'IoT LAB', 'E02', 5 FROM subjects WHERE subject_code = 'CYB23CL302' AND user_id IS NULL;
INSERT INTO timetable (user_id, subject_id, day, period, start_time, end_time, room, department, semester)
SELECT NULL, id, 'Tuesday', 5, '13:00:00', '13:50:00', 'CR 5', 'E02', 5 FROM subjects WHERE subject_code = 'CYB23DEU02' AND user_id IS NULL;
INSERT INTO timetable (user_id, subject_id, day, period, start_time, end_time, room, department, semester)
SELECT NULL, id, 'Tuesday', 6, '13:50:00', '14:40:00', 'CR 5', 'E02', 5 FROM subjects WHERE subject_code = 'CYB23CT301' AND user_id IS NULL;
INSERT INTO timetable (user_id, subject_id, day, period, start_time, end_time, room, department, semester)
SELECT NULL, id, 'Tuesday', 7, '14:55:00', '15:45:00', 'CR 5', 'E02', 5 FROM subjects WHERE subject_code = 'CYB23DEU02' AND user_id IS NULL;

-- Wednesday
INSERT INTO timetable (user_id, subject_id, day, period, start_time, end_time, room, department, semester)
SELECT NULL, id, 'Wednesday', 1, '08:00:00', '08:55:00', 'CR 5', 'E02', 5 FROM subjects WHERE subject_code = 'CYB23CT301' AND user_id IS NULL;
INSERT INTO timetable (user_id, subject_id, day, period, start_time, end_time, room, department, semester)
SELECT NULL, id, 'Wednesday', 2, '08:55:00', '09:50:00', 'CR 5', 'E02', 5 FROM subjects WHERE subject_code = 'CSE23CT302' AND user_id IS NULL;
INSERT INTO timetable (user_id, subject_id, day, period, start_time, end_time, room, department, semester)
SELECT NULL, id, 'Wednesday', 3, '10:10:00', '11:05:00', 'CR 5', 'E02', 5 FROM subjects WHERE subject_code = 'CSE23CT301' AND user_id IS NULL;
INSERT INTO timetable (user_id, subject_id, day, period, start_time, end_time, room, department, semester)
SELECT NULL, id, 'Wednesday', 4, '11:05:00', '12:00:00', 'CR 5', 'E02', 5 FROM subjects WHERE subject_code = 'CLUB_ACT' AND user_id IS NULL;
INSERT INTO timetable (user_id, subject_id, day, period, start_time, end_time, room, department, semester)
SELECT NULL, id, 'Wednesday', 5, '13:00:00', '13:50:00', 'CR 5', 'E02', 5 FROM subjects WHERE subject_code = 'CSE23AE301' AND user_id IS NULL;
INSERT INTO timetable (user_id, subject_id, day, period, start_time, end_time, room, department, semester)
SELECT NULL, id, 'Wednesday', 6, '13:50:00', '14:40:00', 'CR 5', 'E02', 5 FROM subjects WHERE subject_code = 'CYB23SLU07' AND user_id IS NULL;
INSERT INTO timetable (user_id, subject_id, day, period, start_time, end_time, room, department, semester)
SELECT NULL, id, 'Wednesday', 7, '14:55:00', '15:45:00', 'CR 5', 'E02', 5 FROM subjects WHERE subject_code = 'CYB23SLU07' AND user_id IS NULL;

-- Thursday
INSERT INTO timetable (user_id, subject_id, day, period, start_time, end_time, room, department, semester)
SELECT NULL, id, 'Thursday', 1, '08:00:00', '08:55:00', 'CR 5', 'E02', 5 FROM subjects WHERE subject_code = 'CSE23CT301' AND user_id IS NULL;
INSERT INTO timetable (user_id, subject_id, day, period, start_time, end_time, room, department, semester)
SELECT NULL, id, 'Thursday', 2, '08:55:00', '09:50:00', 'CR 5', 'E02', 5 FROM subjects WHERE subject_code = 'MENTOR_MEET' AND user_id IS NULL;
INSERT INTO timetable (user_id, subject_id, day, period, start_time, end_time, room, department, semester)
SELECT NULL, id, 'Thursday', 3, '10:10:00', '11:05:00', 'CR 5', 'E02', 5 FROM subjects WHERE subject_code = 'CSE23CT302' AND user_id IS NULL;
INSERT INTO timetable (user_id, subject_id, day, period, start_time, end_time, room, department, semester)
SELECT NULL, id, 'Thursday', 4, '11:05:00', '12:00:00', 'CR 5', 'E02', 5 FROM subjects WHERE subject_code = 'CYB23CT302' AND user_id IS NULL;
INSERT INTO timetable (user_id, subject_id, day, period, start_time, end_time, room, department, semester)
SELECT NULL, id, 'Thursday', 5, '13:00:00', '13:50:00', 'CR 5', 'E02', 5 FROM subjects WHERE subject_code = 'CSE23AE302' AND user_id IS NULL;
INSERT INTO timetable (user_id, subject_id, day, period, start_time, end_time, room, department, semester)
SELECT NULL, id, 'Thursday', 6, '13:50:00', '14:40:00', 'CR 5', 'E02', 5 FROM subjects WHERE subject_code = 'CSE23AE302' AND user_id IS NULL;
INSERT INTO timetable (user_id, subject_id, day, period, start_time, end_time, room, department, semester)
SELECT NULL, id, 'Thursday', 7, '14:55:00', '15:45:00', 'CR 5', 'E02', 5 FROM subjects WHERE subject_code = 'CYB23CT302' AND user_id IS NULL;

-- Friday
INSERT INTO timetable (user_id, subject_id, day, period, start_time, end_time, room, department, semester)
SELECT NULL, id, 'Friday', 1, '08:00:00', '08:55:00', 'CR 5', 'E02', 5 FROM subjects WHERE subject_code = 'CSE23CT302' AND user_id IS NULL;
INSERT INTO timetable (user_id, subject_id, day, period, start_time, end_time, room, department, semester)
SELECT NULL, id, 'Friday', 2, '08:55:00', '09:50:00', 'CR 5', 'E02', 5 FROM subjects WHERE subject_code = 'CSE23CT302' AND user_id IS NULL;
INSERT INTO timetable (user_id, subject_id, day, period, start_time, end_time, room, department, semester)
SELECT NULL, id, 'Friday', 3, '10:10:00', '11:05:00', 'CR 5', 'E02', 5 FROM subjects WHERE subject_code = 'CYB23DEU02' AND user_id IS NULL;
INSERT INTO timetable (user_id, subject_id, day, period, start_time, end_time, room, department, semester)
SELECT NULL, id, 'Friday', 4, '11:05:00', '12:00:00', 'CR 5', 'E02', 5 FROM subjects WHERE subject_code = 'CYB23CT301' AND user_id IS NULL;
INSERT INTO timetable (user_id, subject_id, day, period, start_time, end_time, room, department, semester)
SELECT NULL, id, 'Friday', 5, '13:00:00', '13:50:00', 'IoT Lab', 'E02', 5 FROM subjects WHERE subject_code = 'CYB23CL301' AND user_id IS NULL;
INSERT INTO timetable (user_id, subject_id, day, period, start_time, end_time, room, department, semester)
SELECT NULL, id, 'Friday', 6, '13:50:00', '14:40:00', 'IoT Lab', 'E02', 5 FROM subjects WHERE subject_code = 'CYB23CL301' AND user_id IS NULL;
INSERT INTO timetable (user_id, subject_id, day, period, start_time, end_time, room, department, semester)
SELECT NULL, id, 'Friday', 7, '14:55:00', '15:45:00', 'CR 5', 'E02', 5 FROM subjects WHERE subject_code = 'CSE23CT301' AND user_id IS NULL;

-- Saturday
INSERT INTO timetable (user_id, subject_id, day, period, start_time, end_time, room, department, semester)
SELECT NULL, id, 'Saturday', 1, '08:00:00', '08:55:00', 'CR 5', 'E02', 5 FROM subjects WHERE subject_code = 'CSE23CT302' AND user_id IS NULL;
INSERT INTO timetable (user_id, subject_id, day, period, start_time, end_time, room, department, semester)
SELECT NULL, id, 'Saturday', 2, '08:55:00', '09:50:00', 'CR 5', 'E02', 5 FROM subjects WHERE subject_code = 'MENTOR_MEET' AND user_id IS NULL;
INSERT INTO timetable (user_id, subject_id, day, period, start_time, end_time, room, department, semester)
SELECT NULL, id, 'Saturday', 3, '10:10:00', '11:05:00', 'CR 5', 'E02', 5 FROM subjects WHERE subject_code = 'CYB23CT301' AND user_id IS NULL;
INSERT INTO timetable (user_id, subject_id, day, period, start_time, end_time, room, department, semester)
SELECT NULL, id, 'Saturday', 4, '11:05:00', '12:00:00', 'CR 5', 'E02', 5 FROM subjects WHERE subject_code = 'CYB23CT302' AND user_id IS NULL;
INSERT INTO timetable (user_id, subject_id, day, period, start_time, end_time, room, department, semester)
SELECT NULL, id, 'Saturday', 5, '13:00:00', '13:50:00', 'CR 5', 'E02', 5 FROM subjects WHERE subject_code = 'CYB23DEU02' AND user_id IS NULL;
INSERT INTO timetable (user_id, subject_id, day, period, start_time, end_time, room, department, semester)
SELECT NULL, id, 'Saturday', 6, '13:50:00', '14:40:00', 'CR 5', 'E02', 5 FROM subjects WHERE subject_code = 'CYB23SLU07' AND user_id IS NULL;
INSERT INTO timetable (user_id, subject_id, day, period, start_time, end_time, room, department, semester)
SELECT NULL, id, 'Saturday', 7, '14:55:00', '15:45:00', 'CR 5', 'E02', 5 FROM subjects WHERE subject_code = 'CSE23CT301' AND user_id IS NULL;

-- Seed default system settings
INSERT INTO system_settings (key, value) VALUES
('allow_self_registration', 'true'),
('maintenance_mode', 'false')
ON CONFLICT (key) DO NOTHING;

