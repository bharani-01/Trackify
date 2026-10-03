const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

describe('Predicted Attendance Simulator - Verification', () => {

  test('Simulator HTML page exists and contains required minimal prediction components', () => {
    const filePath = path.join(__dirname, '../frontend/student/simulator.html');
    assert.strictEqual(fs.existsSync(filePath), true, 'simulator.html must exist in frontend/student/');

    const content = fs.readFileSync(filePath, 'utf8');
    assert.ok(content.includes('Predicted Attendance &amp; Closing Simulator') || content.includes('Predicted Attendance & Closing Simulator'), 'Contains title');
    assert.ok(content.includes('2026-10-23'), 'Contains default closing date 23 Oct 2026');
    assert.ok(content.includes('statRemainingDaysNumber'), 'Contains days remaining display');
    assert.ok(content.includes('statRemainingClassesSummary'), 'Contains classes remaining display');
    assert.ok(content.includes('subject-table'), 'Contains subject prediction table');
    assert.ok(content.includes('renderSubjectBreakdownTable'), 'Contains subject breakdown prediction logic');
    assert.ok(!content.includes('today-slots-container'), 'Today slots checklist section must be removed');
    assert.ok(!content.includes("Today's Schedule"), 'Today schedule section must be removed');

    const emojiRegex = /\p{Extended_Pictographic}/gu;
    const emojiMatches = content.match(emojiRegex) || [];
    assert.strictEqual(emojiMatches.length, 0, 'simulator.html must contain strictly zero emojis');
  });

  test('Simulator is unlisted from student navigation links in app-nav.js', () => {
    const navPath = path.join(__dirname, '../assets/js/app-nav.js');
    const navContent = fs.readFileSync(navPath, 'utf8');

    // Ensure studentNavItems does NOT include simulator or predicted-attendance
    assert.ok(!navContent.includes('/student/simulator'), 'Simulator must not have direct nav link in app-nav.js');
    assert.ok(!navContent.includes('/student/predicted-attendance'), 'Predicted attendance must not have direct nav link in app-nav.js');
  });

  test('Server routes include direct URL handlers for simulator and predicted-attendance', () => {
    const serverPath = path.join(__dirname, '../backend/server.js');
    const serverContent = fs.readFileSync(serverPath, 'utf8');

    assert.ok(serverContent.includes('/student/predicted-attendance'), 'server.js must have direct URL mapping');
    assert.ok(serverContent.includes('simulator.html'), 'server.js must point to simulator.html');
  });

});
