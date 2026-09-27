const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

describe('Frontend Race Condition & State Synchronization Logic', () => {

  test('fetchChecklistSeq ensures stale out-of-order network responses are discarded', async () => {
    // Simulate the state machine implemented in attendance.html
    let state = {
      daySlots: [],
      isChecklistLoading: false,
      fetchChecklistSeq: 0,
      activeDate: '2026-09-21' // Monday
    };

    // Helper simulating fetchChecklist() in attendance.html
    async function triggerDateChange(newDate, delayMs, mockSlots) {
      state.activeDate = newDate;
      state.daySlots = []; // Synchronous state wipe
      state.isChecklistLoading = true;
      const thisSeq = ++state.fetchChecklistSeq;

      // Simulate async network request
      await new Promise(resolve => setTimeout(resolve, delayMs));

      // Check sequence condition
      if (thisSeq !== state.fetchChecklistSeq) {
        // Discard stale response
        return { discarded: true, seq: thisSeq };
      }

      state.isChecklistLoading = false;
      state.daySlots = mockSlots;
      return { discarded: false, seq: thisSeq, slots: mockSlots };
    }

    // Scenario: User clicks Monday (request takes 100ms), then rapidly clicks Tuesday (takes 20ms)
    const mondayPromise = triggerDateChange('2026-09-21', 100, [
      { subject: 'ML Ops Lab', period: 5 },
      { subject: 'ML Ops Lab', period: 6 }
    ]);

    const tuesdayPromise = triggerDateChange('2026-09-22', 20, [
      { subject: 'ML Ops Theory', period: 1 },
      { subject: 'Computer Networks', period: 2 }
    ]);

    const [mondayRes, tuesdayRes] = await Promise.all([mondayPromise, tuesdayPromise]);

    assert.strictEqual(tuesdayRes.discarded, false, 'Tuesday (latest) response must be applied');
    assert.strictEqual(mondayRes.discarded, true, 'Monday (stale) response must be safely discarded');

    // Final state must strictly contain Tuesday's slots, NEVER Monday's Lab slots
    assert.strictEqual(state.daySlots.length, 2);
    assert.strictEqual(state.daySlots[0].subject, 'ML Ops Theory');
    assert.strictEqual(state.daySlots[1].subject, 'Computer Networks');
  });

  test('markAll guard strictly blocks submission while daySlots are loading', () => {
    let state = {
      daySlots: [],
      isChecklistLoading: true
    };

    function attemptMarkAll() {
      if (state.isChecklistLoading || !state.daySlots || state.daySlots.length === 0) {
        return { success: false, reason: 'LOCKED_WHILE_LOADING_OR_EMPTY' };
      }
      return { success: true, submittedCount: state.daySlots.length };
    }

    // Attempt while loading
    const res1 = attemptMarkAll();
    assert.strictEqual(res1.success, false);
    assert.strictEqual(res1.reason, 'LOCKED_WHILE_LOADING_OR_EMPTY');

    // Finish loading with actual slots
    state.isChecklistLoading = false;
    state.daySlots = [{ subject: 'Math', period: 1 }];

    const res2 = attemptMarkAll();
    assert.strictEqual(res2.success, true);
    assert.strictEqual(res2.submittedCount, 1);
  });
});
