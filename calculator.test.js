// Tests for rules.js and calculator.js. Run with: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const RULES = require('../js/rules.js');
const C = require('../js/calculator.js');

// A Pennsylvania job that the tool can check, with the given pay and weeks.
function pa(pay, weeks) {
  return Object.assign({ state: 'PA', workType: 'restaurant', contractor: 'no' }, pay, { weeks: weeks });
}

test('every entry in rules.js has a source and a verifiedDate field', () => {
  for (const [name, rule] of Object.entries(RULES)) {
    if (typeof rule === 'function') continue;
    assert.ok(rule.source, name + ' needs a source');
    assert.ok('verifiedDate' in rule, name + ' needs a verifiedDate');
    // Anything not verified must say what to verify.
    if (rule.verifiedDate === null) assert.ok(rule.verify, name + ' needs a verify note');
  }
});

test('the verified numbers match what the author verified', () => {
  assert.equal(RULES.v('minimumWage'), 7.25);
  assert.equal(RULES.v('tippedCashWage'), 2.83);
  assert.equal(RULES.v('maxTipCredit'), 4.42);
  assert.equal(RULES.v('tippedCashWage') + RULES.v('maxTipCredit'), 7.25);
  assert.equal(RULES.v('tippedMonthlyThreshold'), 135);
  assert.equal(RULES.v('exemptSalaryWeekly'), 684);
  assert.equal(RULES.v('overtimeThresholdHours'), 40);
  assert.equal(RULES.v('overtimeMultiplier'), 1.5);
});

test('minimum wage only: $5/hr x 30 hours, paid $150, short $67.50', () => {
  const r = C.calculate(pa({ payType: 'hourly', rate: 5 }, [{ hours: 30, paid: 150 }]));
  assert.equal(r.status, 'underpaid');
  assert.equal(r.weeks[0].required, 217.5);
  assert.equal(r.total, 67.5);
});

test('overtime only (the homepage example): $10/hr x 50 hours, paid $500, short $50', () => {
  const r = C.calculate(pa({ payType: 'hourly', rate: 10 }, [{ hours: 50, paid: 500 }]));
  assert.equal(r.weeks[0].required, 550);
  assert.equal(r.total, 50);
  const keys = r.weeks[0].lines.map(l => l.key);
  assert.ok(keys.includes('math.straight') && keys.includes('math.otPremium'), 'shows the math');
});

test('a very low rate ($1/hr) is calculated, not blocked', () => {
  const r = C.calculate(pa({ payType: 'hourly', rate: 1 }, [{ hours: 40, paid: 40 }]));
  assert.equal(r.status, 'underpaid');
  assert.equal(r.total, 250); // 40 x 7.25 = 290, minus 40
});

test('pay well above the minimum looks right with no notes', () => {
  const r = C.calculate(pa({ payType: 'hourly', rate: 30 }, [{ hours: 40, paid: 1200 }]));
  assert.equal(r.status, 'looksRight');
  assert.equal(r.total, 0);
  assert.deepEqual(r.notes, []);
});

test('tipped example: $2.83 x 40 hours, $60 tips, paid $113.20 cash, short $116.80', () => {
  const r = C.calculate(pa({ payType: 'tipped', rate: 2.83 }, [{ hours: 40, paid: 113.2, tips: 60 }]));
  assert.equal(r.isTippedEmployee, true);
  assert.equal(r.weeks[0].required, 230);
  assert.equal(r.total, 116.8);
  assert.equal(r.notes[0].key, 'note.tipsBased');
  assert.equal(r.notes[0].vars.tips, 60);
});

test('tipped with $0 tips is calculated and says it is based on $0 in tips', () => {
  const r = C.calculate(pa({ payType: 'tipped', rate: 2.83 }, [{ hours: 40, paid: 113.2, tips: 0 }]));
  assert.equal(r.total, 176.8); // owed 290 in cash
  const keys = r.notes.map(n => n.key);
  assert.ok(keys.includes('note.tipsBased'));
  assert.ok(keys.includes('note.addTips'));
  assert.equal(r.notes[0].vars.tips, 0);
});

test('tips under $135 a month: not a tipped employee, owed full minimum wage in cash', () => {
  // $20 a week is about $86.67 a month, under the $135 threshold.
  const r = C.calculate(pa({ payType: 'tipped', rate: 2.83 }, [{ hours: 40, paid: 113.2, tips: 20 }]));
  assert.equal(r.isTippedEmployee, false);
  assert.equal(r.weeks[0].required, 290);
  assert.equal(r.total, 176.8);
  assert.ok(r.notes.some(n => n.key === 'note.notTippedEmployee'));
});

test('tipped overtime uses cash wage + 0.5 x minimum wage for overtime hours', () => {
  // 45 hours, lots of tips: cash owed = 2.83 x 40 + (2.83 + 3.625) x 5 = 145.475, or $145.48
  const r = C.calculate(pa({ payType: 'tipped', rate: 2.83 }, [{ hours: 45, paid: 145.48, tips: 300 }]));
  assert.equal(r.weeks[0].required, 145.48);
  assert.equal(r.status, 'looksRight');
});

test('tipped worker paid at or above minimum wage in cash is checked like hourly', () => {
  const r = C.calculate(pa({ payType: 'tipped', rate: 8 }, [{ hours: 50, paid: 400, tips: 500 }]));
  assert.equal(r.weeks[0].required, 440); // 50 x 8 + 10 x 0.5 x 8
  assert.equal(r.total, 40);
});

test('salaried non-exempt uses the Pennsylvania 40-hour divisor', () => {
  // $600 salary, 50 hours: regular rate 600 / 40 = $15, overtime 10 x 22.50 = $225
  const r = C.calculate(pa({ payType: 'salary', salary: 600 }, [{ hours: 50, paid: 600 }]));
  assert.equal(r.weeks[0].required, 825);
  assert.equal(r.total, 225);
  // The federal hours-worked method would give only 600 / 50 x 0.5 x 10 = $60.
  assert.notEqual(r.total, 60);
});

test('salaried non-exempt under 40 hours with a fair salary looks right', () => {
  const r = C.calculate(pa({ payType: 'salary', salary: 500 }, [{ hours: 35, paid: 500 }]));
  assert.equal(r.status, 'looksRight');
});

test('salary too low for the hours still gets minimum wage', () => {
  // $200 for 40 hours is $5 an hour; minimum is 40 x 7.25 = $290.
  const r = C.calculate(pa({ payType: 'salary', salary: 200 }, [{ hours: 40, paid: 200 }]));
  assert.equal(r.total, 90);
});

test('salary of $684 or more is "can\'t tell" (depends on job duties)', () => {
  assert.deepEqual(C.checkStep2({ payType: 'salary', salary: 684 }), { status: 'cantTell', reason: 'exempt' });
  assert.equal(C.checkStep2({ payType: 'salary', salary: 683.99 }), null);
  const r = C.calculate(pa({ payType: 'salary', salary: 900 }, [{ hours: 50, paid: 900 }]));
  assert.equal(r.status, 'cantTell');
});

test('day rate uses total hours worked (federal method)', () => {
  // $100 a day x 6 days = $600 for 60 hours: rate $10, premium 20 x 0.5 x 10 = $100
  const r = C.calculate(pa({ payType: 'flat', flatKind: 'day' }, [{ hours: 60, paid: 600 }]));
  assert.equal(r.weeks[0].required, 700);
  assert.equal(r.total, 100);
});

test('piece rate uses the same method', () => {
  const r = C.calculate(pa({ payType: 'flat', flatKind: 'piece' }, [{ hours: 45, paid: 540 }]));
  // 540 / 45 = $12, premium 5 x 0.5 x 12 = $30
  assert.equal(r.total, 30);
});

test('flat pay below minimum wage is raised to minimum wage', () => {
  // $200 for 50 hours = $4/hr. Owed 50 x 7.25 + 10 x 0.5 x 7.25 = 398.75
  const r = C.calculate(pa({ payType: 'flat', flatKind: 'day' }, [{ hours: 50, paid: 200 }]));
  assert.equal(r.weeks[0].required, 398.75);
  assert.equal(r.total, 198.75);
});

test('an overpaid week does not cancel out a short week', () => {
  const r = C.calculate(pa({ payType: 'hourly', rate: 10 }, [
    { hours: 50, paid: 500 },   // short $50
    { hours: 30, paid: 400 }    // overpaid $100
  ]));
  assert.equal(r.weeks[0].shortfall, 50);
  assert.equal(r.weeks[1].shortfall, 0);
  assert.equal(r.total, 50);
});

test('weekly hours are not averaged: 50 + 30 hours still has 10 overtime hours', () => {
  const r = C.calculate(pa({ payType: 'hourly', rate: 10 }, [
    { hours: 50, paid: 500 }, { hours: 30, paid: 300 }
  ]));
  assert.equal(r.total, 50);
});

test('differences under $0.50 count as rounding', () => {
  const r = C.calculate(pa({ payType: 'hourly', rate: 10 }, [{ hours: 40, paid: 399.6 }]));
  assert.equal(r.status, 'looksRight');
  assert.equal(r.weeks[0].rounding, true);
  const r2 = C.calculate(pa({ payType: 'hourly', rate: 10 }, [{ hours: 40, paid: 399.5 }]));
  assert.equal(r2.total, 0.5);
});

test('step 1 sends farm, household, contractor to "can\'t tell" and other states to "not PA"', () => {
  assert.equal(C.checkStep1({ state: 'other', workType: 'retail', contractor: 'no' }).status, 'notPA');
  assert.equal(C.checkStep1({ state: 'PA', workType: 'farm', contractor: 'no' }).reason, 'farm');
  assert.equal(C.checkStep1({ state: 'PA', workType: 'household', contractor: 'no' }).reason, 'household');
  assert.equal(C.checkStep1({ state: 'PA', workType: 'retail', contractor: 'yes' }).reason, 'contractor');
  assert.equal(C.checkStep1({ state: 'PA', workType: 'warehouse', contractor: 'no' }), null);
});

test('validation blocks impossible inputs', () => {
  assert.equal(C.validateWeek({ hours: null, paid: 10 }, 'hourly').errors.hours, 'err.required');
  assert.equal(C.validateWeek({ hours: -5, paid: 10 }, 'hourly').errors.hours, 'err.negative');
  assert.equal(C.validateWeek({ hours: 0, paid: 10 }, 'hourly').errors.hours, 'err.zeroHours');
  assert.equal(C.validateWeek({ hours: 169, paid: 10 }, 'hourly').errors.hours, 'err.tooManyHours');
  assert.equal(C.validateWeek({ hours: 40, paid: null }, 'hourly').errors.paid, 'err.required');
  assert.equal(C.validateWeek({ hours: 40, paid: -1 }, 'hourly').errors.paid, 'err.negative');
  assert.equal(C.validateWeek({ hours: 40, paid: 100, tips: -3 }, 'tipped').errors.tips, 'err.negative');
  assert.equal(C.validateAmount(null), 'err.required');
  assert.equal(C.validateAmount(-2), 'err.negative');
  assert.equal(C.validateAmount(0), null);
});

test('validation warns about very high hours but does not block', () => {
  const v = C.validateWeek({ hours: 100, paid: 1000 }, 'hourly');
  assert.deepEqual(v.errors, {});
  assert.deepEqual(v.warnings, ['warn.highHours']);
  assert.deepEqual(C.validateWeek({ hours: 168, paid: 10 }, 'hourly').errors, {});
});

test('toNumber reads money the way people type it', () => {
  assert.equal(C.toNumber('$1,200.50'), 1200.5);
  assert.equal(C.toNumber(''), null);
  assert.equal(C.toNumber('   '), null);
  assert.ok(Number.isNaN(C.toNumber('abc')));
});
