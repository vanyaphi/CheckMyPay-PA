# CheckMyPay PA

A free, private, bilingual (English/Spanish) website that helps Pennsylvania workers check whether they may have been underpaid. Plain HTML, CSS, and JavaScript. No frameworks, build step, libraries, cookies, storage, analytics, or network requests.

## Files

| File | What it does |
|---|---|
| `index.html`, `check.html`, `wage-theft.html`, `help.html`, `about.html` | The five pages |
| `css/styles.css` | All styles, including the one-page print layout |
| `js/rules.js` | **Every legal number**, each with a source and `verifiedDate` |
| `js/i18n.js` | **Every word on the site**, English and Spanish, plus the FAQ layout and links |
| `js/resources.js` | The Get help list. Add organizations here |
| `js/calculator.js` | The pay math (minimum wage, overtime, tipped, salary, day/piece rate) |
| `js/shifts.js` | Shift math: overnight shifts, breaks, workweeks, boundary splitting, overlaps |
| `js/layout.js` | Shared header/footer, language switching, shared blocks |
| `js/check.js` | The Check my pay page: steps, live shift hours, results, printable summary |
| `js/help.js` | Builds the resource list and FAQ |
| `tests/` | Tests, run with Node's built-in test runner |
| `make-favicons.sh` | Makes favicons from `logo.png` (macOS) |

Each `js/` module works in the browser (`window.RULES`, `window.Calculator`, …) and in Node (`require`).

## Run it locally

Any static server works. From this folder:

```
python3 -m http.server 8000
```

Then open http://localhost:8000. (Opening the files directly with `file://` may block the scripts because of the page's security policy.)

## Run the tests

Install Node.js 20 or newer (https://nodejs.org), then from this folder:

```
node --test
```

The tests cover all the worked examples from the spec, the required split-week overtime test, validation, both languages having identical keys, every key used on a page existing, and a scan confirming no storage, outside requests, or AI mentions.

## Add the logo and favicons

1. `logo.png` is in place. It was cropped to the 324×324 icon from `Untitled design-2.png`, which had a lot of empty space around it. To swap logos later, replace `logo.png` with a square PNG. The header shows it automatically.
2. On a Mac, run `sh make-favicons.sh` to create `favicon-32.png` and `apple-touch-icon.png`. On other systems, make a 32×32 and a 180×180 PNG from the logo with those names.
3. If your logo already includes the words "CheckMyPay PA", you can hide the text name by adding `.brand-name { display: none; }` to the end of `css/styles.css`.

## Deploy to GitHub Pages

1. Create a new public repository on GitHub.
2. Upload everything in this folder (the files must be at the top level of the repository, so `index.html` is not inside a subfolder). Keep the empty `.nojekyll` file.
3. In the repository, go to **Settings → Pages**. Under **Build and deployment**, pick **Deploy from a branch**, choose `main` and `/ (root)`, and save.
4. After a minute, the site is live at `https://<your-username>.github.io/<repository-name>/`.

### Custom domain

1. In **Settings → Pages → Custom domain**, type your domain (for example `www.yourdomain.org`) and save. GitHub adds a `CNAME` file to the repository.
2. At your domain registrar, add DNS records:
   - For a subdomain like `www`: a **CNAME** record pointing to `<your-username>.github.io`.
   - For the bare domain (`yourdomain.org`): **A** records pointing to GitHub's Pages IP addresses, listed in GitHub's docs: https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site
3. Wait for DNS to update (minutes to a day), then check **Enforce HTTPS** in Settings → Pages.

## Editing

- **Words:** change them in `js/i18n.js`. Keep the same key in both `en` and `es`. Words in `{braces}` are filled in automatically (for example `{min}` becomes $7.25 from `rules.js`), so leave them in.
- **Legal numbers:** change them only in `js/rules.js`, and update `verifiedDate`. The About page's "last checked" date comes from `minimumWage.verifiedDate`.
- **Help organizations:** copy an entry in `js/resources.js`. There is a commented template for Pittsburgh groups. A group with no entries is hidden, which is why "Worker centers" doesn't appear yet.
- **Retaliation and immigration wording:** when you have the U.S. Department of Labor's exact wording, add it as `faq.a13` / `faq.a14` in both languages in `i18n.js` (the page shows an answer automatically when the key exists), and replace `next.retal.b` for the result page. Search `check.js` for `TODO` to find the spot.

## Verification flags (VERIFY)

| Item | Where | Status |
|---|---|---|
| Exact subsection of 34 Pa. Code § 231.43 for the salaried ÷ 40 rule | `rules.js` → `salariedDivisorHours` | **VERIFY.** Research note: the official Pennsylvania Code text (pacodeandbulletin.gov) appears to put this in **§ 231.43(g)**: "The regular rate for salaried employees who are not exempt from overtime is the amount of remuneration determined under subsection (a) divided by 40 hours." Confirm, then update the citation. |
| Pennsylvania treatment of day-rate / flat-sum pay | `rules.js` → `dayRateMethod` | **VERIFY Pennsylvania treatment.** Research note: § 231.43(b) appears to say a flat sum for a day's work or a job is totaled for the week, divided by total hours actually worked, with "extra half-time pay at this rate" over 40, which matches the federal method used. Confirm. |
| Pennsylvania treatment of piece-rate pay | `rules.js` → `pieceRateMethod` | **VERIFY Pennsylvania treatment.** The federal method is used. Research note: § 231.43 mentions piece rates mainly in an alternative method that requires a prior agreement, so it was not used. |
| PA Minimum Wage Act statute of limitations | `rules.js` → `paDeadlineYears` | **VERIFY.** Not used on the site. The site uses the federal 2-year deadline and says some claims may allow longer. |
| Whether credit-card fees may be deducted from tips | not used | **VERIFY.** The tool asks nothing about it. |
| PALawHelp.org | `resources.js` | **VERIFY BEFORE LAUNCH.** Shown on the site with no checked date. The site would not respond to an automated check, so open it by hand. |
| Pennsylvania Legal Aid Network (palegalaid.net) | `resources.js` | **VERIFY BEFORE LAUNCH.** Shown with no checked date. The description was written for this site. |
| FAQ links for questions 12–16 and 17–22 | `i18n.js` → `FAQ` | **VERIFY LINKS.** These point to general agency pages that may not answer the question directly. Question 22's link (`dli.pa.gov/...`) now redirects to `pa.gov/.../pennsylvania-s-minimum-wage-act`. It still works, but you may want to update it. |
| Spanish translations | `i18n.js` → `es`, `resources.js` | **VERIFY.** For review by a fluent speaker. |
| Local Pittsburgh resources | `resources.js` | **VERIFY.** Not added yet. Use the template. |
| `verifiedDate` values | `rules.js`, `resources.js` | Set to 2026-10-21 for the items you listed as verified. Change them to your real check dates. |

Link check notes (2026-10-21): pa.gov, worker.gov, Cornell, palegalaid.net, and the PA Code page loaded. dol.gov and epi.org block automated checks (403) and Northwestern returned 503, so open those by hand. The original PA minimum wage URL used in development was replaced with the current pa.gov page.

## Pre-launch checklist

- [x] Add `logo.png` and run `make-favicons.sh`
- [ ] Resolve every VERIFY row above, then update `verifiedDate` values
- [ ] Click every link on About, Get help, and the FAQ
- [ ] Have a fluent Spanish speaker review `es` in `i18n.js` and the Spanish in `resources.js`
- [ ] Add local Pittsburgh legal aid and worker centers
- [ ] Paste the DOL's exact retaliation/immigration wording, if you have it
- [ ] Run `node --test` and confirm everything passes
- [ ] Try the site on a real iPhone (Safari) and on a laptop in Chrome, Firefox, Safari, and Edge
- [ ] Try the whole calculator with only a keyboard (Tab, Shift+Tab, Space, Enter)
- [ ] Print the summary (or save it as a PDF) and confirm it fits on one page
- [ ] Confirm the custom domain loads over HTTPS

## Known limits

- Checks only the numbers entered. It can't see unpaid breaks, deductions, or off-the-clock work.
- Pennsylvania only. Farm work, household work, independent contractors, and salaries of $684 a week or more get "can't tell."
- A shift that crosses a daylight-saving-time change is off by one hour (times are treated as plain clock times).
- When a shift crosses the workweek boundary, its unpaid break is spread in proportion across both sides.
- "Tipped employee" status uses the average weekly tips entered, converted to a monthly figure (× 52 ÷ 12).
- For hourly and tipped workers, "should have been paid" uses the rate the worker entered (raised to the legal minimum if lower), so a gap between promised and paid wages also shows up.
- Up to 8 weeks at a time. A very long list of shifts may not fit on one printed page.
- Does not cover Pennsylvania's child labor laws on hours and permits.

## Choices made during the build

- The printable summary opens inside the Check my pay page (nothing is passed between pages), and only the summary prints. It stays black, Arial, left-aligned, with 1-inch margins and no boxes or colors. To make it easier to read, it has a large total (or the "can't tell" reason) at the top, small section labels, two side-by-side detail columns, and thin lines between table rows. Long shift lists split into two columns so the page fits.
- On the result page, retaliation shows a link to the DOL page only.
- Pay is "before taxes." The tips field appears only for tipped workers, and a blank tips field counts as $0.
- Weekly salary only, with a hint for converting biweekly or twice-monthly pay.
- Flat and piece rate is one choice with a follow-up (day/job or piece). Only weekly totals are asked for.
- Differences under $0.50 count as rounding, week by week.
- Farm, household, contractor, and other-state answers end at Step 1. A salary of $684 or more ends at Step 2.
- The statistics band and closing call to action appear on both Home and What is wage theft.
- The phone layout uses a menu button. The language button is always visible.
- A Content-Security-Policy on each page blocks every outside request, which backs up the privacy promise.
