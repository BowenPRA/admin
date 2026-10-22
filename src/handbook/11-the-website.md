The website is https://pra.edu.vn, PRA's public face in English and Vietnamese. It is a set of plain web pages built from text files: no database, no login, nothing to patch. Almost every word on it is a file in one folder on the laptop, and a change goes live by pushing that folder to GitHub; the one exception is the newsletter, whose issues come from The Current. Open this chapter when a price, a date, a notice, an event, a blog post, a staff card or a review has to change, when a form stops saving, or when anyone mentions the domains. The Current (https://current.pra.edu.vn) is a different site with its own code; it is covered in [The Current, tab by tab](#/handbook/the-current).

## What the site is

- English pages are at https://pra.edu.vn and every address under it (https://pra.edu.vn/about/). Vietnamese pages are the same addresses under `/vi/` (https://pra.edu.vn/vi/about/).
- The code is on GitHub in the repository BowenPRA/website (https://github.com/BowenPRA/website). The working copy is `C:/Users/sbowe/pra-website` on the laptop that holds the code (Bowen's today). There is one branch, `main`.
- The pages are built by a program called Eleventy and hosted by GitHub Pages, free hosting that comes with GitHub. GitHub rebuilds and publishes the site after every push.
- The old address palmriveracademy.edu.vn forwards to pra.edu.vn. palmriveracademy.com stays on Wix and is left alone. See "Domains and DNS" below.
- The site sends no email. Its two forms save straight into The Current (see "The forms").
- The menu has three groups and two single links. About Us holds the About page, The Palm River Post (the weekly newsletter) and the Student Blog. Academics holds the five stage pages. Admissions holds the enrollment steps, tuition and fees, the schedule, the family guidebook and booking a tour. Events and Contact are the single links.

## How a change goes live

1. Edit the file in `C:/Users/sbowe/pra-website` (the table under "Where the text lives" says which).
2. Look at the page on the laptop (see "Running it on the laptop") and, for any text change, run `npm run check:vi` (see "The Vietnamese pages").
3. Commit the change in git with a short message saying what changed.
4. Push to `main` on GitHub.
5. GitHub Actions runs the workflow `.github/workflows/deploy.yml`: it builds the site into a folder called `_site` and publishes that folder to GitHub Pages. This takes a few minutes.
6. Check it worked: on GitHub, open the repository and the **Actions** tab. The newest run should show a green tick; a red cross means the build failed, and opening the run shows the error. Then open https://pra.edu.vn in a private window so the browser does not show an old copy, and look at the page you changed and its Vietnamese twin. If a page still looks old, wait a minute and reload with Ctrl+F5.

The same workflow also runs by itself every night at 02:30 Vietnam time, with no push, so that a newsletter issue published in The Current reaches the website (see "The Palm River Post pages"). Each build reads the published issues from The Current's database. If that database cannot be reached, the build on GitHub stops with a red cross and the live site stays as it was; run it again once The Current is up (on the run's page, **Re-run jobs** → **Re-run all jobs**).

> **Careful:** two things the publish depends on. `src/CNAME` is a one-line file holding `pra.edu.vn`; delete it and the site would be built for a GitHub address instead and the domain would break. In the repository's settings on GitHub, **Pages** must stay on "Source: GitHub Actions" with the custom domain `pra.edu.vn` and "Enforce HTTPS" ticked. Both were set once and need no attention unless the repository is recreated.

> **Ask Claude:** "Commit and push the website change we made, watch the GitHub Actions run, and tell me when https://pra.edu.vn shows it in both languages."

## Where the text lives

All paths are under `C:/Users/sbowe/pra-website/src/`. A `.njk` file is a page: HTML with a block of settings between two `---` lines at the top (the "front matter") and placeholders filled in at build time. A `.json` file is a list of named values in quotes; edit the words between the quotes and leave the commas and brackets as they are. Every Vietnamese page has the same file name under `vi/`.

| Page or thing | File | Format |
|---|---|---|
| Name, tagline, phone, email, hours, founding year, licence line, address, map, Facebook and WhatsApp links | `_data/site.json` | JSON; English at the top, Vietnamese in the `vi` block at the bottom |
| Menu, footer labels, button words, calendar key, review labels | `_data/strings.json` | JSON; `en` and `vi` blocks side by side |
| Home page | `index.njk` and `vi/index.njk` | page |
| Announcement reel (the navy pill under the menu on every page) | `_data/reel.json` | JSON; each notice has a `hideFrom` date |
| Noticeboard cards under the home hero | `_data/announcements.json` | JSON; cards do not expire by themselves |
| Reviews ("What families say") | `_data/reviews.json` | JSON |
| The five program cards and home stage tiles | `_data/programs.json` | JSON |
| Stage pages under Academics | `learning/index.njk`, `early-years.njk`, `primary.njk`, `lower-secondary.njk`, `upper-secondary.njk`, `global-program.njk` | page |
| "A day in ..." timelines and the schedule page's day chart | `_data/days.json` | JSON |
| About page | `about.njk` | page |
| Staff names and titles | `_data/team.json` (pictures: `_data/cutouts.json` and `assets/img/team/`) | JSON plus built pictures |
| Schedule page and calendar | `families/schedule.njk`; dates in `_data/calendar.json` (`grid` and `months` parts) | page plus JSON |
| Family guidebook | `families/handbook.njk`; the PDF `assets/docs/family-guidebook-2026.pdf` | page plus PDF |
| Events of this academic year (`/events/`, newest first) | `events.njk`; the events in `_data/events.json` | page plus JSON |
| Events of past years (`/events/2025-26/` and so on) | `events/past.njk` makes one page per past year by itself, from the years in `events.json` | page; no editing needed |
| Event pages (the full story of one event) | `events/mid-autumn-2026.njk` and `events/q1-showcase-2026.njk`, twins in `vi/events/` | page |
| Admissions steps and FAQ | `admissions/index.njk` | page |
| Tuition and fees | `admissions/tuition-and-fees.njk` | page; the prices are typed in it |
| Enrollment form | `admissions/enroll.njk` is tiny; every word on the form is in `_data/enroll.json` | JSON |
| Contact / Book a tour | `contact.njk` and `vi/contact.njk` | page |
| Privacy page | `privacy.njk` and `vi/privacy.njk` | page |
| Student Blog (student writing, `/writing/`) | `writing/index.njk`; one file per post in `writing/`; twins in `vi/writing/`; the blog's name and shared words in `_data/writing.json` | page per post |
| The Palm River Post (newsletter hub `/newsletter/` and one page per issue) | `newsletter/index.njk` and `newsletter/issue.njk`; the issues themselves come from The Current's database through `_data/newsletters.js` | written in The Current, not here |
| Feeds The Current reads (the calendar and the blog list as data) | `feeds/` | leave alone |
| Photo captions | `_data/photos.json` (built by a script; do not edit by hand) and `_data/altVi.json` (Vietnamese, by photo slug) | JSON |
| Photo album (an internal index of every photo, not in any menu) | `album.njk` | page; anyone with the link can open it |

Shared pieces (header, footer, hero, reviews, calendar grid, collage, the reel) are in `_includes/partials/`. The styling is `assets/css/main.css`. Those rarely need touching.

## Common jobs

### Changing a price or a date

1. Tuition is typed into `admissions/tuition-and-fees.njk` and its twin `vi/admissions/tuition-and-fees.njk`. The Vietnamese page writes the same number with dots: "33.500.000 VNĐ". Change both.
2. The payment dates (28 July, 8 October, 17 December, 22 March as of 15 October 2026) are on the same two pages.
3. The one-time admission fee (10,000,000 VND for a new student; none for the Global Program) appears twice: step 4 of `admissions/index.njk` and the note on the fees page, each in both languages.
4. Calendar dates live in `_data/calendar.json` in two forms, the month grids (`grid`) and the month-by-month list (`months`). Change both or the page contradicts itself.
5. Run `npm run check:vi`, look at the pages on the laptop, commit, push.

> **Rule:** the same facts in both languages. Every number, date, age and name on an English page must match its Vietnamese twin. Add nothing, drop nothing.

> **Ask Claude:** "On the website, change the Lower Secondary tuition to 63,000,000 VND a quarter on the fees page in English and Vietnamese, run check:vi, show me both pages on the laptop, then commit and push."

### Adding an event to the Events page

Since 16 October 2026 the Events page (`/events/`) shows only the current academic year, newest event at the top. Each past year has its own page, `/events/2025-26/` and so on, linked by a button further down the Events page. Those pages are made by themselves: when the first event of a new academic year is added, `/events/` switches to that year and the year before gets its own page, with nothing else to do.

1. Get the photos published through The Current's sign-off first (see "Images and the photo pipeline"), so their slugs exist in `_data/photos.json`.
2. In `_data/events.json` the years run newest first, and inside a year the events run in date order, oldest first. Copy the last event of the current year and paste it straight after itself. For the first event of a new academic year, paste it at the very top instead. The page puts them in the right order for visitors.
3. Change `id` (lower case, hyphens, unique), `school_year` (a field name only), `name`, `month` (a short English month), `year`, `when`, `summary` (one or two plain sentences for a prospective parent), `did` (what students did: performed, hosted, ran stalls, led activities) and `photos` (slugs). Remove `page` unless the event has its own page. <!-- allow -->
4. Fill the `vi` block with the same facts in Vietnamese (`month` in the "Th9" style).
5. Add a Vietnamese caption for each new photo slug in `_data/altVi.json`.
6. Run `npm run check:vi`, look at `/events/` and `/vi/events/` on the laptop, commit, push.

> **Ask Claude:** "Add the Halloween 2026 event to the website's Events page from the website list I downloaded from The Current, in English and Vietnamese, and show me both pages on the laptop before you commit."

### Adding an event page

Two events have a page of their own: Mid-Autumn 2026 (built 14 October 2026) and the Quarter 1 Showcase 2026 (built 16 October 2026). Bowen asks for each one; an event does not get a page by default. A new one copies one of the two. The Showcase page also shows a class's slides as a PDF (`assets/docs/`), and its sections show only photos that have been built, so the page can go live before the photos are signed off and fill in later.

1. Copy `events/mid-autumn-2026.njk` to `events/<new-id>.njk`. Change the front matter (`title`, `description`, `permalink: /events/<new-id>/`), keep `tone: navy`, and rewrite the sections. Every collage block must reset its four options first (see the collage note under "Images and the photo pipeline").
2. Copy `vi/events/mid-autumn-2026.njk` to `vi/events/<new-id>.njk` with `permalink: /vi/events/<new-id>/` and the Vietnamese text.
3. In `_data/events.json`, give the event `"page": "/events/<new-id>/"`. The list then shows a "The full story" button.
4. Optional: a notice in `reel.json` or a card in `announcements.json` that links to it.

> **Rule:** the Mid-Autumn charity is "Da Nang Go" (its Facebook page is facebook.com/dananggo.org). Never link the domain dananggo.org, which is an unrelated website. Do not name the lion dance troupe or credit the photographer. On the Quarter 1 Showcase page, never mention that the showcase was moved because of the rain. Children's names never go on the public site.

> **Ask Claude:** "Make an event page for Tết 2027 on the website, copying the Mid-Autumn 2026 page, in English and Vietnamese, with only photos already signed off in The Current. Show it to me on the laptop before you commit."

### Adding a post to the Student Blog

The Student Blog ("Blog học viên" in Vietnamese) is the student writing blog at `/writing/`, under About Us in the menu. It was called The Palm Press until Bowen renamed it on 16 October 2026; the address stayed `/writing/`. On 16 October 2026 the same rename in The Current's newsletter editor was committed but not yet deployed. The first post went live on 10 October 2026.

1. Put the student's pictures in `originals/writing/<yyyy-mm>-<student>/`, add them to `originals/picks.json` with descriptive slugs and captions, and run `node scripts/images.mjs`. A photo showing a child who may not be shown gets a `region` crop, and the admin sees it before it goes on a page.
2. Copy the existing post file in `writing/` to `writing/<slug>.njk`. Keep `tags: writing`; set `title`, `description`, `date` (YYYY-MM-DD), `author` (first name only), `subject` (the class), `cover` (a photo slug) and `summary`.
3. Paste the student's text as written. Only spacing and punctuation are tidied; words, capitals and spelling stay the student's (Bowen, 10 October 2026). Write a short, plain "A note from PRA".
4. Copy the post to `vi/writing/<slug>.njk` with `tags: writingVi`, a Vietnamese `description`, `summary` and note. The student's English text stays in English on both pages.
5. Add Vietnamese captions in `altVi.json`, run `npm run check:vi`, look at `/writing/` on the laptop, commit, push. The list page picks up the post by itself, newest first.

> **Ask Claude:** "Add a Student Blog post from the text and photos in my Downloads folder, with the student's words unchanged, in English and Vietnamese, and show me the page on the laptop."

### The Palm River Post pages

The weekly newsletters are written in The Current (**Outreach** → [Newsletter](#/newsletter)), not in this folder. When an issue is published there, the website gives it a page under `/newsletter/`, in English and Vietnamese. The hub page is titled The Palm River Post and sits under About Us in the menu (it moved there from Admissions on 16 October 2026). The newest issue also gets a line in the reel and a "Latest newsletters" card on the schedule page.

- A published issue appears on the website at the next build: the nightly one at 02:30 Vietnam time, or any push before then. To publish it sooner, open the repository on GitHub, **Actions** → **Deploy to GitHub Pages** → **Run workflow**. Since 22 October 2026 the `newsletter-build` function starts this build by itself when an issue is published in The Current (see [Behind the scenes](#/handbook/behind?s=the-facebook-function)), so the page is usually up two minutes later.
- A scheduled issue goes into the database ten minutes before its email, and the mailer in admin@ starts the build then, waiting up to 15 minutes for the page before it sends. If the build cannot start (the GitHub key has expired, say), the email still goes at its time, but its link to the page shows nothing until the nightly build.
- To correct a published issue, change it in The Current and publish again; the fix shows after the next build. Never edit an issue in the website files.
- Keep the address `/newsletter/`. It was kept on purpose when the hub was renamed, because issue links and The Current use it.
- Parts meant only for families never reach the website.
- Who writes the two newsletters (The Palm River Post to every family, the Early Years Weekly Newsletter to Nursery and Kindergarten) and how an issue is published are in [The Current, tab by tab](#/handbook/the-current).

> **Ask Claude:** "I published this week's newsletters in The Current. Start the website build now and tell me when both issue pages show on pra.edu.vn in English and Vietnamese."

### A notice in the reel

The reel is the one-line navy pill under the menu on every page, from `_data/reel.json`. Each item has `id`, `text`, an optional `url` and `link` label, a `hideFrom` date (YYYY-MM-DD, Vietnam time) and a `vi` block. On its `hideFrom` date the notice disappears by itself, with no rebuild. To add one, copy an item, change the words and the date, and leave out `url` for a notice that links nowhere. To retire one early, delete the item and push.

> **Ask Claude:** "Add a notice to the website reel saying the campus is closed on Monday 2 November for a public holiday, in both languages, hidden from 3 November, and push it."

### The noticeboard cards

The cards under the home hero come from `_data/announcements.json`. Each has `id`, `kind` (the small word above the title: Photos, Coming up, Term dates or Offer), `tone` (sun, blue, violet, green), `title`, `when`, `text`, an optional `note`, a `cta` (button label and link), an optional `flyer` (a photo slug that opens full size) and a `vi` block. Cards do not expire: when an event has passed, delete its card by hand. Flyer pictures go in `originals/flyers/` and are built like any photo.

On 16 October 2026 the four cards were:

| Card | Kind | Take it down |
|---|---|---|
| Quarter 1 Showcase photos (links to the event page) | Photos | when a newer event's photos replace it |
| Thanksgiving lunch, Thursday 26 November, families invited (links to the Quarter 2 Week 1 Palm River Post) | Coming up | after 26 November 2026 |
| 10% and 15% off the Global Program | Offer | when the offer ends in December 2026 |
| 35% off Nursery and Kindergarten | Offer | when the offer ends (December 2026 in the notes; the card itself says "Limited time offer") |

To add a card, copy one, change every field in both languages, and keep three or four cards in all: they sit two across on a laptop and as a sideways strip on a phone. Dates for a "Coming up" card come from the newsletter or the calendar; when they disagree, ask before choosing.

> **Ask Claude:** "Remove the Thanksgiving card from the website's home noticeboard, in both languages, and push."

### Changing a staff card

Names and titles are in `_data/team.json`: `name`, `slug`, `role`, the `vi` role, a `tint` colour from 1 to 6 and optional `shots` (slugs of photos showing the person at work). Cards show the name and title only, no line under them. The order (Bowen, 7 October 2026): Ms. Xuan (Owner), Mr. Seth (Head of Academy), Ms. Hien (Operations Manager), Mr. David (Deputy Head Teacher), Mr. Bowen (Upper Secondary Coordinator), Ms. Solo, Mr. Caleb and Ms. Kiu (Primary Homeroom Teachers), then Ms. Thanh, Ms. Tham, Ms. Duyen, Ms. Thắm V and Ms. Thoa, all titled "Teaching Staff" ("Nhân viên giảng dạy"). Nursery staffing is not described anywhere. Mr. Landon, Ms. Thuy and Ms. Ali are not listed until Bowen confirms.

A new photo: put it in `originals/staff/`, add a line to `originals/portraits.json` (same `slug` as in team.json), add the person to `team.json`, run `python scripts/portraits.py <slug>`, then check the review sheet it writes at `originals/_review/portraits-sheet.jpg`. The script frames every face the same way and cuts the person out; see "Images and the photo pipeline".

> **Careful:** never decide who a teacher is from a thumbnail. Two photos once went on the wrong card. Look at full size and compare before adding a `shots` photo.

> **Ask Claude:** "Add our new teacher to the website's team as Teaching Staff after Ms. Thoa, with the name and photo I saved in my Downloads folder, run the portraits script for her, and show me the About page and the review sheet."

### Adding a review

Reviews are in `_data/reviews.json`. The top of the file has `rating` (4.6 on 10 October 2026), `count` (27), a `checked` date and the Google Maps link. Each item has `name` (first name and last initial), `lang` (en or vi), `pull` (one line copied exactly from the review, shown on the home carousel) and `paras` (the full text). The rules in the file: a review stays in its own language; where a reviewer called PRA by the word the site never uses, the replacement goes in [square brackets]; cuts are marked with an ellipsis; a child's diagnosis never goes on the site; the `pull` line must be an exact piece of the review. Update `rating` and `count` from the Google listing now and then. The review text is saved from Google by a person and handed to Claude; Claude does not copy it from the web.

> **Ask Claude:** "Add the two new Google reviews I saved to Downloads to the website's reviews file, update the rating and count to what the listing shows, and show me the About page."

## The Vietnamese pages

- Every public page exists twice: English at its usual address, Vietnamese at the same address under `/vi/`. The source files mirror each other: `learning/primary.njk` and `vi/learning/primary.njk`. The **EN | VI** switch at the end of the header links each page to its twin.
- Data files are shared. Each item in a JSON file carries a `vi` block with the same field names, and the Vietnamese page reads the same template with the Vietnamese words merged in. That is why a change to an English field needs the same change in the `vi` block.
- Not translated: the photo album, the forwarding stubs, robots.txt, sitemap.xml and the newsletter preview page that The Current's editor shows (`newsletter/preview.njk`, hidden from search engines). The 404 page is one page in both languages. Vietnamese pages use the Be Vietnam Pro font because Poppins has no Vietnamese letters.
- When adding a page: copy `x.njk` to `vi/x.njk`, translate the words only, and if the English front matter has a `permalink`, give the twin the same one under `/vi/`.

### The check

`npm run check:vi`, run in `C:/Users/sbowe/pra-website` after any text change, lists: English pages with no twin; twins whose photos, links, sections or address no longer match; data items with no `vi` block or a `vi` block missing a field; photos with no Vietnamese caption; Vietnamese pages last committed before their English twin changed; and the words never used. It does not stop a deploy; it is a reminder. On 16 October 2026 it reported three known, harmless lines, "missing page" for `src/vi/robots.njk`, `src/vi/sitemap.njk` and `src/vi/newsletter/preview.njk`; those three files are not pages a visitor reads and need no twin. Anything else it reports is real, including a "last committed before" warning, which means the Vietnamese twin may no longer say what the English says.

### The rules

The reference is `VIETNAMESE.md` in the repository. In short:

- PRA is "trung tâm", "Palm River Academy", "PRA" or "chúng tôi" now and then. The full name, as on invoices: "Trung tâm Anh ngữ Palm River Academy".
- For PRA, never "trường" in any form and never "học sinh"; students are "học viên", and to a parent "con", "các con", "các bé" (the youngest) or "các em" (Secondary). A child's previous school abroad can still be a "trường". <!-- allow -->
- Program, class and year-group names stay in English (Early Years, Primary, Lower Secondary, Global Program, Year 7). Subjects are translated (Toán, Khoa học); English is "tiếng Anh".
- Write it as a Vietnamese front-desk colleague would say it to a parent, in whole sentences with a subject and a verb, asking politely ("Ba mẹ vui lòng ..."). Parents are "ba mẹ". Use central and southern words for Hội An families: bị bệnh, dù, hồ bơi, vớ. The first translation of 29 September 2026 followed the English word for word and staff called it awkward; the rewrite of 30 September 2026 is the standard now.
- Numbers with dots ("33.500.000 VNĐ"), 24-hour times ("14:30"), dates "thứ Sáu, 25/9". No marketing words (toàn diện, năng động, hành trình, chắp cánh and the rest of the list in `VIETNAMESE.md`).

### Before a push

> **Rule:** a Vietnamese member of staff reads any new Vietnamese copy before it goes live. Text that staff supply goes in word for word, not improved.

As of 16 October 2026 these had gone live without a staff read: the reel, the guidebook card, the calendar key, the blog's shared words and the note on the first post, the Mid-Autumn 2026 event page, the enrollment form's medical and consent text, the title "Teaching Staff", the fee lines of 8 October 2026, the review fixes of 15 October 2026, and everything from 16 October 2026: the Quarter 1 Showcase page, the newsletter pages and their menu words, the name "Blog học viên" and the Thanksgiving card. Staff have also not confirmed "Chủ sở hữu" (Owner) and "Phó giáo viên trưởng" (Deputy Head Teacher), which read stiffly.

> **Ask Claude:** "Run the website's check:vi and tell me in plain words what it found, leaving out the three known missing-page lines."

## Copy rules

The full list is in [Rules and wording](#/handbook/rules); the ones that bite on the website:

- PRA is an English language center. Never the word the center never uses, in English or Vietnamese, for PRA, its office, kitchen, day or year. Other institutions can be what they are: a child's previous school, a university abroad.
- Never mention Cambridge Checkpoint tests. No Year 8 / Year 9 split: Lower Secondary and Upper Secondary only. Range labels such as "Years 7 to 9" in the menu and fee table were left in place; ask before changing them.
- No class counts (how many periods or days a week a class runs) and no full timetables. No class-size number anywhere: "small classes", "lớp ít học viên" (Yvonne's edit, 8 October 2026).
- Upper Secondary: no Cambridge pathway, no IELTS, PTE or GED, no US diploma, no exams or accreditation named. IGCSE is not named on Lower Secondary.
- Events copy is for prospective parents: one summary line plus what students did; no attendance numbers, staff roles or lists of game names. Anti-Bullying Week stays off the page.
- Short sentences, plain words, the specific thing (2017, Cẩm Thanh, cooking on Thursdays). Say it once. No closing flourish on a paragraph, no rhetorical question headings, none of the banned English words (unlock, empower, nurture, holistic, vibrant, journey, thrive, world-class, seamless, foster, passionate, dynamic, transformative). Bowen rejects copy that reads as AI at sight (24 September 2026).
- The yearbook film is credited to the "Yearbook Team", never a year group.
- Facts to keep straight: founded 2017; one campus, Trần Nhân Tông, Cẩm Thanh, Hội An; the old ĐX18 campus is not used; a trial day is 1,600,000 VND, meals included, up to three days, taken off tuition if the child enrols; there is no development fee on the site; Global Program prices are "Ask us for a price".

## Images and the photo pipeline

- **Originals** are in `C:/Users/sbowe/pra-website/originals/`, about 2 GB and not in git. Keep a backup copy on Google Drive. Inside are the Wix exports, the class photo dumps, `events/<date> <event>/` (with `curated/` for what The Current signed off), `flyers/`, `staff/`, `writing/`, `yearbook/` and working folders. Three small files inside it are in git and matter: `picks.json` (every photo the site uses and how to crop it), `portraits.json` (the staff portraits) and `README.md`.
- **From picks.json to the page.** Each entry has `src` (path under originals), `slug` (descriptive, lower case, hyphens), `alt` (a plain sentence) and optional crop settings. `node scripts/images.mjs`, run in the repository folder, writes three sizes of each photo into `src/assets/img/photos/` and updates `src/_data/photos.json`. Only new slugs are built; `--force` rebuilds everything. Pages show a photo by its slug; an unknown slug shows a grey placeholder instead of breaking.
- **Photos from The Current.** The office picks photos for the website inside The Current: [Photos](#/photos) → an event → **Website** → **Download the list**. Every photo on that list has passed the no-photo list, which is the only route for a child's photo onto the site (see [Photos and Facebook](#/handbook/photos)). Then `node scripts/add-event-photos.mjs <the downloaded file>` (add `--dry-run` to see what would change) copies each photo into `originals/events/<date> <event>/curated/`, adds it to `picks.json`, removes any photo the list says to take down, and runs images.mjs. After that: slugs into `events.json` (or onto the event page), Vietnamese captions into `altVi.json`. The script never commits. Until the result is committed and pushed, the live site has none of the photos; when photos are signed off but the site shows none, look for uncommitted files first (Bowen met this on 16 October 2026).
- **Taking a photo down** removes it from the site at the next push, but it stays in the public git history. A photo that must be gone for good needs the history rewritten; tell Claude that is what you need.
- **Staff portraits.** `python scripts/portraits.py` (or with slugs for a few; `--sheet` writes the review sheet). A face detector frames every card the same way, a cutout model removes the background, and a gentle colour correction evens exposure and white balance. No face retouching, never a faded bottom edge. It needs Python with a few packages and two model files (about 1 GB, kept outside git); Claude knows the list. Do not switch the cutout model to "bria": its licence is non-commercial.
- **Restart the preview server** after running images.mjs or portraits.py. It reads the photo lists only when it starts; a stale server shows grey placeholders and old captions and can overwrite a fresh build.
- **Collage note, in one line:** a collage block takes four options (`collageWide`, `collageArt`, `collage2up`, `collageCredit`) and every page must reset all four before every collage, or a caption from one leaks into the next (this bit on 23 September 2026).
- **Look and feel:** blue #116DFF and green #48971D are the identity; stage colours (sun, green, blue, coral, violet) are small markers only, never a page or a button; no yellow bands; Poppins type; the palm frond is the one motif. Pages set `tone:` (blue, green, navy, light) in their front matter. Home under 500 KB, other pages under 300 KB. The design is written up in `PLAN.md` section 5.

> **Ask Claude:** "Here is the website list I downloaded from The Current for the Tết event. Run it as a dry run first, show me what would change, then add the photos and the Vietnamese captions."

## The forms

The site has no server of its own. Each form sends its answers from the visitor's browser straight to The Current's database through one allowed function, using a public key kept in `_data/site.json` under `forms`. That key is public by design and allows these calls and nothing else; it still never goes into a document.

- **Contact / Book a tour** (`/contact/`): name, email, phone or Zalo or WhatsApp, the child's age, what they want (a tour, a video call, Global Program information, a question), a weekday and morning or afternoon for tours and calls, and a message. In The Current the message appears on [Leads](#/leads) in a "From the website" panel; a new email address makes a new lead (source "website"), a known one is attached to the existing family. The same message twice in ten minutes is kept once; at most 5 an hour per address and 40 an hour overall. The family gets a thank-you email and Yvonne and admin@ an alert, sent by The Current's mailer in admin@ (see [Students, families and enrollment](#/handbook/students?s=the-emails-after-a-form)); the triage also lists new messages in its digests (see [The inbox and the triage](#/handbook/inbox)). If the call fails, the page shows "That did not send" with the email and WhatsApp links.
- **Enrollment form** (`/admissions/enroll/`): five steps (student; parents and emergency contacts; education and health; photos and pick-up; contract, documents, signature). Answers stay in the browser tab until sent, so a reload loses nothing. Attached documents (photo, passport or ID copies, the last progress report) go to a private storage folder; then the answers are saved. In The Current the form appears under **Office** → [Enrollments](#/enrollments) and the child becomes a pending student; the family gets a thank-you email and Yvonne and admin@ an alert; the family's details are kept for "Enroll another child". Since 5 October 2026 every office account can read the documents and ID numbers; deleting stays with the super admin. The admission contract is English on both pages until PRA supplies a Vietnamese text. See [Students, families and enrollment](#/handbook/students).
- **The email slip check** on both forms: when a visitor leaves the email box, a one-letter slip of a well-known domain ("gmai.com", "hotmial.com") shows "did you mean gmail.com?" with a button to fix it. It is a warning only; the form sends whatever is in the box. The list of known domains at the top of `assets/js/main.js` must be kept the same as The Current's copy.
- **The robot trap:** both forms have a hidden box people never see; a form with it filled in is thrown away silently.
- The privacy page describes both forms and must stay true if they change.

### If a form stops saving

1. Try it yourself from a phone and from a laptop, with a message that says TEST so the office can mark it done.
2. If the page shows "That did not send": check that https://current.pra.edu.vn is up, and that the visitor has a working connection (the form needs JavaScript).
3. The enrollment form failed on 1 October 2026 because the live database table was missing a column the function writes; a SQL file in the admin repository fixed it. If forms fail after a database change in The Current, suspect that first. The database functions and their SQL files are in the admin repository (`C:/Users/sbowe/admin`, folder `supabase/`): the files dated 30 September 2026 for the contact form and the enrollments, plus the later fix files.
4. Until it is fixed, families can email admin@palmriveracademy.edu.vn or message on WhatsApp; both links are already on the form's error note.
5. If the database project or its public key ever changes, the three values under `forms` in `site.json` change with it, and the site is pushed.

> **Ask Claude:** "The enrollment form on the website shows 'That did not send'. Check The Current is up, probe the two form functions, compare the live table's columns with what the functions write, and tell me what is wrong before you change anything."

## Domains and DNS

| Domain | What it does | DNS is managed at | Records that matter |
|---|---|---|---|
| pra.edu.vn | The website; `current.pra.edu.vn` is The Current | P.A Vietnam (pavietnam.vn); the login is held by Bowen | Four A and four AAAA records for GitHub Pages on the bare name; `www` and `current` are CNAME records to bowenpra.github.io; MX and TXT records for Google Workspace mail and a Google verification |
| palmriveracademy.edu.vn | Forwards every old page to pra.edu.vn with real 301 redirects; carries admin@ mail | Wix nameservers (the domain is registered at P.A Vietnam) | An A record to Netlify, `www` a CNAME to the Netlify project; MX, SPF and `_dmarc` for Google mail |
| palmriveracademy.com | The old Wix site, untouched | Wix | Renews 29 April 2028. Bowen (6 October 2026): do not redirect it, leave it alone |

> **Careful:** the MX and TXT records on both .edu.vn domains are PRA's email. Change or delete one and admin@ stops receiving mail. Never touch them, and verify with a DNS lookup before and after any other change. A snapshot of the palmriveracademy.edu.vn records from before the redirect is in the redirect repository as `dns-before-2026-10-06.txt`.

- HTTPS on pra.edu.vn has been live since 29 September 2026 (the certificate comes from GitHub Pages once the DNS points at it). www.pra.edu.vn redirects to the bare name. Google Search Console has a Domain property for pra.edu.vn, verified on 6 October 2026 with a TXT record at P.A Vietnam; keep that record.
- The redirect for the old domain is its own small repository, `C:/Users/sbowe/pra-redirect` (GitHub BowenPRA/palmriveracademy-redirect), hosted on Netlify since 7 October 2026 under Bowen's account there. `make.mjs` holds the map of old Wix addresses to new pages; `node make.mjs` writes the pages; a change is committed, pushed and then deployed to Netlify with the command in that repository's README. The GitHub Pages copy of the same repository is a leftover fallback that can be retired with Bowen's say-so, and the folder `C:/Users/sbowe/pra-redirect-www` is an unused copy that can be deleted.
- Who pays: GitHub Pages and Netlify are on free plans as far as the notes record. Both .edu.vn names renew at P.A Vietnam, whose notices go to admin@palmriveracademy.com (which lands in the admin@ inbox).

| Renewal | Date (from the project notes; not checked since 15 October 2026) |
|---|---|
| Wix Premium plan (USD 118.80 a year), which holds the old domain's DNS | 12 February 2027; the charge may come from about 22 January 2027 |
| palmriveracademy.edu.vn at P.A Vietnam | paid to 30 May 2027 |
| pra.edu.vn at P.A Vietnam | renewed 15 July 2026, so due around July 2027 |
| palmriveracademy.com at Wix | paid to 29 April 2028 |

> **Rule:** do not cancel Wix, or let it lapse, until the DNS records of palmriveracademy.edu.vn (the Google mail records above all) have been copied to P.A Vietnam and the domain's nameservers moved there. The admin@ inbox depends on those records, and they live in the Wix account today. The steps were written for To-Do #40 on 2 October 2026; on 15 October 2026 the DNS was still at Wix.
- The Google Workspace side of the domains, the accounts and the admin addresses are in [Google Workspace and domains](#/handbook/google).

> **Ask Claude:** "Look up the DNS records for pra.edu.vn and palmriveracademy.edu.vn and tell me whether the Google mail records and the website records are still what the handbook says."

## Running it on the laptop

The site needs Node.js and npm (installed on the laptop; GitHub builds with Node 22). Python is needed only for the photo scripts.

1. First time only, in PowerShell: `npm --prefix C:\Users\sbowe\pra-website install`.
2. Start the preview: in the folder, `npm run dev`. Open http://localhost:8080. Edits under `src/` rebuild by themselves; refresh the browser.
3. Build once without a preview: `npm run build` (writes `_site/`). This is the same command GitHub runs.
4. Check the Vietnamese: `npm run check:vi`.
5. After `node scripts/images.mjs` or `python scripts/portraits.py`, stop and restart the preview.
6. Phone view: Chrome's device toolbar (F12). The in-app browser pane pauses animations when it is hidden, so the carousel and the reveals are checked in a normal Chrome window.

In PowerShell run one command at a time with full paths; `&&` does not work there. A commit message with backticks is put in a file and committed with `git commit -F`, because a quoted string in the shell eats the backticks (two pushed messages lost a word that way).

> **Ask Claude:** "Start the website preview on the laptop and open the fees page in both languages so I can read them."

## Open items

As of 16 October 2026, from `PLAN.md` and the repository notes:

- The Quarter 1 Showcase page carries a Year 1 slides PDF with many photos of children. It went live on Bowen's word on 16 October 2026 without a check against the no-photo list. Have the office check it, or take the PDF off the page.
- Quarter 4 start: the fee sheet says 29 March, the calendar 25 March. The site gives the 22 March payment date and uses 25 March as the Quarter 4 start.
- Trial day price: settled at 1,600,000 VND (Seth, 2 October 2026). The site and the triage use it; the Word original of the admissions SOP said 1,500,000 (not checked since 15 October 2026).
- Parent and teacher meeting dates for 2026-27 are not on the calendar.
- Ages: the Global Program says 2 to 14; the Early Years page says 20 months to 4. Bowen to confirm.
- Mr. David's title ("Deputy Head Teacher" / "Phó giáo viên trưởng"): Bowen asked whether to change it, no answer.
- Ms. Duyen's portrait is a low-resolution original; Bowen's, Ms. Tham's and Ms. Thắm V's are 600-pixel Wix squares. New photos would help.
- Whether IGCSE should come back on Lower Secondary.
- A Vietnamese text for the admission contract. Whether a birth certificate should be named for children with no passport or ID.
- The staff read of all recent Vietnamese (see "Before a push").
- The footer email is admin@palmriveracademy.edu.vn while the admin@pra.edu.vn decision is open (see [Google Workspace and domains](#/handbook/google)).
- Retire the GitHub Pages fallback of the redirect repository and delete the unused www copy (Bowen's say-so).
- The noticeboard cards need pruning by hand when their dates pass; the Thanksgiving card first, after 26 November 2026.
- Planned, not built: a calendar `.ics` export; a public photo gallery page (the `/album/` page is internal); a 2026-27 family guidebook when one exists; Google Business Profile link and address wording after the 2025 ward changes.
- The old Wix maths pages redirect to the home page; Bowen never said whether they should go elsewhere.
