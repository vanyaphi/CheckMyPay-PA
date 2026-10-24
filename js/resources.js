/*
 * resources.js
 * The list on the Get help page. To add an organization, copy one entry,
 * change the words, and put it in the right group.
 *
 * Each entry:
 *   group        'agencies' | 'legal' | 'centers' | 'info'
 *   name         { en, es }
 *   description  { en, es }  one or two short sentences
 *   details      { en: [lines], es: [lines] }  optional: address, phone, hours
 *   phone        optional, shown as a tap-to-call link
 *   url          the website
 *   checked      'YYYY-MM-DD' when a person last confirmed the entry,
 *                or null if it still needs checking (no date is shown)
 *
 * A group with no entries is hidden on the page.
 *
 * Works in the browser (window.RESOURCES) and in Node (require).
 */
(function (root) {
  'use strict';

  var RESOURCES = {
    // The U.S. Department of Labor Wage and Hour Division helpline.
    helpline: '1-866-487-9243',
    helplineLetters: '1-866-4-USWAGE',

    groups: ['agencies', 'legal', 'centers', 'info'],

    items: [
      {
        group: 'agencies',
        name: {
          en: 'Pennsylvania Department of Labor & Industry: wage complaint',
          es: 'Departamento de Trabajo e Industria de Pensilvania: queja de salario'
        },
        description: {
          en: 'File a complaint about unpaid wages under Pennsylvania law. The form is online and available in Spanish.',
          es: 'Presente una queja por salarios no pagados bajo la ley de Pensilvania. El formulario está en internet y disponible en español.'
        },
        details: {
          en: ['Bureau of Labor Law Compliance', '1301 Labor and Industry Building, 651 Boas Street, Harrisburg, PA 17121'],
          es: ['Bureau of Labor Law Compliance (Oficina de Cumplimiento de Leyes Laborales)', '1301 Labor and Industry Building, 651 Boas Street, Harrisburg, PA 17121']
        },
        url: 'https://www.pa.gov/services/dli/file-a-wage-payment-and-collection-complaint',
        checked: '2026-10-21'
      },
      {
        group: 'agencies',
        name: {
          en: 'U.S. Department of Labor, Wage and Hour Division',
          es: 'Departamento de Trabajo de EE. UU., División de Horas y Salarios'
        },
        description: {
          en: 'File a complaint about minimum wage or overtime. Calling is free, and interpreters are available.',
          es: 'Presente una queja sobre el salario mínimo o las horas extra. La llamada es gratis y hay intérpretes disponibles.'
        },
        details: {
          en: ['Monday to Friday, 8:00 a.m. to 4:30 p.m. local time'],
          es: ['Lunes a viernes, de 8:00 a.m. a 4:30 p.m., hora local']
        },
        phone: '1-866-487-9243',
        url: 'https://www.dol.gov/agencies/whd/contact/complaints',
        checked: '2026-10-21'
      },

      // VERIFY BEFORE LAUNCH: PALawHelp.org and the Pennsylvania Legal Aid Network.
      {
        group: 'legal',
        name: { en: 'PALawHelp.org', es: 'PALawHelp.org' },
        description: {
          en: 'Free legal information for Pennsylvanians, with a directory to help you find a legal aid office near you.',
          es: 'Información legal gratuita para personas en Pensilvania, con un directorio para encontrar una oficina de ayuda legal cerca de usted.'
        },
        url: 'https://www.palawhelp.org/',
        checked: null
      },
      {
        group: 'legal',
        name: { en: 'Pennsylvania Legal Aid Network', es: 'Pennsylvania Legal Aid Network (Red de Ayuda Legal de Pensilvania)' },
        description: {
          en: 'A network of nonprofit legal aid offices that give free civil legal help to Pennsylvanians with low incomes.',
          es: 'Una red de oficinas de ayuda legal sin fines de lucro que dan ayuda legal civil gratuita a personas de bajos ingresos en Pensilvania.'
        },
        url: 'https://palegalaid.net/',
        checked: null
      },

      // ADD LOCAL PITTSBURGH GROUPS HERE. Copy this template, remove the //,
      // and fill it in. Use group: 'legal' for legal aid, 'centers' for
      // worker centers.
      // {
      //   group: 'centers',
      //   name: { en: '', es: '' },
      //   description: { en: '', es: '' },
      //   details: { en: ['Street address, Pittsburgh, PA'], es: ['Street address, Pittsburgh, PA'] },
      //   phone: '',
      //   url: '',
      //   checked: 'YYYY-MM-DD'
      // },

      {
        group: 'info',
        name: { en: 'Worker.gov', es: 'Worker.gov' },
        description: {
          en: 'A federal guide to your rights at work, written in plain language.',
          es: 'Una guía federal sobre sus derechos en el trabajo, escrita en palabras sencillas.'
        },
        url: 'https://www.worker.gov/',
        checked: '2026-10-21'
      }
    ]
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = RESOURCES;
  } else {
    root.RESOURCES = RESOURCES;
  }
})(typeof window !== 'undefined' ? window : globalThis);
