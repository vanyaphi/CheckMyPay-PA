/*
 * help.js
 * Builds the Get help page: the resource list (from resources.js) and the
 * FAQ (from i18n.js). Rebuilds both when the language changes.
 */
(function () {
  'use strict';

  var L = window.Layout;
  var esc = L.esc;

  // "1-866-487-9243" -> "tel:+18664879243"
  function telLink(phone) {
    return 'tel:+1' + phone.replace(/\D/g, '').replace(/^1/, '');
  }

  function renderHelpline() {
    var a = document.getElementById('helpline-number');
    a.href = telLink(window.RESOURCES.helpline);
    a.textContent = window.RESOURCES.helpline;
  }

  function renderResources() {
    var lang = L.lang();
    var list = window.RESOURCES.items;
    var html = window.RESOURCES.groups.map(function (group) {
      var items = list.filter(function (r) { return r.group === group; });
      if (items.length === 0) return ''; // empty groups are hidden
      var cards = items.map(function (r) {
        var details = r.details ? r.details[lang].map(function (line) {
          return '<li>' + esc(line) + '</li>';
        }).join('') : '';
        return '<li class="resource-card">' +
          '<h3>' + esc(r.name[lang]) + '</h3>' +
          '<p>' + esc(r.description[lang]) + '</p>' +
          (details ? '<ul class="resource-details">' + details + '</ul>' : '') +
          (r.phone ? '<p class="resource-phone"><a href="' + telLink(r.phone) + '">' + esc(r.phone) + '</a></p>' : '') +
          '<div class="resource-foot">' +
            '<a class="btn btn-gold btn-sm" href="' + esc(r.url) + '" target="_blank" rel="noopener">' +
              esc(L.t('help.visit')) + '<span class="sr-only">: ' + esc(r.name[lang]) + '</span></a>' +
            (r.checked ? '<p class="resource-checked">' + esc(L.t('help.checked', { date: L.dateLong(r.checked) })) + '</p>' : '') +
          '</div>' +
        '</li>';
      }).join('');
      return '<div class="resource-group">' +
        '<h2 class="group-title">' + esc(L.t('help.g.' + group)) + '</h2>' +
        '<ul class="resource-grid">' + cards + '</ul>' +
      '</div>';
    }).join('');
    var box = document.getElementById('resource-groups');
    box.innerHTML = html;
    L.applyText(box);
  }

  // FAQ uses <details>/<summary> so each question opens and closes on its own.
  function renderFaq() {
    var lang = L.lang();
    var html = window.I18N.faq.map(function (group) {
      var items = group.items.map(function (item) {
        var answerKey = 'faq.a' + item.n;
        var answer = window.I18N.has(lang, answerKey) ? '<p>' + esc(L.t(answerKey)) + '</p>' : '';
        var link = item.link
          ? '<p class="faq-link">' + esc(L.t('faq.learnMore')) + ': <a href="' + esc(item.link) + '" target="_blank" rel="noopener">' + esc(item.link.replace(/^https:\/\/(www\.)?/, '').replace(/\/$/, '')) + '</a></p>'
          : '';
        return '<details class="faq-item">' +
          '<summary>' + esc(L.t('faq.q' + item.n)) + '</summary>' +
          '<div class="faq-answer">' + answer + link + '</div>' +
        '</details>';
      }).join('');
      return '<div class="faq-group"><h3 class="faq-group-title">' + esc(L.t(group.group)) + '</h3>' + items + '</div>';
    }).join('');
    var box = document.getElementById('faq');
    // Keep open questions open when the language changes.
    var open = Array.prototype.map.call(box.querySelectorAll('details'), function (d) { return d.open; });
    box.innerHTML = html;
    box.querySelectorAll('details').forEach(function (d, i) { if (open[i]) d.open = true; });
    L.applyText(box);
  }

  function render() {
    renderHelpline();
    renderResources();
    renderFaq();
  }

  render();
  L.onChange(render);
})();
