/*
 * layout.js
 * Runs on every page. It:
 *  1. picks the language (?lang= in the address, otherwise the browser's language)
 *  2. builds the shared header and footer
 *  3. fills shared blocks (the statistics band and the closing call to action)
 *  4. fills every element marked data-i18n="key" with words from i18n.js
 *  5. switches language instantly when the language button is pressed
 *
 * Nothing is stored. The language lives only in the page address (?lang=es).
 */
(function () {
  'use strict';

  var listeners = [];
  var lang = pickLanguage();

  // ----------------------------------------------------------- Language

  function pickLanguage() {
    var fromUrl = new URLSearchParams(window.location.search).get('lang');
    if (fromUrl === 'en' || fromUrl === 'es') return fromUrl;
    var browser = (navigator.languages && navigator.languages[0]) || navigator.language || 'en';
    return /^es\b/i.test(browser) ? 'es' : 'en';
  }

  function locale() {
    return lang === 'es' ? 'es-US' : 'en-US';
  }

  // ---------------------------------------------------------- Formatting

  // $1,234.56 (always two decimals, used in results)
  function money(n) {
    return new Intl.NumberFormat(locale(), { style: 'currency', currency: 'USD' }).format(n);
  }

  // $684 or $7.25 (drops .00 for whole numbers, used in sentences)
  function moneyShort(n) {
    var whole = Math.round(n * 100) % 100 === 0;
    return new Intl.NumberFormat(locale(), {
      style: 'currency', currency: 'USD',
      minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2
    }).format(n);
  }

  // 42 or 1.75
  function number(n) {
    return new Intl.NumberFormat(locale(), { maximumFractionDigits: 2 }).format(n);
  }

  // '2026-10-05' -> 'October 5, 2026' (or '5 de octubre de 2026')
  function dateLong(iso) {
    var p = iso.split('-');
    return new Intl.DateTimeFormat(locale(), { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
      .format(new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])));
  }

  // '2026-10-05' -> 'Mon, Oct 5'
  function dateShort(iso) {
    var p = iso.split('-');
    return new Intl.DateTimeFormat(locale(), { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
      .format(new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])));
  }

  // Values that many sentences share, taken from rules.js and resources.js.
  function sharedVars() {
    var v = window.RULES.v;
    return {
      min: moneyShort(v('minimumWage')),
      cash: moneyShort(v('tippedCashWage')),
      threshold: moneyShort(v('tippedMonthlyThreshold')),
      exempt: moneyShort(v('exemptSalaryWeekly')),
      otHours: number(v('overtimeThresholdHours')),
      mult: number(v('overtimeMultiplier')),
      divisor: number(v('salariedDivisorHours')),
      years: number(v('federalDeadlineYears')),
      max: number(v('maxWeeks')),
      maxHours: number(v('maxWeeklyHours')),
      phone: window.RESOURCES.helpline,
      date: dateLong(window.RULES.minimumWage.verifiedDate)
    };
  }

  // Translate a key. Extra values can be passed in; shared ones are always there.
  function t(key, vars) {
    return window.I18N.t(lang, key, Object.assign(sharedVars(), vars || {}));
  }

  // Make sure text is safe to put inside HTML.
  function esc(text) {
    return String(text)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // Link to one of our own pages, keeping the language.
  function href(page) {
    return page + '?lang=' + lang;
  }

  // ------------------------------------------------------ Shared pieces

  var PAGES = [
    { file: 'index.html', key: 'nav.home', id: 'home' },
    { file: 'check.html', key: 'nav.check', id: 'check' },
    { file: 'wage-theft.html', key: 'nav.wageTheft', id: 'wageTheft' },
    { file: 'help.html', key: 'nav.help', id: 'help' },
    { file: 'about.html', key: 'nav.about', id: 'about' }
  ];

  function navLinks(current) {
    return PAGES.map(function (p) {
      var here = p.id === current ? ' aria-current="page"' : '';
      return '<li><a href="' + p.file + '" data-i18n="' + p.key + '"' + here + '></a></li>';
    }).join('');
  }

  function buildHeader(current) {
    var header = document.getElementById('site-header');
    if (!header) return;
    header.innerHTML =
      '<div class="header-inner">' +
        '<a class="brand" href="index.html">' +
          '<span class="brand-name">CheckMyPay <span class="brand-pa">PA</span></span>' +
        '</a>' +
        '<nav class="site-nav" id="site-nav" data-i18n-attr="aria-label:nav.label">' +
          '<ul>' + navLinks(current) + '</ul>' +
        '</nav>' +
        '<button type="button" class="lang-toggle" id="lang-toggle" data-i18n="lang.button" data-i18n-attr="aria-label:lang.label"></button>' +
        '<button type="button" class="menu-toggle" id="menu-toggle" aria-expanded="false" aria-controls="site-nav">' +
          '<span class="menu-bars" aria-hidden="true"></span><span data-i18n="nav.menu"></span>' +
        '</button>' +
      '</div>';

    // The supplied logo goes in front of the name. If logo.png is missing,
    // the image is simply removed and the name stands on its own.
    var logo = document.createElement('img');
    logo.className = 'brand-logo';
    logo.alt = '';
    logo.width = 44;
    logo.height = 44;
    logo.addEventListener('error', function () { logo.remove(); });
    logo.src = 'logo.png';
    header.querySelector('.brand').prepend(logo);

    document.getElementById('lang-toggle').addEventListener('click', function () {
      setLanguage(lang === 'en' ? 'es' : 'en');
    });

    // Phone menu: open and close the nav.
    var toggle = document.getElementById('menu-toggle');
    toggle.addEventListener('click', function () {
      var open = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(open));
      header.classList.toggle('nav-open', open);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && header.classList.contains('nav-open')) {
        toggle.setAttribute('aria-expanded', 'false');
        header.classList.remove('nav-open');
        toggle.focus();
      }
    });
  }

  function buildFooter() {
    var footer = document.getElementById('site-footer');
    if (!footer) return;
    footer.innerHTML =
      '<div class="footer-inner">' +
        '<div class="footer-brand">' +
          '<p class="footer-name">CheckMyPay <span class="brand-pa">PA</span></p>' +
          '<p data-i18n="footer.tagline"></p>' +
        '</div>' +
        '<nav data-i18n-attr="aria-label:footer.navLabel"><ul class="footer-nav">' + navLinks(null) + '</ul></nav>' +
        '<div class="footer-notes">' +
          '<p class="footer-privacy"><span class="lock" aria-hidden="true"></span><span data-i18n="footer.privacy"></span></p>' +
          '<p data-i18n="footer.notLegal"></p>' +
        '</div>' +
      '</div>';
  }

  var STAT_SOURCES = [
    'https://www.dol.gov/newsroom/releases/whd/whd20260108',
    'https://www.epi.org/press/wage-theft-costs-american-workers-50-billion/',
    'https://news.northwestern.edu/stories/2025/05/new-report-labor-investigator-staffing-hits-52-year-low-raising-the-risk-of-wage-theft'
  ];

  // <section data-block="stats"> and <section data-block="cta"> are filled here
  // so the same block can appear on more than one page.
  function buildBlocks() {
    document.querySelectorAll('[data-block="stats"]').forEach(function (el) {
      var items = [1, 2, 3].map(function (n) {
        return '<li class="stat">' +
          '<p class="stat-number" data-i18n="stats.' + n + '.number"></p>' +
          '<p class="stat-text" data-i18n="stats.' + n + '.text"></p>' +
          '<p class="stat-source"><a href="' + STAT_SOURCES[n - 1] + '" target="_blank" rel="noopener" data-i18n="stats.' + n + '.source"></a></p>' +
        '</li>';
      }).join('');
      el.innerHTML =
        '<div class="container">' +
          '<p class="eyebrow eyebrow-gold" data-i18n="stats.eyebrow"></p>' +
          '<h2 class="stats-heading" id="stats-h" data-i18n="stats.heading"></h2>' +
          '<ul class="stats-list">' + items + '</ul>' +
          '<p class="stats-note" data-i18n="stats.note"></p>' +
        '</div>';
    });

    document.querySelectorAll('[data-block="cta"]').forEach(function (el) {
      el.innerHTML =
        '<div class="container cta-inner">' +
          '<div>' +
            '<h2 class="cta-title" data-i18n="cta.title"></h2>' +
            '<p class="cta-body" data-i18n="cta.body"></p>' +
          '</div>' +
          '<a class="btn btn-dark btn-xl" href="check.html" data-i18n="cta.button"></a>' +
        '</div>';
    });
  }

  // ------------------------------------------------------ Filling words

  function applyText(scope) {
    var rootEl = scope || document;
    document.documentElement.lang = lang;

    rootEl.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });

    // data-i18n-attr="aria-label:key;placeholder:key2"
    rootEl.querySelectorAll('[data-i18n-attr]').forEach(function (el) {
      el.getAttribute('data-i18n-attr').split(';').forEach(function (pair) {
        var parts = pair.split(':');
        el.setAttribute(parts[0].trim(), t(parts[1].trim()));
      });
    });

    var titleKey = document.body.getAttribute('data-title');
    if (titleKey) document.title = t(titleKey);

    // The language button is spoken in the language it switches to.
    var btn = document.getElementById('lang-toggle');
    if (btn) btn.setAttribute('lang', lang === 'en' ? 'es' : 'en');

    fixLinks(rootEl);
  }

  // Keep ?lang= on links to our own pages, and tell screen reader users
  // when a link opens a new tab.
  function fixLinks(rootEl) {
    rootEl.querySelectorAll('a[href]').forEach(function (a) {
      var raw = a.getAttribute('href');
      if (/^[a-z-]+\.html(\?|#|$)/.test(raw)) {
        var parts = raw.split('#');
        var page = parts[0].split('?')[0];
        a.setAttribute('href', href(page) + (parts[1] ? '#' + parts[1] : ''));
      }
      if (a.target === '_blank') {
        var note = a.querySelector('.new-tab');
        if (!note) {
          note = document.createElement('span');
          note.className = 'sr-only new-tab';
          a.appendChild(note);
        }
        note.textContent = ' ' + t('common.newTab');
      }
    });
  }

  function setLanguage(next) {
    lang = next;
    // Update the address so the language sticks if the page is reloaded.
    // This is not storage: it is just the page's own URL.
    var url = new URL(window.location.href);
    url.searchParams.set('lang', lang);
    history.replaceState(null, '', url);
    applyText();
    listeners.forEach(function (fn) { fn(lang); });
  }

  // -------------------------------------------------------------- Start

  function start() {
    var page = document.body.getAttribute('data-page');
    buildHeader(page);
    buildFooter();
    buildBlocks();
    applyText();
  }

  window.Layout = {
    lang: function () { return lang; },
    t: t,
    esc: esc,
    href: href,
    money: money,
    moneyShort: moneyShort,
    number: number,
    dateLong: dateLong,
    dateShort: dateShort,
    applyText: applyText,
    onChange: function (fn) { listeners.push(fn); }
  };

  start();
})();
