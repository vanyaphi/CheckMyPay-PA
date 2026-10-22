/*
 * check.js
 * Runs the Check my pay page: the three steps, the live shift math, the
 * result, and the printable summary.
 *
 * Everything the worker types lives in the `state` object below, in memory
 * only. Nothing is saved or sent. Closing the page erases it.
 *
 * The math itself is in calculator.js and shifts.js. This file only reads
 * the form, calls them, and shows what they return.
 */
(function () {
  'use strict';

  var L = window.Layout;
  var C = window.Calculator;
  var S = window.Shifts;
  var t = L.t;
  var esc = L.esc;
  var MAX_WEEKS = window.RULES.v('maxWeeks');

  // ------------------------------------------------------------- State

  var nextId = 1;
  function blankWeek() {
    return { id: nextId++, hours: '', paid: '', tips: '' };
  }
  function newShift(d) {
    d = d || {};
    return {
      id: nextId++,
      date: d.date || '',
      start: d.start || '',
      end: d.end || '',
      breakMinutes: d.breakMinutes === null || d.breakMinutes === undefined ? '' : String(d.breakMinutes)
    };
  }

  var state;
  function resetState() {
    state = {
      step: 1,
      mode: 'weekly',
      weeks: [blankWeek()],
      shifts: [newShift()],
      shiftPay: {},          // { weekStart: { paid, tips } }
      weekStartDay: 1,       // Monday
      tried: { 1: false, 2: false, 3: false }, // show "required" errors only after a try
      shiftWeekKeys: null,   // which workweeks are currently on screen
      result: null,          // what calculator.js returned
      resultFrom: 3,         // the step that produced the result
      resultLabels: [],      // a label for each week in the result
      resultShifts: []       // the shifts used, for the printed summary
    };
  }
  resetState();

  // ------------------------------------------------------ Small helpers

  var form = document.getElementById('calc-form');
  function byId(id) { return document.getElementById(id); }

  // Value of the checked radio button in a group, or null.
  function radio(name) {
    var el = form.querySelector('input[name="' + name + '"]:checked');
    return el ? el.value : null;
  }

  function job() {
    return { state: radio('state'), workType: radio('workType'), contractor: radio('contractor') };
  }

  function pay() {
    return {
      payType: radio('payType'),
      rate: C.toNumber(byId('rate').value),
      salary: C.toNumber(byId('salary').value),
      flatKind: radio('flatKind')
    };
  }

  // Show or clear an error under one input.
  function setFieldError(inputId, key, vars) {
    var input = byId(inputId);
    var err = byId(inputId + '-err');
    if (!input || !err) return;
    err.textContent = key ? t(key, vars) : '';
    input.setAttribute('aria-invalid', key ? 'true' : 'false');
    var field = input.closest('.field');
    if (field) field.classList.toggle('has-error', !!key);
  }

  // Show or clear an error for a group of radio buttons.
  function setGroupError(name, key) {
    var err = byId('err-' + name);
    var set = byId('fs-' + name);
    if (err) err.textContent = key ? t(key) : '';
    if (set) {
      set.classList.toggle('has-error', !!key);
      set.setAttribute('aria-invalid', key ? 'true' : 'false');
      if (err) set.setAttribute('aria-describedby', 'err-' + name);
    }
  }

  function setNote(id, text) {
    var el = byId(id);
    if (!el) return;
    el.textContent = text || '';
    el.hidden = !text;
  }

  function showSummaryError(show) {
    var box = byId('error-summary');
    box.textContent = show ? t('err.summary') : '';
    box.hidden = !show;
  }

  // Move keyboard focus to the first field with a problem.
  function focusFirstError() {
    var bad = form.querySelector('[aria-invalid="true"]');
    if (!bad) return;
    if (bad.tagName === 'FIELDSET') bad = bad.querySelector('input');
    bad.focus();
  }

  // Number formatting for the math lines.
  var RATE_VARS = ['rate', 'min', 'cash', 'otCash', 'otMin'];
  var MONEY_VARS = ['amount', 'fullMin', 'tips', 'salary', 'paid', 'monthly', 'threshold'];
  var HOUR_VARS = ['hours', 'reg', 'ot', 'factor', 'mult', 'divisor'];

  // Rates can need a third decimal (for example $2.83 + $3.625 = $6.455).
  function rate(n) {
    var hasThird = Math.round(n * 1000) % 10 !== 0;
    return new Intl.NumberFormat(L.lang() === 'es' ? 'es-US' : 'en-US', {
      style: 'currency', currency: 'USD',
      minimumFractionDigits: 2, maximumFractionDigits: hasThird ? 3 : 2
    }).format(n);
  }

  function formatVars(vars) {
    var out = {};
    Object.keys(vars).forEach(function (k) {
      var v = vars[k];
      if (RATE_VARS.indexOf(k) !== -1) out[k] = rate(v);
      else if (MONEY_VARS.indexOf(k) !== -1) out[k] = L.money(v);
      else if (HOUR_VARS.indexOf(k) !== -1) out[k] = L.number(v);
      else out[k] = v;
    });
    return out;
  }

  function line(item) {
    return t(item.key, formatVars(item.vars));
  }

  function todayIso() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function telLink(phone) {
    return 'tel:+1' + phone.replace(/\D/g, '').replace(/^1/, '');
  }

  // --------------------------------------------------------- Step views

  function goTo(step) {
    state.step = step;
    showSummaryError(false);
    [1, 2, 3].forEach(function (n) {
      byId('step-' + n).hidden = n !== step;
    });
    form.hidden = false;
    byId('result').hidden = true;
    byId('summary').hidden = true;
    if (step === 3) enterStep3();
    updateStepper();
    var title = byId('step-' + step).querySelector('.step-title');
    title.focus({ preventScroll: true });
    scrollToTop();
  }

  function scrollToTop() {
    var top = byId('stepper').getBoundingClientRect().top + window.scrollY - 16;
    if (window.scrollY > top) window.scrollTo({ top: top });
  }

  function updateStepper() {
    var showing = byId('result').hidden && byId('summary').hidden ? state.step : 4;
    document.querySelectorAll('#stepper li').forEach(function (li) {
      var n = +li.getAttribute('data-step');
      li.classList.toggle('is-current', n === showing);
      li.classList.toggle('is-done', n < showing);
      if (n === showing) li.setAttribute('aria-current', 'step');
      else li.removeAttribute('aria-current');
    });
    byId('step-count').textContent = showing <= 3 ? t('step.of', { n: showing }) : '';
    byId('step-count').hidden = showing > 3;
  }

  // ------------------------------------------------------------ Step 1

  function validateStep1() {
    var j = job();
    var errors = {};
    if (!j.state) errors.state = 'err.choose';
    if (j.state === 'PA') {
      if (!j.workType) errors.workType = 'err.choose';
      if (!j.contractor) errors.contractor = 'err.choose';
    }
    var show = state.tried[1];
    ['state', 'workType', 'contractor'].forEach(function (name) {
      setGroupError(name, show ? errors[name] : null);
    });
    return Object.keys(errors).length === 0;
  }

  function nextFromStep1() {
    state.tried[1] = true;
    if (!validateStep1()) {
      showSummaryError(true);
      focusFirstError();
      return;
    }
    var early = C.checkStep1(job());
    if (early) return showResult(early, 1);
    goTo(2);
  }

  // Hide the Pennsylvania-only questions when another state is picked.
  function updateStep1() {
    byId('pa-questions').hidden = radio('state') === 'other';
    if (state.tried[1]) validateStep1();
  }

  // ------------------------------------------------------------ Step 2

  function updateStep2() {
    var p = radio('payType');
    byId('field-rate').hidden = !(p === 'hourly' || p === 'tipped');
    byId('field-salary').hidden = p !== 'salary';
    byId('fs-flatKind').hidden = p !== 'flat';
    byId('rate-label').textContent = t(p === 'tipped' ? 's2.rate.tipped' : 's2.rate.hourly');
    var hint = byId('rate-hint');
    hint.hidden = p !== 'tipped';
    hint.textContent = t('s2.rate.tippedHint');
    if (state.tried[2]) validateStep2();
  }

  function validateStep2() {
    var p = pay();
    var show = state.tried[2];
    var ok = true;
    setGroupError('payType', show && !p.payType ? 'err.choose' : null);
    if (!p.payType) ok = false;

    var rateErr = (p.payType === 'hourly' || p.payType === 'tipped') ? C.validateAmount(p.rate) : null;
    var salaryErr = p.payType === 'salary' ? C.validateAmount(p.salary) : null;
    var flatErr = p.payType === 'flat' && !p.flatKind ? 'err.choose' : null;
    if (Number.isNaN(p.rate) && rateErr) rateErr = 'err.number';
    if (Number.isNaN(p.salary) && salaryErr) salaryErr = 'err.number';

    setFieldError('rate', show ? rateErr : null);
    setFieldError('salary', show ? salaryErr : null);
    setGroupError('flatKind', show ? flatErr : null);
    return ok && !rateErr && !salaryErr && !flatErr;
  }

  function nextFromStep2() {
    state.tried[2] = true;
    if (!validateStep2()) {
      showSummaryError(true);
      focusFirstError();
      return;
    }
    var early = C.checkStep2(pay());
    if (early) return showResult(early, 2);
    goTo(3);
  }

  // ------------------------------------------------------------ Step 3

  function enterStep3() {
    var p = pay();
    // A salaried worker was most likely paid their salary, so start with that.
    if (p.payType === 'salary') {
      state.weeks.forEach(function (w) { if (w.paid === '') w.paid = byId('salary').value; });
    }
    setMode(state.mode);
  }

  function setMode(mode) {
    state.mode = mode;
    byId('mode-' + mode).checked = true;
    byId('weekly-panel').hidden = mode !== 'weekly';
    byId('shift-panel').hidden = mode !== 'shifts';
    showSummaryError(false);
    if (mode === 'weekly') renderWeeks();
    else renderShifts();
  }

  // ---- Weekly totals

  function moneyField(id, labelKey, value, hintKey) {
    var hint = hintKey ? '<p class="field-hint" id="' + id + '-hint">' + esc(t(hintKey)) + '</p>' : '';
    var described = (hintKey ? id + '-hint ' : '') + id + '-err';
    return '<div class="field">' +
      '<label for="' + id + '">' + esc(t(labelKey)) + '</label>' + hint +
      '<div class="money-input"><span aria-hidden="true">$</span>' +
      '<input id="' + id + '" type="text" inputmode="decimal" autocomplete="off" value="' + esc(value) + '" aria-describedby="' + described + '"></div>' +
      '<p class="field-error" id="' + id + '-err"></p>' +
    '</div>';
  }

  function renderWeeks() {
    var tipped = radio('payType') === 'tipped';
    var html = state.weeks.map(function (w, i) {
      var id = 'w' + w.id;
      var remove = state.weeks.length > 1
        ? '<button type="button" class="link-btn" data-remove-week="' + w.id + '" aria-label="' + esc(t('week.removeLabel', { n: i + 1 })) + '">' + esc(t('week.remove')) + '</button>'
        : '';
      return '<div class="entry-card" data-week-id="' + w.id + '">' +
        '<div class="entry-head"><h3 class="entry-title">' + esc(t('week.title', { n: i + 1 })) + '</h3>' + remove + '</div>' +
        '<div class="entry-grid' + (tipped ? ' entry-grid-3' : '') + '">' +
          '<div class="field">' +
            '<label for="' + id + '-hours">' + esc(t('week.hours')) + '</label>' +
            '<input id="' + id + '-hours" type="text" inputmode="decimal" autocomplete="off" value="' + esc(w.hours) + '" aria-describedby="' + id + '-hours-err ' + id + '-warn">' +
            '<p class="field-error" id="' + id + '-hours-err"></p>' +
          '</div>' +
          moneyField(id + '-paid', tipped ? 'week.paidCash' : 'week.paid', w.paid) +
          (tipped ? moneyField(id + '-tips', 'week.tips', w.tips, 'week.tipsHint') : '') +
        '</div>' +
        '<p class="field-warning" id="' + id + '-warn" hidden></p>' +
      '</div>';
    }).join('');
    byId('week-list').innerHTML = html;
    var full = state.weeks.length >= MAX_WEEKS;
    byId('add-week').hidden = full;
    setNote('week-max', full ? t('week.max') : '');
    checkWeeks();
  }

  function weekNumbers(w) {
    return { hours: C.toNumber(w.hours), paid: C.toNumber(w.paid), tips: C.toNumber(w.tips) };
  }

  // Validate weekly rows. Shows "required" errors only after a try.
  function checkWeeks() {
    var payType = radio('payType');
    var ok = true;
    state.weeks.forEach(function (w) {
      var nums = weekNumbers(w);
      var v = C.validateWeek(nums, payType);
      ['hours', 'paid', 'tips'].forEach(function (f) {
        var key = v.errors[f];
        if (Number.isNaN(nums[f]) && (f !== 'tips' || payType === 'tipped')) key = 'err.number';
        if (key) ok = false;
        setFieldError('w' + w.id + '-' + f, state.tried[3] || key === 'err.number' || key === 'err.negative' ? key : null);
      });
      setNote('w' + w.id + '-warn', v.warnings.length ? t(v.warnings[0]) : '');
    });
    return ok;
  }

  // ---- Shifts

  function rawShift(s) {
    return { date: s.date, start: s.start, end: s.end, breakMinutes: C.toNumber(s.breakMinutes) };
  }

  function renderShifts() {
    byId('week-start').value = String(state.weekStartDay);
    var html = state.shifts.map(function (s, i) {
      var id = 's' + s.id;
      function field(name, labelKey, type, extra) {
        return '<div class="field field-' + name + '">' +
          '<label for="' + id + '-' + name + '">' + esc(t(labelKey)) + '</label>' +
          '<input id="' + id + '-' + name + '" type="' + type + '" ' + (extra || '') + ' value="' + esc(s[name]) + '" aria-describedby="' + id + '-' + name + '-err">' +
          '<p class="field-error" id="' + id + '-' + name + '-err"></p>' +
        '</div>';
      }
      return '<div class="entry-card shift-card" data-shift-id="' + s.id + '">' +
        '<div class="entry-head"><h3 class="entry-title">' + esc(t('shift.title', { n: i + 1 })) + '</h3>' +
          '<button type="button" class="link-btn" data-remove-shift="' + s.id + '" aria-label="' + esc(t('shift.removeLabel', { n: i + 1 })) + '">' + esc(t('week.remove')) + '</button>' +
        '</div>' +
        '<div class="shift-grid">' +
          field('date', 'shift.date', 'date') +
          field('start', 'shift.start', 'time') +
          field('end', 'shift.end', 'time') +
          field('breakMinutes', 'shift.break', 'text', 'inputmode="numeric" autocomplete="off"') +
        '</div>' +
        '<p class="shift-live" id="' + id + '-live" aria-live="polite"></p>' +
        '<p class="field-warning" id="' + id + '-notes" hidden></p>' +
        '<p class="field-error field-error-block" id="' + id + '-shift-err" aria-live="polite"></p>' +
      '</div>';
    }).join('');
    byId('shift-list').innerHTML = html;
    state.shiftWeekKeys = null; // force the weeks list to rebuild
    updateShifts();
  }

  // Recheck every shift, update the live hours lines, and regroup the weeks.
  function updateShifts() {
    var built = S.validateShifts(state.shifts.map(rawShift));
    built.forEach(function (b, i) {
      var id = 's' + state.shifts[i].id;
      var hours = b.paidHours !== undefined ? b.paidHours : null;
      byId(id + '-live').textContent = hours !== null
        ? t('shift.live', { hours: L.number(hours) })
        : t('shift.liveEmpty');
      setNote(id + '-notes', b.warnings.map(function (k) { return t(k); }).join(' '));
      ['date', 'start', 'end', 'breakMinutes'].forEach(function (f) {
        var key = b.errors[f];
        var show = key && (key !== 'err.required' || state.tried[3]);
        setFieldError(id + '-' + f, show ? key : null);
      });
      var shiftErr = b.errors.shift ? t(b.errors.shift) : '';
      byId(id + '-shift-err').textContent = shiftErr;
      byId(id + '-shift-err').closest('.shift-card').classList.toggle('has-error', !!shiftErr);
    });
    var weeks = S.groupIntoWeeks(built, state.weekStartDay);
    renderShiftWeeks(weeks);
    return { built: built, weeks: weeks };
  }

  function weekLabel(w) {
    return t('shifts.range', { start: L.dateShort(w.start), end: L.dateShort(w.end) });
  }

  // The "Your workweeks" list, where pay for each week is entered.
  function renderShiftWeeks(weeks) {
    var keys = weeks.map(function (w) { return w.weekStart; }).join(',');
    var tipped = radio('payType') === 'tipped';
    byId('shift-weeks-hint').textContent = t(weeks.length ? 'shifts.weeksHint' : 'shifts.none');

    weeks.forEach(function (w) {
      if (!state.shiftPay[w.weekStart]) {
        state.shiftPay[w.weekStart] = { paid: radio('payType') === 'salary' ? byId('salary').value : '', tips: '' };
      }
    });

    if (keys !== state.shiftWeekKeys) {
      state.shiftWeekKeys = keys;
      byId('shift-week-list').innerHTML = weeks.map(function (w) {
        var id = 'sw' + w.weekStart;
        var p = state.shiftPay[w.weekStart];
        return '<div class="entry-card week-pay" data-week-start="' + w.weekStart + '">' +
          '<div class="entry-head"><h4 class="entry-title">' + esc(weekLabel(w)) + '</h4>' +
            '<p class="week-hours" id="' + id + '-hours"></p></div>' +
          '<div class="entry-grid' + (tipped ? '' : ' entry-grid-1') + '">' +
            moneyField(id + '-paid', tipped ? 'week.paidCash' : 'week.paid', p.paid) +
            (tipped ? moneyField(id + '-tips', 'week.tips', p.tips, 'week.tipsHint') : '') +
          '</div>' +
          '<p class="field-warning" id="' + id + '-warn" hidden></p>' +
        '</div>';
      }).join('');
    }

    // Hours can change without the list of weeks changing.
    weeks.forEach(function (w) {
      var id = 'sw' + w.weekStart;
      byId(id + '-hours').textContent = t('shifts.weekHours', { hours: L.number(w.hours) });
      var v = C.validateWeek({ hours: w.hours, paid: 1 }, 'hourly');
      setNote(id + '-warn', v.warnings.length ? t(v.warnings[0]) : '');
    });
    var tooMany = weeks.length > MAX_WEEKS;
    byId('err-shifts').textContent = tooMany ? t('err.tooManyWeeks') : '';
  }

  function addShift() {
    var last = state.shifts[state.shifts.length - 1];
    state.shifts.push(newShift(S.nextShiftDefaults(last ? rawShift(last) : null)));
    renderShifts();
    var card = byId('shift-list').lastElementChild;
    if (card) card.querySelector('input').focus();
  }

  // ---- Collect step 3 and calculate

  function collectWeekly() {
    var ok = checkWeeks();
    var weeks = state.weeks.map(function (w) {
      var n = weekNumbers(w);
      return { hours: n.hours, paid: n.paid, tips: n.tips || 0 };
    });
    var labels = state.weeks.map(function (w, i) { return t('week.title', { n: i + 1 }); });
    return { ok: ok, weeks: weeks, labels: labels, shifts: [] };
  }

  function collectShifts() {
    var payType = radio('payType');
    var out = updateShifts();
    var ok = true;
    if (state.shifts.length === 0) {
      byId('err-shifts').textContent = t('err.noShifts');
      ok = false;
    }
    if (out.built.some(function (b) { return !b.valid; })) ok = false;
    if (out.weeks.length > MAX_WEEKS) ok = false;

    var weeks = out.weeks.map(function (w) {
      var p = state.shiftPay[w.weekStart];
      var nums = { hours: w.hours, paid: C.toNumber(p.paid), tips: C.toNumber(p.tips) };
      var v = C.validateWeek(nums, payType);
      var id = 'sw' + w.weekStart;
      ['paid', 'tips'].forEach(function (f) {
        var key = v.errors[f];
        if (Number.isNaN(nums[f])) key = 'err.number';
        if (key) ok = false;
        setFieldError(id + '-' + f, key);
      });
      return { hours: nums.hours, paid: nums.paid, tips: nums.tips || 0 };
    });
    var labels = out.weeks.map(weekLabel);
    var shifts = out.built.filter(function (b) { return b.valid; });
    return { ok: ok, weeks: weeks, labels: labels, shifts: shifts };
  }

  function calculate() {
    state.tried[3] = true;
    var data = state.mode === 'weekly' ? collectWeekly() : collectShifts();
    if (!data.ok) {
      showSummaryError(true);
      focusFirstError();
      return;
    }
    var input = Object.assign({}, job(), pay(), { weeks: data.weeks });
    state.resultLabels = data.labels;
    state.resultShifts = data.shifts;
    showResult(C.calculate(input), 3);
  }

  // ------------------------------------------------------------- Results

  function showResult(result, fromStep) {
    state.result = result;
    state.resultFrom = fromStep;
    if (fromStep < 3) {
      state.resultLabels = [];
      state.resultShifts = [];
    }
    form.hidden = true;
    byId('summary').hidden = true;
    renderResult();
    byId('result').hidden = false;
    updateStepper();
    byId('result-h').focus({ preventScroll: true });
    scrollToTop();
  }

  function weekTable(r) {
    var tipped = radio('payType') === 'tipped';
    var rows = r.weeks.map(function (w, i) {
      var label = state.resultLabels[i];
      return '<tr>' +
        '<th scope="row" data-label="' + esc(t('th.week')) + '">' + esc(label) + '</th>' +
        '<td data-label="' + esc(t('th.hours')) + '">' + L.number(w.hours) + '</td>' +
        (tipped ? '<td data-label="' + esc(t('th.tips')) + '">' + L.money(w.tips) + '</td>' : '') +
        '<td data-label="' + esc(t('th.should')) + '">' + L.money(w.required) + '</td>' +
        '<td data-label="' + esc(t('th.paid')) + '">' + L.money(w.paid) + '</td>' +
        '<td data-label="' + esc(t('th.short')) + '" class="' + (w.shortfall > 0 ? 'is-short' : '') + '">' + L.money(w.shortfall) + '</td>' +
      '</tr>';
    }).join('');
    var span = tipped ? 5 : 4;
    return '<div class="table-wrap"><table class="week-table">' +
      '<thead><tr><th scope="col">' + esc(t('th.week')) + '</th><th scope="col">' + esc(t('th.hours')) + '</th>' +
        (tipped ? '<th scope="col">' + esc(t('th.tips')) + '</th>' : '') +
        '<th scope="col">' + esc(t('th.should')) + '</th><th scope="col">' + esc(t('th.paid')) + '</th><th scope="col">' + esc(t('th.short')) + '</th></tr></thead>' +
      '<tbody>' + rows + '</tbody>' +
      '<tfoot><tr><th scope="row" colspan="' + span + '">' + esc(t('th.total')) + '</th><td data-label="' + esc(t('th.short')) + '">' + L.money(r.total) + '</td></tr></tfoot>' +
    '</table></div>';
  }

  function mathBlocks(r) {
    return r.weeks.map(function (w, i) {
      var items = w.lines.map(function (l) { return '<li>' + esc(line(l)) + '</li>'; }).join('');
      // With only a week or two, show the math right away.
      var open = r.weeks.length <= 2 ? ' open' : '';
      return '<details class="math"' + open + '><summary>' + esc(t('res.math', { week: state.resultLabels[i] })) + '</summary><ol>' + items + '</ol></details>';
    }).join('');
  }

  function notesHtml(r) {
    var notes = (r.notes || []).map(function (n) { return t(n.key, formatVars(n.vars)); });
    r.weeks.forEach(function (w, i) {
      if (w.highHours) notes.push(t('note.highHours', { week: state.resultLabels[i] }));
    });
    if (!notes.length) return '';
    return '<ul class="result-notes">' + notes.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul>';
  }

  function actionsHtml(withSummary) {
    return '<div class="result-actions">' +
      (withSummary ? '<button type="button" class="btn btn-gold btn-lg" data-result-action="summary">' + esc(t('res.summaryBtn')) + '</button>' : '') +
      '<button type="button" class="btn btn-ghost btn-lg" data-result-action="edit">' + esc(t('btn.edit')) + '</button>' +
      '<button type="button" class="link-btn" data-result-action="restart">' + esc(t('btn.startOver')) + '</button>' +
    '</div>';
  }

  function ext(url, key) {
    return '<a href="' + url + '" target="_blank" rel="noopener">' + esc(t(key)) + '</a>';
  }

  function helplineButton() {
    var phone = window.RESOURCES.helpline;
    return '<a class="btn btn-dark btn-lg phone-btn" href="' + telLink(phone) + '"><span aria-hidden="true">☎</span> ' + esc(phone) + '</a>';
  }

  function renderResult() {
    var r = state.result;
    var html = '';
    if (r.status === 'underpaid') {
      html =
        '<div class="result-banner result-banner-gold">' +
          '<p class="result-eyebrow"><span class="result-icon" aria-hidden="true">!</span>' + esc(t('res.under.eyebrow')) + '</p>' +
          '<h2 class="result-title" id="result-h" tabindex="-1">' + esc(t('res.under.h')) + '</h2>' +
          '<p class="result-amount">' + L.money(r.total) + '</p>' +
          '<p class="result-sub">' + esc(t('res.under.sub')) + '</p>' +
        '</div>' +
        '<div class="result-body">' +
          notesHtml(r) +
          '<h3 class="sub-title">' + esc(t('res.weeks.h')) + '</h3>' +
          weekTable(r) + mathBlocks(r) +
          '<h3 class="sub-title">' + esc(t('res.next.h')) + '</h3>' +
          '<ol class="next-steps">' +
            '<li><h4>' + esc(t('next.records.t')) + '</h4><p>' + esc(t('next.records.b')) + '</p></li>' +
            '<li><h4>' + esc(t('next.wait.t')) + '</h4><p>' + esc(t('next.wait.b')) + '</p></li>' +
            '<li><h4>' + esc(t('next.file.t')) + '</h4><p>' + esc(t('next.file.b')) + '</p>' + helplineButton() + '</li>' +
            // TODO: replace with the U.S. Department of Labor's exact wording on retaliation.
            '<li><h4>' + esc(t('next.retal.t')) + '</h4><p>' + esc(t('next.retal.b')) + '</p><p>' + ext('https://www.dol.gov/agencies/whd/retaliation', 'next.retal.link') + '</p></li>' +
            '<li><h4>' + esc(t('next.help.t')) + '</h4><p>' + esc(t('next.help.b')) + '</p><p><a href="' + L.href('help.html') + '">' + esc(t('next.help.link')) + '</a></p></li>' +
          '</ol>' +
          actionsHtml(true) +
          '<p class="result-disclaimer">' + esc(t('res.disclaimer')) + '</p>' +
        '</div>';
    } else if (r.status === 'looksRight') {
      html =
        '<div class="result-banner result-banner-calm">' +
          '<p class="result-eyebrow"><span class="result-icon result-icon-ok" aria-hidden="true">✓</span>' + esc(t('res.ok.eyebrow')) + '</p>' +
          '<h2 class="result-title" id="result-h" tabindex="-1">' + esc(t('res.ok.h')) + '</h2>' +
          '<p class="result-sub">' + esc(t('res.ok.body')) + '</p>' +
        '</div>' +
        '<div class="result-body">' +
          notesHtml(r) +
          '<h3 class="sub-title">' + esc(t('res.ok.vigil.h')) + '</h3>' +
          '<ul class="plain-list"><li>' + esc(t('vigil.1')) + '</li><li>' + esc(t('vigil.2')) + '</li></ul>' +
          '<h3 class="sub-title">' + esc(t('res.weeks.h')) + '</h3>' +
          weekTable(r) + mathBlocks(r) +
          actionsHtml(false) +
          '<p class="result-disclaimer">' + esc(t('res.disclaimer')) + '</p>' +
        '</div>';
    } else if (r.status === 'cantTell') {
      var exempt = r.reason === 'exempt'
        ? '<p>' + ext('https://www.dol.gov/agencies/whd', 'cant.exempt.link') + '</p>'
        : '';
      html =
        '<div class="result-banner result-banner-ink">' +
          '<p class="result-eyebrow"><span class="result-icon" aria-hidden="true">?</span>' + esc(t('res.cant.eyebrow')) + '</p>' +
          '<h2 class="result-title" id="result-h" tabindex="-1">' + esc(t('res.cant.h')) + '</h2>' +
          '<p class="result-sub">' + esc(t('cant.' + r.reason)) + '</p>' +
        '</div>' +
        '<div class="result-body">' +
          exempt +
          '<h3 class="sub-title">' + esc(t('cant.next.h')) + '</h3>' +
          '<ol class="next-steps">' +
            '<li><p>' + esc(t('cant.next.call')) + '</p>' + helplineButton() + '</li>' +
            '<li><p>' + esc(t('cant.next.records')) + '</p></li>' +
            '<li><p>' + esc(t('cant.next.help')) + '</p><p><a href="' + L.href('help.html') + '">' + esc(t('next.help.link')) + '</a></p></li>' +
          '</ol>' +
          actionsHtml(true) +
        '</div>';
    } else {
      html =
        '<div class="result-banner result-banner-ink">' +
          '<p class="result-eyebrow">' + esc(t('res.notpa.eyebrow')) + '</p>' +
          '<h2 class="result-title" id="result-h" tabindex="-1">' + esc(t('res.notpa.h')) + '</h2>' +
          '<p class="result-sub">' + esc(t('res.notpa.body')) + '</p>' +
        '</div>' +
        '<div class="result-body">' +
          helplineButton() +
          '<p>' + ext('https://www.worker.gov/', 'res.notpa.link') + '</p>' +
          actionsHtml(false) +
        '</div>';
    }
    var box = byId('result');
    box.innerHTML = '<div class="result-card">' + html + '</div>';
    L.applyText(box);
  }

  function editAnswers() {
    goTo(state.resultFrom);
  }

  function startOver() {
    form.reset();
    byId('summary').querySelectorAll('input, textarea').forEach(function (el) {
      if (el.type === 'checkbox') el.checked = false; else el.value = '';
    });
    resetState();
    clearAllErrors();
    updateStep1();
    updateStep2();
    goTo(1);
  }

  function clearAllErrors() {
    form.querySelectorAll('[aria-invalid]').forEach(function (el) { el.setAttribute('aria-invalid', 'false'); });
    form.querySelectorAll('.has-error').forEach(function (el) { el.classList.remove('has-error'); });
    form.querySelectorAll('.field-error').forEach(function (el) { el.textContent = ''; });
  }

  // ---------------------------------------------------- Printable summary

  function openSummary() {
    byId('result').hidden = true;
    byId('summary').hidden = false;
    buildPrintSheet();
    byId('summary-h').focus({ preventScroll: true });
    scrollToTop();
  }

  function closeSummary() {
    byId('summary').hidden = true;
    byId('result').hidden = false;
    byId('result-h').focus({ preventScroll: true });
    scrollToTop();
  }

  function payDescription() {
    var p = pay();
    if (p.payType === 'hourly') return t('print.payHourly', { rate: rate(p.rate) });
    if (p.payType === 'tipped') return t('print.payTipped', { rate: rate(p.rate) });
    if (p.payType === 'salary') return t('print.paySalary', { salary: L.money(p.salary) });
    if (p.payType === 'flat') return t(p.flatKind === 'piece' ? 'print.payPiece' : 'print.payDay');
    return '';
  }

  // One "Label   value" row for the printout. Blank values are left out.
  function printRow(labelKey, value) {
    if (!value) return '';
    return '<div class="ps-row"><dt>' + esc(t(labelKey)) + '</dt><dd>' + esc(value) + '</dd></div>';
  }

  // A labeled group of rows. Left out entirely if every row is blank.
  function printGroup(labelKey, rows) {
    if (!rows) return '';
    return '<div class="ps-sec"><p class="ps-label">' + esc(t(labelKey)) + '</p><dl class="ps-list">' + rows + '</dl></div>';
  }

  function shiftTable(shifts) {
    var head = '<tr><th>' + esc(t('shift.date')) + '</th><th>' + esc(t('shift.start')) + '</th><th>' + esc(t('shift.end')) + '</th><th>' + esc(t('print.break')) + '</th><th>' + esc(t('th.hours')) + '</th></tr>';
    var rows = shifts.map(function (s) {
      return '<tr><td>' + esc(L.dateShort(s.raw.date)) + '</td><td>' + esc(s.raw.start) + '</td><td>' + esc(s.raw.end) + '</td><td>' + L.number(s.breakMinutes) + '</td><td>' + L.number(s.paidHours) + '</td></tr>';
    }).join('');
    return '<table>' + head + rows + '</table>';
  }

  // Build the one-page printout. Only filled-in fields are included.
  function buildPrintSheet() {
    var r = state.result;
    var j = job();
    var value = function (id) { return byId(id).value.trim(); };

    // Title block
    var html = '<div class="ps-head">' +
      '<p class="ps-brand">CheckMyPay PA</p>' +
      '<p class="ps-title">' + esc(t('print.title')) + '</p>' +
      '<p class="ps-date">' + esc(L.dateLong(todayIso())) + '</p>' +
    '</div>';

    // The main answer, big and first
    if (r.status === 'underpaid') {
      html += '<div class="ps-total"><span>' + esc(t('print.total')) + '</span><strong>' + L.money(r.total) + '</strong></div>';
    } else if (r.status === 'cantTell') {
      html += '<div class="ps-total ps-total-text"><strong>' + esc(t('res.cant.h')) + '</strong><span>' + esc(t('cant.' + r.reason)) + '</span></div>';
    }

    // Details, side by side
    var docs = Array.prototype.filter.call(document.querySelectorAll('input[name="docs"]'), function (c) { return c.checked; })
      .map(function (c, i) {
        // Read as one list: "Pay stubs, schedules or time sheets, texts..."
        var name = t('docs.' + c.value);
        return i === 0 ? name : name.charAt(0).toLowerCase() + name.slice(1);
      });
    var you = printRow('sum.name', value('sum-name')) +
      printRow('sum.employer', value('sum-employer')) +
      printRow('sum.address', value('sum-address')) +
      printRow('sum.job', value('sum-job'));
    var work = printRow('print.workType', j.workType ? t('work.' + j.workType) : '') +
      printRow('print.pay', state.resultFrom >= 2 ? payDescription() : '') +
      printRow('sum.dates', value('sum-dates')) +
      printRow('print.docs', docs.join(', '));
    var groups = printGroup('print.sec.you', you) + printGroup('print.sec.job', work);
    if (groups) html += '<div class="ps-two">' + groups + '</div>';

    // Week table with a total row
    if (r.weeks && r.weeks.length) {
      var tipped = radio('payType') === 'tipped';
      var head = '<tr><th>' + esc(t('th.week')) + '</th><th>' + esc(t('th.hours')) + '</th>' +
        (tipped ? '<th>' + esc(t('th.tips')) + '</th>' : '') +
        '<th>' + esc(t('th.should')) + '</th><th>' + esc(t('th.paid')) + '</th><th>' + esc(t('th.short')) + '</th></tr>';
      var rows = r.weeks.map(function (w, i) {
        return '<tr><td>' + esc(state.resultLabels[i]) + '</td><td>' + L.number(w.hours) + '</td>' +
          (tipped ? '<td>' + L.money(w.tips) + '</td>' : '') +
          '<td>' + L.money(w.required) + '</td><td>' + L.money(w.paid) + '</td><td>' + L.money(w.shortfall) + '</td></tr>';
      }).join('');
      var blanks = tipped ? '<td></td><td></td><td></td><td></td>' : '<td></td><td></td><td></td>';
      rows += '<tr class="ps-total-row"><td>' + esc(t('th.total')) + '</td>' + blanks + '<td>' + L.money(r.total) + '</td></tr>';
      html += '<div class="ps-sec"><p class="ps-label">' + esc(t('print.sec.weeks')) + '</p><table>' + head + rows + '</table></div>';
    }

    // Shift table, split into two side-by-side tables when long so it fits one page
    var shifts = state.resultShifts;
    if (shifts.length) {
      var tables = shifts.length > 8
        ? '<div class="ps-cols">' + shiftTable(shifts.slice(0, Math.ceil(shifts.length / 2))) + shiftTable(shifts.slice(Math.ceil(shifts.length / 2))) + '</div>'
        : shiftTable(shifts);
      html += '<div class="ps-sec"><p class="ps-label">' + esc(t('print.sec.shifts')) + '</p>' + tables + '</div>';
    }

    var other = value('sum-other');
    if (other) html += '<div class="ps-sec"><p class="ps-label">' + esc(t('print.sec.other')) + '</p><p class="ps-other">' + esc(other) + '</p></div>';

    html += '<p class="ps-foot">' + esc(t('print.footer')) + '</p>';
    byId('print-sheet').innerHTML = html;
  }

  // --------------------------------------------------------------- Events

  form.addEventListener('click', function (e) {
    var btn = e.target.closest('button');
    if (!btn) return;
    var action = btn.getAttribute('data-action');
    if (action === 'next') return state.step === 1 ? nextFromStep1() : nextFromStep2();
    if (action === 'back') return goTo(state.step - 1);
    if (action === 'calculate') return calculate();

    var removeWeek = btn.getAttribute('data-remove-week');
    if (removeWeek) {
      state.weeks = state.weeks.filter(function (w) { return String(w.id) !== removeWeek; });
      renderWeeks();
      byId('add-week').focus();
      return;
    }
    var removeShift = btn.getAttribute('data-remove-shift');
    if (removeShift) {
      state.shifts = state.shifts.filter(function (s) { return String(s.id) !== removeShift; });
      renderShifts();
      byId('add-shift').focus();
      return;
    }
    if (btn.id === 'add-week') {
      var w = blankWeek();
      if (radio('payType') === 'salary') w.paid = byId('salary').value;
      state.weeks.push(w);
      renderWeeks();
      byId('w' + w.id + '-hours').focus();
      return;
    }
    if (btn.id === 'add-shift') return addShift();
  });

  // Typing: keep state up to date and re-check as the person goes.
  form.addEventListener('input', function (e) {
    var el = e.target;
    var weekCard = el.closest('[data-week-id]');
    var shiftCard = el.closest('[data-shift-id]');
    var payCard = el.closest('[data-week-start]');

    if (weekCard) {
      var w = state.weeks.find(function (x) { return String(x.id) === weekCard.getAttribute('data-week-id'); });
      w[el.id.split('-').pop()] = el.value;
      checkWeeks();
    } else if (shiftCard) {
      var s = state.shifts.find(function (x) { return String(x.id) === shiftCard.getAttribute('data-shift-id'); });
      s[el.id.split('-').pop()] = el.value;
      updateShifts();
    } else if (payCard) {
      state.shiftPay[payCard.getAttribute('data-week-start')][el.id.split('-').pop()] = el.value;
      if (state.tried[3]) collectShifts();
    } else if (el.id === 'rate' || el.id === 'salary') {
      if (state.tried[2]) validateStep2();
    }
  });

  form.addEventListener('change', function (e) {
    var el = e.target;
    if (el.name === 'state' || el.name === 'workType' || el.name === 'contractor') updateStep1();
    if (el.name === 'payType' || el.name === 'flatKind') updateStep2();
    if (el.name === 'mode') setMode(el.value);
    if (el.id === 'week-start') {
      state.weekStartDay = +el.value;
      state.shiftWeekKeys = null;
      updateShifts();
    }
  });

  byId('result').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-result-action]');
    if (!btn) return;
    var action = btn.getAttribute('data-result-action');
    if (action === 'summary') openSummary();
    if (action === 'edit') editAnswers();
    if (action === 'restart') startOver();
  });

  byId('summary').addEventListener('input', buildPrintSheet);
  byId('summary').addEventListener('change', buildPrintSheet);
  byId('summary-back').addEventListener('click', closeSummary);
  byId('summary-print').addEventListener('click', function () {
    buildPrintSheet();
    window.print();
  });

  // Switching language: redraw everything that was built by this file.
  L.onChange(function () {
    updateStepper();
    updateStep2();
    if (state.step === 3) {
      if (state.mode === 'weekly') renderWeeks(); else renderShifts();
      if (state.tried[3] && state.mode === 'shifts') collectShifts();
    }
    if (state.step === 1 && state.tried[1]) validateStep1();
    if (!byId('error-summary').hidden) showSummaryError(true);
    if (state.result) {
      // Week labels for shift entry are dates, which are written differently in each language.
      if (state.resultFrom === 3) {
        state.resultLabels = state.mode === 'weekly'
          ? state.weeks.map(function (w, i) { return t('week.title', { n: i + 1 }); })
          : S.groupIntoWeeks(S.validateShifts(state.shifts.map(rawShift)), state.weekStartDay).map(weekLabel);
      }
      renderResult();
      buildPrintSheet();
    }
  });

  // --------------------------------------------------------------- Start
  updateStep1();
  updateStep2();
  updateStepper();
})();
