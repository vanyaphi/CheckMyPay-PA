/*
 * calculator.js
 * The pay math. It takes what the worker typed and returns a result.
 * It never shows anything on screen; check.js does that.
 *
 * Every legal number comes from rules.js. Explanations of the math are
 * returned as { key, vars } objects so the page can show them in English
 * or Spanish (the words live in i18n.js).
 *
 * Works in the browser (window.Calculator) and in Node (require).
 */
(function (root) {
  'use strict';

  var RULES = root.RULES || (typeof require !== 'undefined' ? require('./rules.js') : null);
  var v = RULES.v;

  // Round to cents so floating point leftovers (like 0.30000000000000004) go away.
  function cents(n) {
    return Math.round(n * 100) / 100;
  }

  // Split a week's hours into regular hours (up to 40) and overtime hours.
  function splitHours(hours) {
    var limit = v('overtimeThresholdHours');
    return {
      regular: Math.min(hours, limit),
      overtime: Math.max(0, hours - limit)
    };
  }

  // The extra part of overtime pay on top of straight time (1.5 - 1 = 0.5).
  function premiumFactor() {
    return v('overtimeMultiplier') - 1;
  }

  // ------------------------------------------------------------ Step checks

  // Step 1: state, type of work, independent contractor.
  // Returns a final result if the tool cannot go further, otherwise null.
  function checkStep1(job) {
    if (job.state !== 'PA') {
      return { status: 'notPA' };
    }
    if (job.workType === 'farm' || job.workType === 'household') {
      return { status: 'cantTell', reason: job.workType };
    }
    if (job.contractor === 'yes') {
      return { status: 'cantTell', reason: 'contractor' };
    }
    return null;
  }

  // Step 2: how the worker is paid. A weekly salary at or above the federal
  // exempt level means the answer depends on job duties, which the tool
  // cannot judge. Returns a final result, or null to keep going.
  function checkStep2(pay) {
    if (pay.payType === 'salary' && pay.salary >= v('exemptSalaryWeekly')) {
      return { status: 'cantTell', reason: 'exempt' };
    }
    return null;
  }

  // -------------------------------------------------------- Input checking

  // Is this a real number that is zero or more?
  function isAmount(value) {
    return typeof value === 'number' && isFinite(value) && value >= 0;
  }

  // Turn what was typed into a number. Blank stays null so we can say "required".
  function toNumber(text) {
    if (text === null || text === undefined) return null;
    var cleaned = String(text).replace(/[$,\s]/g, '');
    if (cleaned === '') return null;
    var n = Number(cleaned);
    return isFinite(n) ? n : NaN;
  }

  // Check one rate or salary from Step 2. Returns an error key or null.
  function validateAmount(value) {
    if (value === null) return 'err.required';
    if (!isAmount(value)) return 'err.negative';
    return null;
  }

  // Check one week. Returns { errors: { field: key }, warnings: [key] }.
  // Errors block the calculation. Warnings do not.
  function validateWeek(week, payType) {
    var errors = {};
    var warnings = [];

    if (week.hours === null) errors.hours = 'err.required';
    else if (!isAmount(week.hours)) errors.hours = 'err.negative';
    else if (week.hours === 0) errors.hours = 'err.zeroHours';
    else if (week.hours > v('maxWeeklyHours')) errors.hours = 'err.tooManyHours';
    else if (week.hours >= v('highWeeklyHours')) warnings.push('warn.highHours');

    if (week.paid === null) errors.paid = 'err.required';
    else if (!isAmount(week.paid)) errors.paid = 'err.negative';

    // Tips are optional. Blank means $0.
    if (payType === 'tipped' && week.tips !== null && !isAmount(week.tips)) {
      errors.tips = 'err.negative';
    }
    return { errors: errors, warnings: warnings };
  }

  // ------------------------------------------------------- Weekly math
  // Each function returns { required, lines } for one week.
  // "required" is the least the worker should have been paid in wages.

  // Hourly: the stated rate (raised to minimum wage if it is lower) for every
  // hour, plus half that rate again for each overtime hour.
  function hourlyWeek(rate, hours, lines) {
    var min = v('minimumWage');
    var h = splitHours(hours);
    var regularRate = Math.max(rate, min);
    if (rate < min) {
      lines.push({ key: 'math.rateRaised', vars: { rate: rate, min: min } });
    }
    var straight = cents(regularRate * hours);
    lines.push({ key: 'math.straight', vars: { hours: hours, rate: regularRate, amount: straight } });
    var premium = 0;
    if (h.overtime > 0) {
      premium = cents(h.overtime * premiumFactor() * regularRate);
      lines.push({ key: 'math.otPremium', vars: { ot: h.overtime, factor: premiumFactor(), rate: regularRate, amount: premium } });
    }
    return cents(straight + premium);
  }

  // Tipped: the larger of (a) the cash wage owed and (b) full minimum wage
  // (with overtime) minus tips. If tips average under the monthly threshold,
  // the worker is not a "tipped employee" and is owed full minimum wage in cash.
  function tippedWeek(cashRate, hours, tips, isTippedEmployee, lines) {
    var min = v('minimumWage');
    // A cash wage at or above minimum wage means no tip credit is used,
    // and a worker who is not a tipped employee is owed full minimum wage.
    if (!isTippedEmployee || cashRate >= min) {
      return hourlyWeek(cashRate, hours, lines);
    }
    var h = splitHours(hours);
    var cash = Math.max(cashRate, v('tippedCashWage'));
    if (cashRate < v('tippedCashWage')) {
      lines.push({ key: 'math.cashRaised', vars: { rate: cashRate, min: cash } });
    }
    // (a) Cash wage owed: regular hours at the cash wage, overtime hours at
    // cash wage + 0.5 x minimum wage.
    var otCash = cash + premiumFactor() * min;
    var cashOwed = cents(cash * h.regular + otCash * h.overtime);
    lines.push({ key: 'math.tipCash', vars: { reg: h.regular, cash: cash, ot: h.overtime, otCash: otCash, amount: cashOwed } });

    // (b) Full minimum wage for the week, overtime at 1.5 x minimum wage.
    var otMin = v('overtimeMultiplier') * min;
    var fullMin = cents(min * h.regular + otMin * h.overtime);
    lines.push({ key: 'math.tipFullMin', vars: { reg: h.regular, min: min, ot: h.overtime, otMin: otMin, amount: fullMin } });
    var fromTips = cents(Math.max(0, fullMin - tips));
    lines.push({ key: 'math.tipMinusTips', vars: { fullMin: fullMin, tips: tips, amount: fromTips } });

    var required = Math.max(cashOwed, fromTips);
    lines.push({ key: 'math.tipLarger', vars: { amount: required } });
    return required;
  }

  // Salaried non-exempt (PENNSYLVANIA rule): regular rate = salary / 40 no
  // matter how many hours were worked; overtime at 1.5 x that rate is owed on
  // top of the salary. Minimum wage still applies to the regular hours.
  function salaryWeek(salary, hours, lines) {
    var min = v('minimumWage');
    var h = splitHours(hours);
    var divisor = v('salariedDivisorHours');
    var rawRate = salary / divisor;
    var regularRate = Math.max(rawRate, min);
    lines.push({ key: 'math.salRate', vars: { salary: salary, divisor: divisor, rate: rawRate } });
    if (rawRate < min) {
      lines.push({ key: 'math.rateRaised', vars: { rate: rawRate, min: min } });
    }
    var minForRegular = cents(min * h.regular);
    var straight = Math.max(salary, minForRegular);
    if (minForRegular > salary) {
      lines.push({ key: 'math.salMinWins', vars: { hours: h.regular, amount: minForRegular } });
    } else {
      lines.push({ key: 'math.salBase', vars: { amount: salary } });
    }
    var ot = 0;
    if (h.overtime > 0) {
      ot = cents(h.overtime * v('overtimeMultiplier') * regularRate);
      lines.push({ key: 'math.salOt', vars: { ot: h.overtime, mult: v('overtimeMultiplier'), rate: regularRate, amount: ot } });
    }
    return cents(straight + ot);
  }

  // Day-rate / flat-sum and piece-rate (FEDERAL method; PA treatment to verify):
  // regular rate = week's pay / ALL hours worked; overtime adds 0.5 x that
  // rate for each hour over 40. Minimum wage still applies.
  function flatWeek(paid, hours, lines) {
    var min = v('minimumWage');
    var h = splitHours(hours);
    var rawRate = paid / hours;
    var regularRate = Math.max(rawRate, min);
    lines.push({ key: 'math.flatRate', vars: { paid: paid, hours: hours, rate: rawRate } });
    var straight = paid;
    if (rawRate < min) {
      lines.push({ key: 'math.rateRaised', vars: { rate: rawRate, min: min } });
      straight = cents(min * hours);
      lines.push({ key: 'math.straight', vars: { hours: hours, rate: min, amount: straight } });
    }
    var premium = 0;
    if (h.overtime > 0) {
      premium = cents(h.overtime * premiumFactor() * regularRate);
      lines.push({ key: 'math.otPremium', vars: { ot: h.overtime, factor: premiumFactor(), rate: regularRate, amount: premium } });
    }
    return cents(straight + premium);
  }

  // Average monthly tips from the weeks entered.
  function monthlyTips(weeks) {
    if (weeks.length === 0) return 0;
    var total = weeks.reduce(function (sum, w) { return sum + (w.tips || 0); }, 0);
    return (total / weeks.length) * v('weeksPerMonth');
  }

  // ------------------------------------------------------- Full calculation

  /*
   * input = {
   *   state: 'PA' | 'other',
   *   workType: 'restaurant' | ... | 'farm' | 'household' | 'other',
   *   contractor: 'yes' | 'no',
   *   payType: 'hourly' | 'tipped' | 'salary' | 'flat',
   *   flatKind: 'day' | 'piece'    (flat only),
   *   rate: number                 (hourly rate, or cash wage for tipped),
   *   salary: number               (weekly salary),
   *   weeks: [{ hours, paid, tips }]
   * }
   * Returns { status, reason?, weeks, total, notes }
   *   status: 'notPA' | 'cantTell' | 'underpaid' | 'looksRight'
   */
  function calculate(input) {
    var early = checkStep1(input) || checkStep2(input);
    if (early) return early;

    var tolerance = v('roundingTolerance');
    var notes = [];
    var tipped = input.payType === 'tipped';
    var monthly = tipped ? monthlyTips(input.weeks) : 0;
    var isTippedEmployee = monthly >= v('tippedMonthlyThreshold');

    if (tipped) {
      var tipTotal = cents(input.weeks.reduce(function (s, w) { return s + (w.tips || 0); }, 0));
      notes.push({ key: 'note.tipsBased', vars: { tips: tipTotal } });
      if (input.weeks.some(function (w) { return !w.tips; })) {
        notes.push({ key: 'note.addTips', vars: {} });
      }
      // Only worth saying when some tips were reported; with $0 the note above covers it.
      if (!isTippedEmployee && monthly > 0 && input.rate < v('minimumWage')) {
        notes.push({ key: 'note.notTippedEmployee', vars: { monthly: cents(monthly), threshold: v('tippedMonthlyThreshold') } });
      }
    }

    var total = 0;
    var weeks = input.weeks.map(function (week, i) {
      var lines = [];
      var tips = week.tips || 0;
      var required;
      if (input.payType === 'hourly') required = hourlyWeek(input.rate, week.hours, lines);
      else if (tipped) required = tippedWeek(input.rate, week.hours, tips, isTippedEmployee, lines);
      else if (input.payType === 'salary') required = salaryWeek(input.salary, week.hours, lines);
      else required = flatWeek(week.paid, week.hours, lines);

      // Shortfall = least owed - wages actually paid, never below zero.
      // Tips are never counted as wages paid here.
      var gap = cents(required - week.paid);
      var rounding = gap > 0 && gap < tolerance;
      var shortfall = gap >= tolerance ? gap : 0;
      lines.push({ key: 'math.required', vars: { amount: required } });
      lines.push({ key: tipped ? 'math.paidCash' : 'math.paid', vars: { amount: week.paid } });
      if (shortfall > 0) lines.push({ key: 'math.short', vars: { amount: shortfall } });
      else if (rounding) lines.push({ key: 'math.rounding', vars: { amount: gap } });
      else lines.push({ key: 'math.noShort', vars: {} });

      total = cents(total + shortfall);
      return {
        index: i,
        hours: week.hours,
        paid: week.paid,
        tips: tips,
        required: required,
        shortfall: shortfall,
        rounding: rounding,
        highHours: week.hours >= v('highWeeklyHours'),
        lines: lines
      };
    });

    return {
      status: total > 0 ? 'underpaid' : 'looksRight',
      weeks: weeks,
      total: total,
      notes: notes,
      isTippedEmployee: tipped ? isTippedEmployee : null
    };
  }

  var Calculator = {
    cents: cents,
    splitHours: splitHours,
    toNumber: toNumber,
    validateAmount: validateAmount,
    validateWeek: validateWeek,
    checkStep1: checkStep1,
    checkStep2: checkStep2,
    monthlyTips: monthlyTips,
    calculate: calculate
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Calculator;
  } else {
    root.Calculator = Calculator;
  }
})(typeof window !== 'undefined' ? window : globalThis);
