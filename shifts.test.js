// Tests for shifts.js. Run with: node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../js/shifts.js');
const C = require('../js/calculator.js');

const MONDAY = 1;
const SUNDAY = 0;

function shift(date, start, end, breakMinutes = null) {
  return { date, start, end, breakMinutes };
}

test('a normal shift: 09:00 to 17:00 with a 30-minute break is 7.5 paid hours', () => {
  const s = S.buildShift(shift('2026-10-05', '09:00', '17:00', 30));
  assert.equal(s.valid, true);
  assert.equal(s.paidHours, 7.5);
  assert.deepEqual(s.warnings, []);
});

test('end before start runs past midnight: 22:00 to 06:00 is 8 hours, with a note', () => {
  const s = S.buildShift(shift('2026-10-06', '22:00', '06:00'));
  assert.equal(s.valid, true);
  assert.equal(s.paidHours, 8);
  assert.ok(s.warnings.includes('warn.overnight'));
});

test('a shift over 16 hours gets a "double-check this" note but still counts', () => {
  const s = S.buildShift(shift('2026-10-06', '06:00', '23:00'));
  assert.equal(s.valid, true);
  assert.equal(s.paidHours, 17);
  assert.ok(s.warnings.includes('warn.longShift'));
});

test('same start and end time is an error', () => {
  const s = S.buildShift(shift('2026-10-06', '09:00', '09:00'));
  assert.equal(s.valid, false);
  assert.equal(s.errors.end, 'err.sameTime');
});

test('a break as long as the shift is an error', () => {
  const s = S.buildShift(shift('2026-10-06', '09:00', '10:00', 60));
  assert.equal(s.errors.breakMinutes, 'err.breakTooLong');
});

test('blank fields and a negative break are errors; a blank break means no break', () => {
  const s = S.buildShift(shift('', '', '17:00', -5));
  assert.equal(s.errors.date, 'err.required');
  assert.equal(s.errors.start, 'err.required');
  assert.equal(s.errors.breakMinutes, 'err.negative');
  assert.equal(S.buildShift(shift('2026-10-06', '09:00', '17:00', null)).paidHours, 8);
  assert.equal(S.parseDate('2026-02-31'), null);
});

test('overlapping shifts: the error goes on the later shift', () => {
  const shifts = S.validateShifts([
    shift('2026-10-06', '12:00', '20:00'),  // later shift, entered first
    shift('2026-10-06', '09:00', '13:00')   // earlier shift
  ]);
  assert.equal(shifts[0].errors.shift, 'err.overlap');
  assert.equal(shifts[1].errors.shift, undefined);
  assert.equal(shifts[1].valid, true);
});

test('an overnight shift that runs into the next shift is an overlap', () => {
  const shifts = S.validateShifts([
    shift('2026-10-06', '22:00', '06:00'),
    shift('2026-10-07', '05:00', '09:00')
  ]);
  assert.equal(shifts[1].errors.shift, 'err.overlap');
});

test('back-to-back shifts do not overlap', () => {
  const shifts = S.validateShifts([
    shift('2026-10-06', '09:00', '13:00'),
    shift('2026-10-06', '13:00', '17:00')
  ]);
  assert.ok(shifts.every(s => s.valid));
});

test('boundary split, no break: Sunday 22:00 to Monday 06:00 is 2 + 6 hours', () => {
  const [s] = S.validateShifts([shift('2026-10-11', '22:00', '06:00')]);
  const parts = S.splitShift(s, MONDAY);
  assert.equal(parts.length, 2);
  assert.equal(parts[0].paidHours, 2);
  assert.equal(parts[1].paidHours, 6);
});

test('boundary split, 60-minute break: 1.75 + 5.25 hours (break spread in proportion)', () => {
  const [s] = S.validateShifts([shift('2026-10-11', '22:00', '06:00', 60)]);
  const parts = S.splitShift(s, MONDAY);
  assert.equal(parts[0].paidHours, 1.75);
  assert.equal(parts[1].paidHours, 5.25);
});

test('an overnight shift inside one workweek is not split', () => {
  const [s] = S.validateShifts([shift('2026-10-06', '22:00', '06:00')]); // Tuesday night
  assert.equal(S.splitShift(s, MONDAY).length, 1);
});

test('the workweek start day can be changed', () => {
  // With weeks starting Sunday, Saturday 22:00 to Sunday 06:00 crosses the boundary...
  const [sat] = S.validateShifts([shift('2026-10-10', '22:00', '06:00')]);
  assert.equal(S.splitShift(sat, SUNDAY).length, 2);
  // ...and Sunday 22:00 to Monday 06:00 does not.
  const [sun] = S.validateShifts([shift('2026-10-11', '22:00', '06:00')]);
  assert.equal(S.splitShift(sun, SUNDAY).length, 1);
});

test('weekStartFor finds the Monday that starts the week', () => {
  const thursday = S.parseDate('2026-10-08');
  assert.equal(S.formatDate(S.weekStartFor(thursday, MONDAY)), '2026-10-05');
  assert.equal(S.formatDate(S.weekStartFor(thursday, SUNDAY)), '2026-10-04');
  const monday = S.parseDate('2026-10-05');
  assert.equal(S.formatDate(S.weekStartFor(monday, MONDAY)), '2026-10-05');
});

test('REQUIRED: split-week overtime test ($10/hr, weeks start Monday)', () => {
  const raw = [
    shift('2026-10-05', '09:00', '17:00'),
    shift('2026-10-06', '09:00', '17:00'),
    shift('2026-10-07', '09:00', '17:00'),
    shift('2026-10-08', '09:00', '17:00'),
    shift('2026-10-09', '09:00', '17:00'),
    shift('2026-10-11', '22:00', '06:00')   // Sunday night into Monday
  ];
  const weeks = S.groupIntoWeeks(S.validateShifts(raw), MONDAY);
  assert.equal(weeks.length, 2);
  assert.equal(weeks[0].start, '2026-10-05');
  assert.equal(weeks[0].end, '2026-10-11');
  assert.equal(weeks[0].hours, 42);
  assert.equal(weeks[1].start, '2026-10-12');
  assert.equal(weeks[1].end, '2026-10-18');
  assert.equal(weeks[1].hours, 6);

  const result = C.calculate({
    state: 'PA', workType: 'warehouse', contractor: 'no',
    payType: 'hourly', rate: 10,
    weeks: [{ hours: weeks[0].hours, paid: 420 }, { hours: weeks[1].hours, paid: 60 }]
  });
  assert.equal(result.weeks[0].required, 430);
  assert.equal(result.weeks[0].shortfall, 10);
  assert.equal(result.weeks[1].required, 60);
  assert.equal(result.weeks[1].shortfall, 0);
  assert.equal(result.total, 10);
});

test('putting the whole boundary shift in one week would give the wrong answer', () => {
  // If all 8 hours went into week 1, week 1 would be 48 hours, not 42.
  const weeks = S.groupIntoWeeks(S.validateShifts([
    shift('2026-10-05', '09:00', '17:00'),
    shift('2026-10-11', '22:00', '06:00')
  ]), MONDAY);
  assert.equal(weeks[0].hours, 10);
  assert.equal(weeks[1].hours, 6);
});

test('invalid and overlapping shifts are left out of the weekly totals', () => {
  const weeks = S.groupIntoWeeks(S.validateShifts([
    shift('2026-10-05', '09:00', '17:00'),
    shift('2026-10-05', '10:00', '12:00'),  // overlaps
    shift('2026-10-06', '09:00', '09:00')   // same start and end
  ]), MONDAY);
  assert.equal(weeks.length, 1);
  assert.equal(weeks[0].hours, 8);
});

test('the next shift is prefilled with the next day and the same times', () => {
  const next = S.nextShiftDefaults(shift('2026-10-31', '22:00', '06:00', 30));
  assert.deepEqual(next, { date: '2026-11-01', start: '22:00', end: '06:00', breakMinutes: 30 });
  assert.equal(S.nextShiftDefaults(null).date, '');
});
