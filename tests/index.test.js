// Master test suite runner executing all tests sequentially in single process
require('./frontendRaceGuard.test.js');
require('./databaseIntegrity.test.js');
require('./attendanceRepository.test.js');
require('./attendanceController.test.js');
require('./simulator.test.js');
