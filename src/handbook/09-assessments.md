The Assessments library is every assessment paper PRA uses in Mathematics, Science and English for Years 1 to 9, kept on the shared Google Drive and listed in The Current on the **Assessments** tab. This chapter says what is in it, how teachers find a paper, and how new papers are added. Open it when a teacher cannot find a paper, at the start of each quarter when that quarter's PRA assessments are added, and when someone asks for "the reviews".

## What is in the library

- About 900 PDFs (902 on 1 October 2026, about 736 MB). The Assessments tab lists 588 assessments; each has its paper and, where there is one, its mark scheme, insert or audio script.
- Only PDFs. Nothing is printed from the tab itself: every file opens on Google Drive.

| Kind | Where it comes from |
|---|---|
| Diagnostic | Cambridge GO: the test at the start of a course |
| End of unit | Cambridge GO: one per unit (quizzes and tests) |
| Mid-year | Cambridge GO |
| End of year | Cambridge GO |
| Progress test | Cambridge GO: the Global English progress tests and quizzes, some in listening, reading and writing parts |
| PRA progress review | PRA's own quarterly assessments, the ones whose scores go on the progress reports. Older ones came from the shared drive's test folders, new ones from the teachers |
| Baseline | PRA's own start-of-course assessments, from the shared drive's test folders |
| Review packet | PRA's practice packets that go home before an assessment (two so far: Year 7 Quarter 1 Maths and Science) |
| Progression test | Cambridge progression tests, from the shared drive |
| Sample paper | Cambridge sample papers, from the shared drive |
| Checkpoint | Cambridge Checkpoint papers, from the shared drive |

- The Cambridge GO material covers 27 courses: Global English 1 to 9, and Primary and Lower Secondary Mathematics and Science 1 to 9.
- Cambridge's first-language English papers are left out, unless PRA used them (end-of-year papers, baselines) or they are Checkpoint papers.
- The Cambridge papers came from Cambridge GO on 1 October 2026. Who holds the Cambridge GO login is not recorded (Bowen or Seth).

> **Rule:** Checkpoint papers are in the library for teachers. Checkpoint is never mentioned on the public website (see [Rules and wording](#/handbook/rules)).

## Where the files are

- The PDFs are on the shared drive **PRA Shared Drive**, in **Program curricula** → **Assessments Library** → subject → **Year N** → kind. For example: Maths → Year 5 → End of unit.
- Every file has a readable name, for example "Y5 Maths - End-of-unit test 3 - Test paper.pdf".
- Only members of the PRA shared drive can open them. A teacher who gets "You need access" is not a member: add their pra.edu.vn account to the shared drive in Google Drive. Their role on the shared drive decides whether they can only view or also edit.
- On the admin laptop the shared drive is also a drive letter, through Google Drive for desktop: `G:\Shared drives\PRA Shared Drive\Program curricula\Assessments Library`.

Inside each subject's **Year N** folder, the kinds have these folder names:

| Kind | Folder |
|---|---|
| Diagnostic | Diagnostic |
| End of unit | End of unit |
| Mid-year | Mid-year |
| End of year | End of year |
| Progress test | Progress tests |
| PRA progress review | PRA progress reviews |
| Baseline | PRA baselines |
| Review packet | PRA review packets |
| Progression test | Progression tests |
| Sample paper | Sample papers |
| Checkpoint | Checkpoint |

> **Careful:** the shared drive holds the mark schemes next to the papers. Before adding anyone to the PRA shared drive, check that they are staff.

Why not in The Current itself: The Current's code and website are public, and Cambridge's papers must not be published. Bowen first asked for the papers in the project on 1 October 2026; when that turned out to mean making them public, he chose the shared drive. The database holds nothing about assessments.

## The list in The Current

- The Current holds only the list: `public/assessments/catalog.json` in the admin folder. It names each assessment, its years, its subject, its kind and the Google Drive address of each file. There is no paper in it, so it can be public.
- The list is built on the laptop by a script, `scripts/assessments/build_catalog.py` in the admin folder. It reads the source PDFs kept in the admin folder's private part (never published), sorts them by subject, year and kind, removes copies of the same file, copies each file to the Assessments Library on the shared drive under its clear name, and writes the list and a review sheet of everything it did.
- A second script, `gather_downloads.py` in the same folder, collects new Cambridge GO downloads from the Downloads folder and unpacks them for the build.
- Each file's Drive address is looked up once it is on Drive. Until then, the tab opens a Drive search for the file's name instead (every name in the library is unique, so the search finds it).
- The tab's footer says when the list was built. On 16 October 2026 it still said 1 October 2026, although the Year 7 Maths paper had been updated since.

## The Assessments tab

**Teaching** → **Assessments**. Everyone can open it: teachers and office accounts.

1. A teacher starts on **My classes**, the year groups and subjects ticked for them on the Teachers page. **Everything** shows every year. The class pills narrow it to one class.
2. **Subject**, **Year** and **Type** narrow the list. **Clear filters** resets them. The filters are remembered on that device.
3. The search box takes words such as "y5 unit 3", "listening" or "checkpoint 2024".
4. Each assessment opens to show its files: **Paper**, **Mark scheme** and so on. Every file opens on the shared Google Drive ("Opens on the shared Google Drive (PRA accounts only)").

The **Type** filter groups the kinds into three families:

| Family | Kinds |
|---|---|
| Through the year | Diagnostic, End of unit, Mid-year, End of year, Progress test |
| PRA reviews | PRA progress review, Baseline, Review packet |
| Cambridge papers | Progression test, Sample paper, Checkpoint |

### Using a paper

What to tell a teacher who asks how to find and print a paper:

1. Sign in to Google in the browser with your pra.edu.vn account. A personal Gmail account cannot open the files.
2. Open The Current, **Teaching** → **Assessments**. Your own classes show first.
3. Pick the class, then the type, or type a search such as "y5 unit 3".
4. Open the assessment and press **Paper**. It opens in Google Drive's viewer, which has a print button and a download button.
5. Open **Mark scheme** the same way when marking.
6. The review score for a progress report is the raw score out of the paper's total, typed into the report as, for example, "40/50" (see [Progress reports](#/handbook/reports)).

## "Reviews" means the assessments

At PRA a "review" is a test. When Bowen, Seth or a teacher asks for "the Q1 reviews", "the review database" or "the Year 7 reviews", they mean the assessment papers: PRA's progress reviews, whose scores go on the progress reports. They do not mean the review packets, which are the practice sheets that go home before the assessment.

On 1 October 2026 Bowen asked for his Year 7 Quarter 1 reviews to be added. Claude added the practice packets, because their titles said "Q1 Review". He wanted the assessments. Both are in the library now, as different kinds.

> **Rule:** if a request could mean the assessment or the practice packet, ask which before doing anything.

## Adding new papers

New papers come in two ways: a quarter's PRA progress reviews, which a teacher writes, and new Cambridge material downloaded from Cambridge GO. Either way, Claude adds them on the laptop. A file uploaded straight into the Assessments Library folder on the drive is not picked up by the build and will not appear on the tab.

1. Collect the PDFs: the test paper and the mark scheme for each assessment, as separate files. For Cambridge GO, download them into the Downloads folder.
2. Tell Claude what they are: subject, year, quarter and units, and whether each is an assessment or a practice packet.
3. Claude files them in the private source folder under the library's naming rule, runs the build, checks the review sheet, and the build copies the new files to the Assessments Library on the shared drive.
4. Claude looks up the new files' Drive addresses and adds them to the list.
5. Claude deploys The Current. The tab shows the new papers about two minutes later.
6. Open the tab, find the new papers and open each file to check it.

> **Ask Claude:** "Add the Year 7 Science Quarter 2 assessment to the Assessments library. The test paper and mark scheme are in my Downloads folder. It covers Units 3 and 4. Rebuild the catalog, check the files are on the shared drive, and deploy The Current."

> **Ask Claude:** "I downloaded new Cambridge GO files into Downloads this morning. Gather them into the Assessments library, rebuild the catalog, tell me what was added, and deploy The Current."

### A quarter's PRA progress reviews

Adding the quarter's own assessments is one of the jobs of each quarter (see [The year at PRA](#/handbook/the-year)). The Year 7 Quarter 1 2026 assessments show the pattern:

- **Source files**, one PDF each, named by year, subject, kind, units and part: "Y7 Maths - Assessment - Units 1-3 - Test paper.pdf" and "Y7 Maths - Assessment - Units 1-3 - Mark scheme.pdf". A practice packet is named "… - Review packet - Units 1-3 - Student copy.pdf" and "… - Answer key.pdf".
- **The session**, the quarter they belong to, written "Quarter 1, 2026-27".
- **On the tab** they appear as **PRA progress review**, titled "Quarter 1 assessment · Units 1–3", with a **Paper** and a **Mark scheme**.
- **On the drive** they sit in Maths → Year 7 → PRA progress reviews.
- **The originals** of Bowen's Year 7 assessments are in `C:\Users\sbowe\Desktop\Y7Tests`, one folder per subject. They are kept out of his public lessons project on purpose, because that project is public.

Hand Claude the files with their names in this form, or tell Claude the year, subject, units and quarter and let it name them.

### Replacing a paper that is already there

The build copies a file to the drive only when its name is not there yet. An edited paper with the same name is therefore not copied. Copy it over the old file in the drive folder on `G:` instead: Google Drive keeps it as a new version of the same file, so the link in the list still works. Then ask Claude to update the page count and size in the list and deploy. This was done for the Year 7 Maths Quarter 1 paper in October 2026, which now has a blank last page for double-sided printing.

> **Ask Claude:** "I replaced the Year 7 Maths Quarter 1 test paper on the shared drive with a new version. Update its details in the Assessments catalog and deploy The Current."

> **Careful:** do not rename or move files inside the Assessments Library by hand. The build looks for each file by its name, so it would copy a renamed file to the drive a second time at the next build.

## What is still open

- **The review packets.** On 1 October 2026 Claude asked Bowen whether the two Year 7 Quarter 1 review packets should stay in the library. There was no answer (not checked since 15 October 2026). They are listed under "PRA reviews" as **Review packet**.
- **A leftover file.** An unused key file from an abandoned plan to encrypt the papers sits in the admin folder's private part. Claude's attempt to delete it was blocked; it is safe for a person to delete.
- **Only Years 1 to 9.** There is nothing for Upper Secondary or Early Years, and only Mathematics, Science and English.
- **The footer date** does not follow later edits to the list.

## What can go wrong

| What you see | Why | What to do |
|---|---|---|
| "You need access" on Google Drive | The person is not a member of the PRA shared drive, or is signed in to Google with a personal account | Add their pra.edu.vn account to the shared drive, or have them switch accounts |
| A Drive search opens instead of the file | The file's Drive address was never added to the list | Ask Claude to look up the address and deploy |
| A teacher's **My classes** is empty or wrong | Their Teachers row does not tick that subject and year | Fix the row on **Setup** → **Teachers**, or use **Everything** |
| A new paper is not on the tab | It went straight onto the drive, or The Current was not deployed after the build | Ask Claude to add it through the build and deploy |
| An edited paper still shows the old version | The build does not overwrite a file of the same name | Copy the new file over the old one on `G:` |
| The same paper is on the drive twice | A file in the library was renamed or moved by hand, and the build copied it again | Ask Claude to find the two copies and say which one the list points to before either is removed |
| "The assessments list could not be loaded" | The list file is missing from the live site, or the connection dropped | Reload; if it stays, ask Claude to check the last deploy |
