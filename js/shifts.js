/*
 * shifts.js
 * Turns shifts (date, start, end, unpaid break) into hours per workweek.
 *
 * How it works:
 * - Times are handled as plain clock times using UTC math, so the result is
 *   the same on every computer. Known limit: a shift that crosses a
 *   daylight-saving-time change is off by one hour.
 * - An end time earlier than the start time means the shift ran past midnight.
 * - A workweek is a fixed 7-day block that starts at midnight on the weekday
 *   the worker picks (Monday by default).
 * - A shift that crosses that midnight is split in proportion to the clock
 *   time on each side. The unpaid break is spread the same way, as if it
 *   were taken evenly across the shift.
 *
 * Works in the browser (window.Shifts) and in Node (require).
 */
(function (root) {
  'use strict';

  var RULES = root.RULES || (typeof require !== 'undefined' ? require('./rules.js') : null);

  var MINUTE = 60 * 1000;
  var DAY = 24 * 60 * MINUTE;
  var MINUTES_PER_DAY = 24 * 60;

  // '2026-10-05' -> milliseconds at midnight (UTC), or null if not a real date.
  function parseDate(text) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text || '');
    if (!m) return null;
    var ms = Date.UTC(+m[1], +m[2] - 1, +m[3]);
    // Reject dates like 2026-02-31 that roll over into the next month.
    return formatDate(ms) === text ? ms : null;
  }

  // milliseconds -> '2026-10-05'
  function formatDate(ms) {
    return new Date(ms).toISOString().slice(0, 10);
  }

  // '22:30' -> 1350 minutes after midnight, or null.
  function parseTime(text) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(text || '');
    if (!m || +m[1] > 23 || +m[2] > 59) return null;
    return +m[1] * 60 + +m[2];
  }

  /*
   * Build one shift from what was typed.
   * raw = { date: '2026-10-05', start: '09:00', end: '17:00', breakMinutes: 30 }
   * breakMinutes may be null (blank means no break).
   * Returns the times plus { errors: { field: key }, warnings: [key] }.
   */
  function buildShift(raw) {
    var errors = {};
    var warnings = [];
    var day = parseDate(raw.date);
    var start = parseTime(raw.start);
    var end = parseTime(raw.end);
    var brk = raw.breakMinutes === null || raw.breakMinutes === undefined ? 0 : raw.breakMinutes;

    if (day === null) errors.date = 'err.required';
    if (start === null) errors.start = 'err.required';
    if (end === null) errors.end = 'err.required';
    if (typeof brk !== 'number' || !isFinite(brk)) errors.breakMinutes = 'err.number';
    else if (brk < 0) errors.breakMinutes = 'err.negative';

    var shift = { raw: raw, errors: errors, warnings: warnings, valid: false };
    if (Object.keys(errors).length) return shift;

    if (start === end) {
      errors.end = 'err.sameTime';
      return shift;
    }

    // End before start: the shift runs past midnight into the next day.
    var clock = end - start;
    if (clock < 0) {
      clock += MINUTES_PER_DAY;
      warnings.push('warn.overnight');
    }
    if (brk >= clock) {
      errors.breakMinutes = 'err.breakTooLong';
      return shift;
    }
    if (clock > RULES.v('longShiftHours') * 60) warnings.push('warn.longShift');

    shift.startMs = day + start * MINUTE;
    shift.endMs = shift.startMs + clock * MINUTE;
    shift.clockMinutes = clock;
    shift.breakMinutes = brk;
    shift.paidMinutes = clock - brk;
    shift.paidHours = (clock - brk) / 60;
    shift.valid = true;
    return shift;
  }

  /*
   * Build every shift and flag overlaps. When two shifts overlap, the error
   * goes on the one that starts later.
   */
  function validateShifts(rawShifts) {
    var shifts = rawShifts.map(buildShift);
    var valid = shifts
      .map(function (s, i) { return { s: s, i: i }; })
      .filter(function (x) { return x.s.valid; })
      .sort(function (a, b) { return a.s.startMs - b.s.startMs || a.i - b.i; });

    var latestEnd = -Infinity;
    valid.forEach(function (x) {
      if (x.s.startMs < latestEnd) {
        x.s.errors.shift = 'err.overlap';
        x.s.valid = false;
      }
      latestEnd = Math.max(latestEnd, x.s.endMs);
    });
    return shifts;
  }

  // Midnight at the start of the workweek that contains this moment.
  // weekStartDay: 0 = Sunday, 1 = Monday, ... 6 = Saturday.
  function weekStartFor(ms, weekStartDay) {
    var midnight = Math.floor(ms / DAY) * DAY;
    var weekday = new Date(midnight).getUTCDay();
    var daysBack = (weekday - weekStartDay + 7) % 7;
    return midnight - daysBack * DAY;
  }

  /*
   * Split one valid shift across workweeks.
   * 1. Count clock minutes on each side of the boundary (before any break).
   * 2. Each side's share = its clock minutes / the shift's clock minutes.
   * 3. Paid hours for that side = the shift's paid hours x its share.
   * Returns [{ weekStart, clockMinutes, paidHours }].
   */
  function splitShift(shift, weekStartDay) {
    var weekLength = RULES.v('workweekDays') * DAY;
    var parts = [];
    var cursor = shift.startMs;
    while (cursor < shift.endMs) {
      var weekStart = weekStartFor(cursor, weekStartDay);
      var boundary = weekStart + weekLength;
      var pieceEnd = Math.min(boundary, shift.endMs);
      var clock = (pieceEnd - cursor) / MINUTE;
      parts.push({
        weekStart: weekStart,
        clockMinutes: clock,
        paidHours: shift.paidHours * (clock / shift.clockMinutes)
      });
      cursor = pieceEnd;
    }
    return parts;
  }

  /*
   * Add up valid shifts into workweeks, oldest first.
   * Returns [{ weekStart, start: 'YYYY-MM-DD', end: 'YYYY-MM-DD', hours }].
   */
  function groupIntoWeeks(shifts, weekStartDay) {
    var byWeek = {};
    shifts.forEach(function (s) {
      if (!s.valid) return;
      splitShift(s, weekStartDay).forEach(function (part) {
        byWeek[part.weekStart] = (byWeek[part.weekStart] || 0) + part.paidHours;
      });
    });
    var lastDay = (RULES.v('workweekDays') - 1) * DAY;
    return Object.keys(byWeek)
      .map(Number)
      .sort(function (a, b) { return a - b; })
      .map(function (ws) {
        return {
          weekStart: ws,
          start: formatDate(ws),
          end: formatDate(ws + lastDay),
          // Round to 1/100 of an hour so 1.75 does not show as 1.7499999.
          hours: Math.round(byWeek[ws] * 100) / 100
        };
      });
  }

  // A new shift starts as a copy of the last one, on the next day.
  function nextShiftDefaults(last) {
    if (!last) return { date: '', start: '', end: '', breakMinutes: null };
    var day = parseDate(last.date);
    return {
      date: day === null ? '' : formatDate(day + DAY),
      start: last.start,
      end: last.end,
      breakMinutes: last.breakMinutes
    };
  }

  var Shifts = {
    parseDate: parseDate,
    formatDate: formatDate,
    parseTime: parseTime,
    buildShift: buildShift,
    validateShifts: validateShifts,
    weekStartFor: weekStartFor,
    splitShift: splitShift,
    groupIntoWeeks: groupIntoWeeks,
    nextShiftDefaults: nextShiftDefaults
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Shifts;
  } else {
    root.Shifts = Shifts;
  }
})(typeof window !== 'undefined' ? window : globalThis);
