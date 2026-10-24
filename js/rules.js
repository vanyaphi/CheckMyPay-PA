/*
 * rules.js
 * Every legal number and calculation constant the site uses lives here, and
 * nowhere else. Each entry has:
 *   value         the number itself
 *   source        where it comes from (also written as a comment above it)
 *   verifiedDate  the date a person last checked it against the source
 *                 (null means NOT verified yet)
 *   verify        present only when something still needs checking
 *
 * Works in the browser (window.RULES) and in Node (require('./rules.js')).
 */
(function (root) {
  'use strict';

  // The date the verified items below were last checked against their sources.
  // Change this when you re-check them.
  var CHECKED = '2026-10-21';

  var RULES = {
    // ---------------------------------------------------------------- Wages

    // Federal minimum wage. Source: Fair Labor Standards Act, 29 U.S.C. § 206;
    // https://www.dol.gov/agencies/whd/minimum-wage
    federalMinimumWage: {
      value: 7.25,
      source: 'https://www.dol.gov/agencies/whd/minimum-wage',
      verifiedDate: CHECKED
    },

    // Pennsylvania minimum wage. Source: PA Minimum Wage Act of 1968;
    // https://www.pa.gov/agencies/dli/programs-services/labor-management-relations/labor-law-compliance/minimum-wage
    // Bills to raise it have not become law.
    paMinimumWage: {
      value: 7.25,
      source: 'https://www.pa.gov/agencies/dli/programs-services/labor-management-relations/labor-law-compliance/minimum-wage',
      verifiedDate: CHECKED
    },

    // ------------------------------------------------------- Tipped workers
    // Source for all tipped entries: PA L&I, "Overtime and Tipped Worker Rules in PA";
    // https://www.pa.gov/agencies/dli/resources/compliance-laws-and-regulations/labor-management-relations/labor-law/overtime-and-tipped-worker-rules-in-pa

    // Lowest cash wage a PA employer may pay a tipped employee.
    tippedCashWage: {
      value: 2.83,
      source: 'https://www.pa.gov/agencies/dli/resources/compliance-laws-and-regulations/labor-management-relations/labor-law/overtime-and-tipped-worker-rules-in-pa',
      verifiedDate: CHECKED
    },

    // Largest tip credit an employer may take ($7.25 - $2.83).
    maxTipCredit: {
      value: 4.42,
      source: 'https://www.pa.gov/agencies/dli/resources/compliance-laws-and-regulations/labor-management-relations/labor-law/overtime-and-tipped-worker-rules-in-pa',
      verifiedDate: CHECKED
    },

    // A "tipped employee" receives at least this much in tips per month.
    // Below this, the worker is owed the full minimum wage in cash.
    tippedMonthlyThreshold: {
      value: 135,
      source: 'https://www.pa.gov/agencies/dli/resources/compliance-laws-and-regulations/labor-management-relations/labor-law/overtime-and-tipped-worker-rules-in-pa',
      verifiedDate: CHECKED
    },

    // Calculation constant: weeks in an average month (52 weeks / 12 months),
    // used to turn weekly tips into a monthly average for the threshold above.
    weeksPerMonth: {
      value: 52 / 12,
      source: 'Arithmetic: 52 weeks divided by 12 months.',
      verifiedDate: CHECKED
    },

    // -------------------------------------------------------------- Overtime

    // Overtime is owed for hours over 40 in a fixed 7-day workweek.
    // Source: 29 U.S.C. § 207; PA Minimum Wage Act; PA L&I overtime page above.
    overtimeThresholdHours: {
      value: 40,
      source: 'https://www.dol.gov/agencies/whd/overtime',
      verifiedDate: CHECKED
    },

    // Overtime hours are paid at 1.5 times the regular rate. The "premium"
    // on top of straight time is therefore 1.5 - 1 = 0.5.
    overtimeMultiplier: {
      value: 1.5,
      source: 'https://www.dol.gov/agencies/whd/overtime',
      verifiedDate: CHECKED
    },

    // Days in a workweek. Each workweek is counted on its own; no averaging.
    workweekDays: {
      value: 7,
      source: 'https://www.dol.gov/agencies/whd/overtime',
      verifiedDate: CHECKED
    },

    // ------------------------------------------- Salaried non-exempt workers

    // PENNSYLVANIA-SPECIFIC: a salaried non-exempt worker's regular rate is
    // weekly salary / 40, no matter how many hours were worked, and overtime
    // (1.5x that rate) is owed on top of the salary.
    // Source: PA Minimum Wage Act regulations effective Aug. 5, 2022,
    // 34 Pa. Code § 231.43. VERIFY: exact subsection letter not yet confirmed.
    salariedDivisorHours: {
      value: 40,
      source: '34 Pa. Code § 231.43 (regulations effective Aug. 5, 2022)',
      verifiedDate: CHECKED,
      verify: 'Confirm the exact subsection of 34 Pa. Code § 231.43.'
    },

    // The site does NOT decide exempt status. Under this weekly salary a
    // worker is likely non-exempt; at or above it, the answer depends on job
    // duties. Federal level, restored by U.S. DOL in May 2026.
    exemptSalaryWeekly: {
      value: 684,
      source: 'https://www.dol.gov/agencies/whd/overtime',
      verifiedDate: CHECKED
    },

    // ------------------------------------------ Day-rate and piece-rate pay

    // Day-rate / flat-sum and piece-rate pay use the standard FEDERAL method:
    // regular rate = week's pay / total hours worked, and overtime adds
    // 0.5 x regular rate for each hour over 40.
    // Source: 29 C.F.R. § 778.111 (piece rate) and § 778.112 (day rate).
    // VERIFY: how Pennsylvania's regulations treat these is not yet confirmed.
    dayRateMethod: {
      value: 'federal-hours-worked',
      source: '29 C.F.R. § 778.112',
      verifiedDate: null,
      verify: 'Verify Pennsylvania treatment of day-rate / flat-sum pay.'
    },
    pieceRateMethod: {
      value: 'federal-hours-worked',
      source: '29 C.F.R. § 778.111',
      verifiedDate: null,
      verify: 'Verify Pennsylvania treatment of piece-rate pay.'
    },

    // ------------------------------------------------------------ Deadlines

    // Federal wage claims: 2 years, or 3 if the violation was willful.
    // Source: 29 U.S.C. § 255; https://www.law.cornell.edu/uscode/text/29/255
    federalDeadlineYears: {
      value: 2,
      source: 'https://www.law.cornell.edu/uscode/text/29/255',
      verifiedDate: CHECKED
    },
    federalDeadlineWillfulYears: {
      value: 3,
      source: 'https://www.law.cornell.edu/uscode/text/29/255',
      verifiedDate: CHECKED
    },

    // NOT USED ON THE SITE. Kept here so it is not forgotten.
    // VERIFY: the PA Minimum Wage Act statute of limitations.
    paDeadlineYears: {
      value: null,
      source: 'PA Minimum Wage Act (not yet researched)',
      verifiedDate: null,
      verify: 'Verify the PA Minimum Wage Act statute of limitations.'
    },

    // ------------------------------------------- Tool settings (not law)

    // Weekly differences under this many dollars count as rounding.
    roundingTolerance: {
      value: 0.5,
      source: 'Tool setting chosen by the author.',
      verifiedDate: CHECKED
    },
    // Hours in a week (7 x 24). More than this is impossible.
    maxWeeklyHours: {
      value: 168,
      source: 'Arithmetic: 7 days x 24 hours.',
      verifiedDate: CHECKED
    },
    // At or above this many weekly hours, ask "Is this right?" (still calculate).
    highWeeklyHours: {
      value: 100,
      source: 'Tool setting chosen by the author.',
      verifiedDate: CHECKED
    },
    // Shifts longer than this many hours get a "double-check this" note.
    longShiftHours: {
      value: 16,
      source: 'Tool setting chosen by the author.',
      verifiedDate: CHECKED
    },
    // Most weeks a person can enter.
    maxWeeks: {
      value: 8,
      source: 'Tool setting chosen by the author.',
      verifiedDate: CHECKED
    }
  };

  // The minimum wage that applies is the higher of federal and Pennsylvania.
  RULES.minimumWage = {
    value: Math.max(RULES.federalMinimumWage.value, RULES.paMinimumWage.value),
    source: 'Higher of federalMinimumWage and paMinimumWage.',
    verifiedDate: CHECKED
  };

  // Shortcut: RULES.v('minimumWage') returns 7.25.
  RULES.v = function (name) {
    return RULES[name].value;
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = RULES;
  } else {
    root.RULES = RULES;
  }
})(typeof window !== 'undefined' ? window : globalThis);
