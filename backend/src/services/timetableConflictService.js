const db = require('../config/db');

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Get weekday name from YYYY-MM-DD
 */
const getDayName = (dateStr) => {
  const parts = String(dateStr).split('T')[0].split('-');
  const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  return DAYS_OF_WEEK[d.getDay()];
};

/**
 * Detect all conflicts for a proposed schedule adjustment set
 * @param {object} params { department, semester, date, adjustments }
 * @returns {Promise<{ hasConflicts: boolean, conflicts: Array, availableRooms: Array, availablePeriods: Array }>}
 */
const detectAdjustmentConflicts = async ({ department, semester, date, adjustments = [] }) => {
  const cleanDate = String(date).split('T')[0];
  const weekday = getDayName(cleanDate);
  const conflicts = [];

  // 1. Check if date is an official holiday for this cohort
  const holidayQuery = `
    SELECT id, name, date, department, semester
    FROM holidays
    WHERE date = $1
      AND (department IS NULL OR department = $2)
      AND (semester IS NULL OR semester = $3)
    LIMIT 1
  `;
  const holidayRes = await db.query(holidayQuery, [cleanDate, department, semester]);
  const holiday = holidayRes.rows[0];

  if (holiday) {
    const hasActiveClasses = adjustments.some(a => a.adjustment_type !== 'cancel');
    if (hasActiveClasses || adjustments.length > 0) {
      conflicts.push({
        id: `HOLIDAY_${cleanDate}`,
        type: 'HOLIDAY_CONFLICT',
        severity: 'danger',
        period: null,
        title: `Official Holiday: ${holiday.name}`,
        message: `Date ${cleanDate} is marked as an institution holiday ("${holiday.name}"). Scheduling active classes on a holiday creates student attendance conflicts.`,
        suggestedFix: {
          action: 'CANCEL_OR_RESCHEDULE',
          label: 'Cancel classes or clear adjustments for holiday',
          description: 'Convert scheduled periods to Canceled or remove adjustments on this date.'
        }
      });
    }
  }

  // 2. Fetch all unique campus rooms
  const campusRoomsRes = await db.query(`
    SELECT DISTINCT room
    FROM timetable
    WHERE room IS NOT NULL AND TRIM(room) != ''
    ORDER BY room
  `);
  const allCampusRooms = campusRoomsRes.rows.map(r => r.room.trim());

  // 3. Fetch regular timetable slots for this cohort on this weekday
  const currentCohortSlotsRes = await db.query(`
    SELECT t.*, s.subject_name, s.subject_code
    FROM timetable t
    LEFT JOIN subjects s ON t.subject_id = s.id
    WHERE t.department = $1 AND t.semester = $2 AND t.day = $3
    ORDER BY t.period
  `, [department, semester, weekday]);
  const currentCohortSlots = currentCohortSlotsRes.rows;

  // 4. Fetch regular schedule slots from OTHER cohorts on this weekday
  const otherCohortsSlotsRes = await db.query(`
    SELECT t.*, s.subject_name, s.subject_code
    FROM timetable t
    LEFT JOIN subjects s ON t.subject_id = s.id
    WHERE t.day = $1 AND NOT (t.department = $2 AND t.semester = $3)
  `, [weekday, department, semester]);
  const otherCohortsSlots = otherCohortsSlotsRes.rows;

  // 5. Fetch existing adjustments from OTHER cohorts on this specific date
  const otherAdjustmentsRes = await db.query(`
    SELECT sa.*, s.subject_name as adjusted_subject_name, s.subject_code as adjusted_subject_code
    FROM schedule_adjustments sa
    LEFT JOIN subjects s ON sa.adjusted_subject_id = s.id
    WHERE sa.date = $1 AND NOT (sa.department = $2 AND sa.semester = $3)
  `, [cleanDate, department, semester]);
  const otherAdjustments = otherAdjustmentsRes.rows;

  // 6. Fetch master subject details for any adjusted_subject_ids used
  const subjectIdsToLookup = [
    ...new Set(adjustments.map(a => a.adjusted_subject_id).filter(Boolean))
  ];
  let subjectMap = new Map();
  if (subjectIdsToLookup.length > 0) {
    const subsRes = await db.query(`
      SELECT id, subject_name, subject_code
      FROM subjects
      WHERE id = ANY($1::uuid[])
    `, [subjectIdsToLookup]);
    subsRes.rows.forEach(s => subjectMap.set(s.id, s));
  }

  // Set of occupied periods in this cohort
  const occupiedPeriods = new Set(currentCohortSlots.map(s => s.period));
  const adjustmentPeriods = new Set();

  // 7. Inspect each adjustment in the proposed list
  for (const adj of adjustments) {
    const period = parseInt(adj.period, 10);

    // Check duplicate periods in adjustment list
    if (adjustmentPeriods.has(period)) {
      conflicts.push({
        id: `DUP_PERIOD_${period}`,
        type: 'DUPLICATE_PERIOD',
        severity: 'danger',
        period,
        title: `Duplicate Period ${period}`,
        message: `Period ${period} is defined more than once in the schedule adjustments.`,
        suggestedFix: {
          action: 'REMOVE_DUPLICATE',
          label: `Consolidate Period ${period}`,
          description: `Keep only one adjustment entry for Period ${period}.`
        }
      });
    }
    adjustmentPeriods.add(period);

    // If adjustment is cancellation, no room or teacher conflict can occur
    if (adj.adjustment_type === 'cancel') {
      continue;
    }

    const currentSlot = currentCohortSlots.find(s => s.period === period);
    const assignedRoom = (currentSlot && currentSlot.room) ? currentSlot.room.trim() : null;

    // A. Room Collision Detection
    if (assignedRoom) {
      // Is another cohort scheduled in this room at this period regularly?
      const roomClashRegular = otherCohortsSlots.find(s =>
        s.period === period && s.room && s.room.trim().toLowerCase() === assignedRoom.toLowerCase()
      );

      if (roomClashRegular) {
        // Find which rooms are free at this period
        const occupiedRoomsAtPeriod = new Set(
          otherCohortsSlots
            .filter(s => s.period === period && s.room)
            .map(s => s.room.trim().toLowerCase())
        );
        const freeRooms = allCampusRooms.filter(r => !occupiedRoomsAtPeriod.has(r.toLowerCase()));
        const suggestedRoom = freeRooms[0] || 'CR TBA';

        conflicts.push({
          id: `ROOM_CLASH_${period}_${assignedRoom}`,
          type: 'ROOM_COLLISION',
          severity: 'danger',
          period,
          room: assignedRoom,
          title: `Room Collision in ${assignedRoom} (Period ${period})`,
          message: `Room "${assignedRoom}" is already occupied by ${roomClashRegular.department || 'another class'} Semester ${roomClashRegular.semester || ''} (${roomClashRegular.subject_name || roomClashRegular.subject_code || 'Class'}) during Period ${period}.`,
          suggestedFix: {
            action: 'REASSIGN_ROOM',
            label: `Move to vacant room "${suggestedRoom}"`,
            targetRoom: suggestedRoom,
            availableRooms: freeRooms.slice(0, 5)
          }
        });
      }
    }

    // B. Subject / Instructor Double Booking Detection
    if (adj.adjusted_subject_id) {
      const subjectInfo = subjectMap.get(adj.adjusted_subject_id);
      const subjectCode = subjectInfo ? subjectInfo.subject_code : null;
      const subjectName = subjectInfo ? subjectInfo.subject_name : 'Course';

      if (subjectCode) {
        // Check if another cohort is taking this course code at the same period
        const teacherClash = otherCohortsSlots.find(s =>
          s.period === period && (s.subject_id === adj.adjusted_subject_id || (s.subject_code && s.subject_code.toLowerCase() === subjectCode.toLowerCase()))
        );

        // Check if another cohort has adjusted this same subject at this period
        const teacherClashAdj = otherAdjustments.find(a =>
          a.period === period && (a.adjusted_subject_id === adj.adjusted_subject_id || (a.adjusted_subject_code && a.adjusted_subject_code.toLowerCase() === subjectCode.toLowerCase()))
        );

        const clashSource = teacherClash || teacherClashAdj;
        if (clashSource) {
          // Find open periods for this cohort where the teacher is free
          const busyPeriodsForTeacher = new Set(
            otherCohortsSlots
              .filter(s => s.subject_id === adj.adjusted_subject_id || (s.subject_code && s.subject_code.toLowerCase() === subjectCode.toLowerCase()))
              .map(s => s.period)
          );

          const freePeriods = [1, 2, 3, 4, 5, 6, 7, 8].filter(p => !busyPeriodsForTeacher.has(p) && p !== period);
          const suggestedPeriod = freePeriods[0] || 5;

          conflicts.push({
            id: `TEACHER_CLASH_${period}_${subjectCode}`,
            type: 'SUBJECT_OVERLAP',
            severity: 'danger',
            period,
            subjectCode,
            title: `Instructor Overlap: ${subjectCode} (Period ${period})`,
            message: `Subject "${subjectName}" (${subjectCode}) is simultaneously assigned to ${clashSource.department || 'another class'} Semester ${clashSource.semester || ''} during Period ${period}. The faculty cannot teach two classes at once.`,
            suggestedFix: {
              action: 'RESCHEDULE_PERIOD',
              label: `Move Subject to Period ${suggestedPeriod}`,
              targetPeriod: suggestedPeriod,
              availablePeriods: freePeriods.slice(0, 4)
            }
          });
        }
      }
    }

    // C. Extra Class Overlap Detection
    if (adj.adjustment_type === 'extra') {
      const matchTimes = (adj.remarks || '').match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
      if (matchTimes) {
        const extraStart = matchTimes[1];
        const extraEnd = matchTimes[2];

        // Check against regular slots
        for (const slot of currentCohortSlots) {
          if (slot.period !== period && slot.start_time && slot.end_time) {
            const slotStart = slot.start_time.substring(0, 5);
            const slotEnd = slot.end_time.substring(0, 5);

            // Check time overlap: (startA < endB) and (endA > startB)
            if (extraStart < slotEnd && extraEnd > slotStart) {
              conflicts.push({
                id: `TIME_CLASH_${period}_${slot.period}`,
                type: 'PERIOD_OVERLAP',
                severity: 'warning',
                period,
                title: `Time Overlap with Period ${slot.period}`,
                message: `Extra class period ${period} (${extraStart} - ${extraEnd}) overlaps with Period ${slot.period} (${slotStart} - ${slotEnd}: ${slot.subject_name || slot.subject_code}).`,
                suggestedFix: {
                  action: 'ADJUST_TIME',
                  label: `Adjust time window to avoid Period ${slot.period}`,
                  description: `Schedule after ${slotEnd} or choose an unallocated time window.`
                }
              });
            }
          }
        }
      }
    }
  }

  // Available periods (1-8 not currently in use by this cohort)
  const availablePeriods = [1, 2, 3, 4, 5, 6, 7, 8].filter(p => !occupiedPeriods.has(p));

  return {
    hasConflicts: conflicts.length > 0,
    conflictCount: conflicts.length,
    conflicts,
    availableRooms: allCampusRooms.slice(0, 10),
    availablePeriods
  };
};

/**
 * Automatically resolve conflicts by applying suggested fix algorithms
 * @param {object} params { department, semester, date, adjustments, conflictIds }
 * @returns {object} { resolvedAdjustments, resolvedCount, resolutions }
 */
const autoResolveAdjustments = async ({ department, semester, date, adjustments = [] }) => {
  const checkResult = await detectAdjustmentConflicts({ department, semester, date, adjustments });
  if (!checkResult.hasConflicts) {
    return {
      success: true,
      resolvedCount: 0,
      resolvedAdjustments: adjustments,
      resolutions: ['No conflicts found. Schedule is clean.']
    };
  }

  let updatedAdjustments = JSON.parse(JSON.stringify(adjustments));
  const resolutions = [];

  for (const conflict of checkResult.conflicts) {
    if (conflict.type === 'HOLIDAY_CONFLICT') {
      // Auto-fix for holiday: convert active adjustments to canceled or empty
      updatedAdjustments = updatedAdjustments.map(a => ({
        ...a,
        adjustment_type: 'cancel',
        adjusted_subject_id: null,
        remarks: `Auto-resolved: Holiday (${conflict.title})`
      }));
      resolutions.push(`Converted scheduled classes on holiday to canceled.`);
    } else if (conflict.type === 'DUPLICATE_PERIOD') {
      // Keep only first occurrence of each period
      const seen = new Set();
      updatedAdjustments = updatedAdjustments.filter(a => {
        if (seen.has(a.period)) return false;
        seen.add(a.period);
        return true;
      });
      resolutions.push(`Consolidated duplicate Period ${conflict.period} entries.`);
    } else if (conflict.type === 'SUBJECT_OVERLAP') {
      // Move to alternate period if suggested
      if (conflict.suggestedFix && conflict.suggestedFix.targetPeriod) {
        const targetP = conflict.suggestedFix.targetPeriod;
        const targetAdj = updatedAdjustments.find(a => a.period === conflict.period);
        if (targetAdj) {
          targetAdj.period = targetP;
          targetAdj.remarks = `${targetAdj.remarks || ''} (Shifted from P${conflict.period} to avoid clash)`.trim();
          resolutions.push(`Shifted subject ${conflict.subjectCode} from Period ${conflict.period} to open Period ${targetP}.`);
        }
      }
    } else if (conflict.type === 'ROOM_COLLISION') {
      // Mark remarks with reassigned room
      const targetAdj = updatedAdjustments.find(a => a.period === conflict.period);
      if (targetAdj && conflict.suggestedFix && conflict.suggestedFix.targetRoom) {
        targetAdj.remarks = `${targetAdj.remarks || ''} [Room: ${conflict.suggestedFix.targetRoom}]`.trim();
        resolutions.push(`Reassigned Period ${conflict.period} room to "${conflict.suggestedFix.targetRoom}".`);
      }
    }
  }

  return {
    success: true,
    resolvedCount: resolutions.length,
    resolvedAdjustments: updatedAdjustments,
    resolutions
  };
};

/**
 * Scan all active schedule adjustments across the system for conflicts
 * @returns {Promise<Array>} List of conflicting schedule adjustment groups
 */
const getAllTimetableConflicts = async () => {
  const query = `
    SELECT 
      sa.date,
      sa.department,
      sa.semester,
      COUNT(sa.id) as adjustment_count
    FROM schedule_adjustments sa
    WHERE sa.date >= CURRENT_DATE - INTERVAL '7 days'
    GROUP BY sa.date, sa.department, sa.semester
    ORDER BY sa.date ASC
  `;
  const cohortsRes = await db.query(query);
  const detectedConflicts = [];

  for (const cohort of cohortsRes.rows) {
    const cleanDate = cohort.date.toISOString().split('T')[0];
    const adjQuery = `
      SELECT sa.*, s.subject_name as adjusted_subject_name, s.subject_code as adjusted_subject_code
      FROM schedule_adjustments sa
      LEFT JOIN subjects s ON sa.adjusted_subject_id = s.id
      WHERE sa.department = $1 AND sa.semester = $2 AND sa.date = $3
      ORDER BY sa.period
    `;
    const adjRes = await db.query(adjQuery, [cohort.department, cohort.semester, cleanDate]);
    const check = await detectAdjustmentConflicts({
      department: cohort.department,
      semester: cohort.semester,
      date: cleanDate,
      adjustments: adjRes.rows
    });

    if (check.hasConflicts) {
      detectedConflicts.push({
        date: cleanDate,
        department: cohort.department,
        semester: cohort.semester,
        adjustmentCount: parseInt(cohort.adjustment_count, 10),
        conflicts: check.conflicts
      });
    }
  }

  return detectedConflicts;
};

module.exports = {
  detectAdjustmentConflicts,
  autoResolveAdjustments,
  getAllTimetableConflicts
};
