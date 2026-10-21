This chapter covers PRA's photos from the moment staff upload them to the moment they are on Facebook or the website: the photo library on the laptop, the privacy rules, how an album is made, the **Photos** tab in The Current, Facebook posts, and photos for the website. Open it after every event, and before any child's photo goes anywhere public. Photos of children cannot be taken back once they are out, so the privacy rules come first.

## Where photos live

| Place | What is there | Public? |
|---|---|---|
| The shared drive: PRA Shared Drive → "PHOTOS BY CLASS 2026-2027" | What staff upload: each class's week folders, one folder per event (for example "20261015 Showcase Term 1"), and the finished albums copied back. Every file is named by Claude (see Class photos each week) | No: PRA accounts only |
| The photo library on the laptop: `C:\Users\sbowe\PRA Photos` | Every event Claude has worked on: copies of the originals, scores, tags, privacy flags, the edited album | No: one laptop |
| The Current's **Photos** tab | Photos still under review, their captions and sign-off, the draft Facebook posts | No: office accounts only |
| The website's git project: `C:\Users\sbowe\pra-website` | Photos signed off and chosen for the website | Yes: anyone, for good |
| PRA's Facebook Page | Posts | Yes |

The database holds only the details about each photo (score, tags, caption, sign-off, website state), never a child's name.

## The photo library

- The library was set up on 28 September 2026. It is one folder per event, named "YYYY-MM-DD Event name". So far: "2026-09-25 Mid-Autumn Festival" and "2026-10-15 Quarter 1 Showcase".
- Inside each event folder: `originals` (copies of what came in, never edited), `_work` (viewing copies and thumbnails), `album` (the finished photos, numbered in order), `catalog.json` (one record per photo: a score out of 10, tags, privacy flags, how it was edited) and `review.html` (an approval page).
- `_house` holds the rules Claude follows: the scoring rubric, the privacy rules, the editing style, the Facebook style, the fixed list of tags, the taste log and the post log. `_tools` holds the programs.
- Tags come from a fixed list on purpose. The long-term aim is a photo gallery on the website that families can filter by stage, class and activity. It is not built yet.
- The house look: each photo gets its own colour correction and a brightness lift, light sharpening, and a careful deblur only on soft stills taken from video. No face retouching. In The Current the looks are called **None** (as taken), **A** (brighter), **B** (brighter still, the house setting) and **C** (B with faces lifted, for close indoor photos of people).
- The photos are judged by eye at viewing size. A face detector counts faces and picks the sharpest shot of a burst. It never recognises anyone.

> **Careful:** the library is on one laptop. The raw photos are also on the shared drive, but the catalogs, the finished albums and the rules exist only there. Copy the whole `PRA Photos` folder to Google Drive or an external disk regularly. Whether this has been done is not recorded (not checked since 15 October 2026).

## The privacy rules

> **Rule:** no child's name anywhere: not in a file name, a caption, alt text, a tag, a post or a catalog.

> **Rule:** nobody is identified from their face. Claude never works out who a child or an adult is from a photo. That is why Claude cannot check the no-photo list.

> **Rule:** only a person signs a photo off against the no-photo list. The list is kept by the office, outside the library. A member of staff who knows the children looks at each photo and ticks it. Claude never ticks it, and never marks a set as checked because someone said so in a chat.

> **Rule:** one student's face must never be shown. Crop it out and show the crop to a person before the photo goes on any page (Bowen, 10 October 2026). The handbook does not name the student; ask Bowen at the handover.

> **Rule:** ask before publishing any photo you are unsure about: consent, faces, anything awkward.

- What a use allows:

| Use | Which photos |
|---|---|
| Internal documents for staff | Any photo |
| Families only (a private album) | Ask about the no-photo list first |
| Public: website, Facebook, flyers | Only photos signed off against the no-photo list, with no privacy flag left open |

- Claude flags each photo for the person signing off: a child's name readable in it, a screen or document that can be read, a child who is upset, an unflattering moment, swimwear or changing (these stay out of public use altogether), anything medical, a member of the public large in the frame, a home address or number plate, a problem a crop would solve, anything else that gave pause.
- A child's name written in the photo itself: names on posters, a class whiteboard, artwork on the wall or exercise-book covers may stay in (Bowen, 28 September and 16 October 2026). They are flagged so the person signing off sees them. Certificates and stage screens have not been decided: ask first.
- Adults in event photos are described as parents. A member of staff is named only when Bowen or the office confirms who it is, from a badge, the clothes they are known by, or the folder, never from the face.
- Photos sent in by parents belong to them. They can go in the album; ask the parent before one goes on Facebook or the website.
- A slide deck, a PDF or a poster full of children's photos is photos. It needs the same sign-off before it goes public.
- Exported photos carry no location or camera details. The originals do, so the originals never go into a public folder.

## What a good photo looks like

Bowen's taste, from 22 September 2026 and the taste log since:

- **Leave out:** close-up phone snapshots of toddlers, anything blurry or dark, the backs of heads, cluttered frames, a child who looks upset, and posters or slides with text, which are not photos of the event.
- **Prefer:** clear, well-lit activity shots, groups, faces visible and happy, and some wide shots of the whole event.
- A camera photo beats a still from a video of the same moment.
- An album has every class that took part, a wide photo to open, and one photo per moment.
- Brighter and richer than a plain colour fix: dim photos read to him as washed out.
- The taste log in `_house` holds every correction he has made, with the date and the photo. Claude reads it before judging photos and adds to it after each review.

## The three photo skills

A skill is a written procedure Claude follows for one kind of job (see [Working with Claude](#/handbook/claude)). Three work on the library. Each is used in a session on the laptop; the only automatic photo work is the Friday run for class photos (next section).

| Skill | What it does | Ends with |
|---|---|---|
| photo-album | Turns a folder of photos into a curated, edited album | An album in the library, a review page, the album copied to the shared drive after your yes, a package for the Photos tab |
| photo-search | Finds photos in the library by what is in them: activity, class, shape, score, signed off or not | Three to six candidates, each with its event, why it fits and whether it is signed off, and which one to use |
| social-post | Prepares one Facebook post: picks and orders the photos, crops them in one shape, writes the caption, other first lines, alt text for each photo and a suggested time | A folder to post from and the caption in the chat. A person publishes it |

### Making an album

1. Tell Claude where the photos are: a folder on the shared drive, or a zip in Downloads. Claude says which folder it is using and how many files are in it before copying anything. Colleagues upload without telling anyone, so the folder may hold more than you expect.
2. Claude copies the photos into a new event folder, sets aside the technical failures (blurred, black), and judges every photo by eye with a one-line description, tags and privacy flags. For more than about 60 photos it splits the judging between helpers.
3. Claude chooses and orders 25 to 40 photos and edits them with the house look. Editing takes about 40 seconds a photo and runs on its own in the background.
4. Claude gives you the review page to approve the choices and the looks. You may skip it and decide in the Photos tab instead.
5. After your yes, the album is copied to the shared drive. Renaming the files on the shared drive happens only after Claude shows the full rename plan and you say yes; every rename can be undone.
6. Claude packages the event for The Current (a folder called `current` inside the event). You upload it on the Photos tab (below).

> **Ask Claude:** "Make an album from the photos in the shared drive folder [folder name] for the [event] on [date]. Tell me the folder and how many files are in it before you copy anything."

> **Ask Claude:** "Find me three to six photos of Early Years outdoors, portrait shape, signed off for public use, for the website."

> **Ask Claude:** "Prepare a Facebook recap post for the [event] from its album: choose and crop the photos, write the caption and alt text, and show me the text here. Do not post it."

## Class photos each week

Teachers upload their class photos to their class's week folders in "PHOTOS BY CLASS 2026-2027" during the week. Since 21 October 2026 Claude names every file there so the drive can be searched, and picks the best of each week for the Photos tab.

- **The names.** `KQ1W7 043 science - three children blowing through straws at dishes [6.5].HEIC`: the class code (N Nursery, K Kindergarten, Y1, Y23 Year 2-3, Y5, Y7, US Upper Secondary), the quarter and week, the photo's number in its folder (in the order taken), what is in it, and a score out of 10 at the end. Event folders start with the event (`MidAutumn 014 …`); videos end `[video]`. Search the drive for "KQ1W7", "Y1 cooking" or "lion dance". The score is a guide: 8 and above is the best few of a week.
- **The Friday run.** Every Friday at noon a scheduled Claude task on the office laptop reads the new photos, judges them closely, renames them, picks up to 16 of the best taken since the previous Friday noon (one per moment, spread across the classes, nothing with swimwear or a readable name), writes titles, captions, a description and one draft Facebook post, and packages them with the four looks. It needs the laptop on, the Claude app open and Google Drive for desktop running; if the app was closed it runs the next time it opens. It never uploads, posts or deletes anything, and it leaves a short report in `PRA Photos\_year\2026-2027\weekly\<week>\report.md`.
- **Your part.** Upload the week's album like an event (Photos → Upload event…, the album's `current` folder, named in the report). It appears under **Class weeks**. Sign the photos off, choose looks and post exactly as for an event.
- Nothing is polished on the drive itself: the looks exist only in the album. Renames are logged; Claude can put any run's names back.

> **Ask Claude:** "The Friday photo run didn't happen (or failed). Run this week's class-photo routine now and tell me the album folder."

## The Photos tab

**Outreach** → **Photos** (office accounts only). The tab shows the work done on the laptop and is where people sign photos off, edit captions and post. It has two lists: **Events** (Mid-Autumn, the Showcase and other events) and **Class weeks** (the Friday albums of the best class photos). The tab remembers which list you last opened.

### Uploading an event

1. On the laptop, after Claude has packaged the event: **Photos** → **Upload event…**, and pick the event's `current` folder inside the library.
2. The window lists what will happen: new photos, photos already there (their pictures, scores and tags are refreshed), posts.
3. Tick **Delist the photos no longer in the album** when the album was redone. Tick **Replace the titles, captions, description and draft posts with the laptop's** only when the album was redone and the laptop's text is the better one; it overwrites text changed in the tab.
4. Press **Upload** and keep the page open until it finishes.

A second upload always keeps sign-offs, delistings and chosen looks, and never touches a post that has been posted. The upload uses your own office sign-in. A fallback script exists that needs the database's secret key; only the admin types that key.

### An event's page

The page has four views: **Photos**, **Event**, **Facebook** and **Website**.

- **Photos**: the grid, with tabs **All**, **To check**, **Checked**, **For the website**, **Delisted**; **Filters** for tags; **Sort** by **Best first** or **Album order**; a bar showing "n of m checked against the no-photo list". Click a photo to open it full screen (arrow keys move; N, A, B, C pick the look; Esc closes). **Details** opens the photo's title, caption, tags, the "Check before use" flags, the look, the sign-off, **Delist** and **Remove**.
- **Event**: "What happened", the description for staff (never shown to families), where the photos came from, what is covered and what is missing, and "To confirm before posting".
- **Facebook**: the draft posts (below).
- **Website**: choosing photos for pra.edu.vn, and the storage card (below).

A caption is one line, in English, with no full stop and no child named. The website adds a Vietnamese caption when a photo moves there. **Delist** keeps a photo in The Current but takes it out of the album and the posts. **Remove** deletes it from The Current for good; the original stays on the shared drive.

### Signing photos off

This is done by a member of staff who knows the children and the no-photo list.

1. Open the event, **Photos** view, tab **To check**.
2. Open each photo full screen. Look at every face. Zoom in on any text.
3. If nobody on the no-photo list is in it, press **Mark as checked**. The photo records "Checked by" your name and the date.
4. If someone on the list is in it, **Delist** it, or ask Claude for a crop that leaves them out and check the crop the same way.
5. **Mark all shown as checked** exists for a set you have looked at one by one. It asks you to confirm that nobody in those photos is on the list and that you looked at each one. Do not use it for photos you have not opened.

> **Rule:** never tick a photo for someone else, and never tick one you have not looked at. The Facebook button and the website both trust the tick.

## Facebook posts

### What a post is like

- One post, one purpose: an event recap, a look inside one class, an invitation to something coming, or a thank-you.
- 50 to 90 words. A recap is three short paragraphs: a first line that carries the day, two or three highlights, thanks.
- Not an itinerary: no running order, no clock times, no class-by-class list. Bowen turned down an 82-word timetable on 28 September 2026.
- Not too brief either: he turned down a 39-word list the same day. Give each highlight one thing a reader can picture.
- Say who did the work: the students made it, ran it, organised it.
- Never credit the photographer. Never name a dance troupe or a costume character.
- No children's names. Adults in the photos are parents.
- No closing line about what the day meant. Plain copy, said once.
- Facts come from people who were there. Claude puts anything it is unsure of in the post's notes and asks. A wrong class name is noticed by every parent who was there.
- A person publishes. Claude does not post unless you ask for that one post.

### The drafts in the tab

Each event can have draft posts of three kinds, **Recap**, **Spotlight** and **Thank you**, plus posts written in the tab. Each shows its status (**Draft**, **Posted**, **Not used**), the post text with a word count, **Other first lines**, **Photos, in order**, the **Shape**, a **Suggested time** and **Before posting** notes.

- **Copy text** and **Download photos** (numbered in posting order) are for posting by hand. Then **Mark as posted**.
- **New post** adds a post written in the tab. **Delete post** moves it to **Deleted posts** at the bottom, where **Restore** brings it back and **Delete for good** removes it.
- A post stays locked until every photo in it is checked against the no-photo list. A photo that has been delisted or removed shows in red in the post, with **Take them out** or **Put back**.

### Posting from The Current

1. Open the event's **Facebook** view and the post. Read the text and correct it in the box. What is in the box is what gets posted.
2. Press **Post to Facebook…**. The window names the Page and shows the text as it will appear and the photos cut to the post's shape.
3. Choose **Post now** (it goes on the Page at once, for everyone) or **Schedule**, a time between 15 minutes and 29 days ahead in this computer's time, then **Schedule post**.
4. A scheduled post shows on its card with **Cancel on Facebook** until it goes out. It can also be changed in Meta Business Suite.
5. Once posted, the card links to it with **View on Facebook**.

How it works: the button sends the post to a small program on the database's servers, the Supabase edge function `facebook-post`. The key that lets it post to the Page lives only in that function's secrets (Supabase → **Edge Functions** → **Secrets**), never in The Current's code, which is public. The function checks again that you have an office account, that every photo is in the album and signed off, and that the post is not on Facebook already.

- The Meta app behind it is called "The Current". It went live on 30 September 2026, and Bowen deployed the function on 1 October 2026. Whether a post has yet gone out through it is not recorded (not checked since 15 October 2026).
- Bowen is not the Page's manager. Bowen's notes name Mr. David as the person who manages the Page (not checked since 15 October 2026). Find out who it is at the handover.
- The Page key stops working if the person whose key it is loses their role on the Page, changes their Facebook password or removes the app. After a handover, expect to make a new key. The steps are in `supabase/functions/facebook-post/README.md` in the admin folder and take about half an hour.

> **Ask Claude:** "Post to Facebook in The Current says the connection is not working. Read the facebook-post README in the admin folder and walk me through making a new Page key and putting it in the Supabase secrets. I will type the key myself."

### After a post goes out

Tell Claude when a post has gone out and what you changed. Claude records it in the post log, and a week later asks for the reach and reactions. After five or more posts with numbers, it updates the Facebook style guide from what the results show.

## Photos for the website

1. Event → **Website** view. Under "Choose the photos", press the globe on each photo to use (**Use on the website**), or **Choose all N checked photos**. Only album photos checked against the no-photo list can be chosen.
2. Under "Send them to the website", press **Download the list**. It saves `website-` plus the event's name `.json` to Downloads. **Copy the command** copies the line that runs the website's photo script on the laptop.
3. Run it (or ask Claude to). The script copies each chosen photo into the website project and builds the web sizes. It never commits or pushes.
4. Add the photos to the event's entry on the Events page and give them Vietnamese captions, check the page locally, then commit and push the website. [The website](#/handbook/website) has those steps.
5. After the website is live, come back to the **Website** view and press **Check the website and move what is there** under "Free the storage". The tab checks that each chosen photo really loads from the website, then shows it from there and deletes the private copy.

> **Ask Claude:** "I downloaded the website list for the [event] from the Photos tab. Run it into the website, add Vietnamese captions, show me the page locally, and push the website when I say yes."

Taking a photo down: untick it or delist it, download the list again (it now tells the website to take that photo down), run it and push. The photo leaves the site at the next push but stays in the website's public history. A photo that must be gone for good needs that history rewritten; ask Claude, and expect it to take a while.

## Staff portraits

The staff cards on the website's About page are made by a script in the website project. A face detector frames every card the same way (same face size, eyes on one line), a cut-out model removes the background and cleans the edges, and a gentle colour correction evens the light. There is no face retouching and no faded bottom edge. Cards show name and title only. A new staff photo goes into the website's staff originals with one line added to the portrait list; the steps are in [the website chapter](#/handbook/website). Never decide who a teacher is from a small thumbnail: two photos once went on the wrong teacher's card. Check at full size.

## Storage and space

- **The website's git project** holds the photos that are public, in web sizes. The full-size originals behind them sit in the project's `originals` folder on the laptop, about 2 GB, which is not uploaded to GitHub. Keep a copy of that folder on Google Drive.
- **The Current's private storage** (the bucket adm-event-photos) holds only photos still under review. An event of 20 photos with four looks takes about 48 MB; the Mid-Autumn package was 111 MB. The database plan's storage is small (see [Behind the scenes](#/handbook/behind)), so:
  - **Finish event** on the Website view's storage card keeps the chosen look of each photo and deletes the other looks. Uploading the event again brings them back.
  - **Free the storage** after the website is live deletes the private copies of the photos that moved.
  - **Remove event** deletes the event, its photos and its posts from The Current. It refuses while any photo is on the website.
- **The database** holds the events, photos and posts tables: scores, tags, captions, sign-offs, website state, Facebook results.
- **The shared drive** keeps every original.

## Worked example: the Quarter 1 Showcase 2026

The Quarter 1 Showcase was on Thursday 15 October 2026. It went from photos to a finished event page the next day, and it shows each step and two things that went wrong.

1. Staff uploaded 45 photos to the shared drive folder "20261015 Showcase Term 1", with a Year 1 subfolder and Year 1's slides as a PDF.
2. On 16 October Bowen asked Claude to do it "the Mid-Autumn way". Claude made the library event "2026-10-15 Quarter 1 Showcase": an album of 25, the staff description, and one recap post. The facts came from Bowen: what Upper Secondary, Lower Secondary and Year 1 showed. He did not know what Early Years showed, so the page says only what the photos show.
3. The website page `/events/q1-showcase-2026/` and its Vietnamese twin were pushed the same day, before any photo was signed off. The page showed text only, because it shows only photos that have been built.
4. Bowen found the page too heavy on Year 1. Eight photos of Upper Secondary's debate posters were added, the album grew to 30, and the page became one section per class.
5. Claude packaged the event again. Bowen uploaded it to the Photos tab with the laptop's text, signed the photos off, chose the ones for the website, downloaded the list and ran it.
6. The live page still had no photos: the script had copied them into the website folder, but nobody had committed and pushed. Claude committed and pushed, and the photos went live.
7. The copy was reworked once more around students communicating their learning and practising presenting, in the plain wording of the first draft.

What it teaches:

- When photos are approved but the website shows none, check for changes waiting in the website folder before anything else.
- The Year 1 slides PDF holds about 70 photos of children. It went public on 16 October 2026 before anyone checked it against the no-photo list. Have it checked.
- Whether the recap post has gone out on Facebook is not recorded (16 October 2026).

> **Ask Claude:** "Check whether the website folder has changes that are not pushed, and tell me what they are."

## What can go wrong

| What you see | Why | What to do |
|---|---|---|
| **Post to Facebook…** is greyed out | A photo in the post is not checked against the no-photo list | Sign the photos off in the Photos view |
| Photos in a post are red | They were delisted or removed after the post was written | **Take them out**, or **Put back** a delisted one |
| The upload stopped partway | The page was closed or the connection dropped | Upload again: it adds what is missing and keeps everything else |
| A photo or an event cannot be removed | It is on the website or chosen for it | Delist it, download the list again, run it, push the website, then remove |
| The website shows grey boxes where photos should be | On the laptop's preview: the preview was started before the photos were built | Stop the preview and start it again |
| The live website shows no photos after approval | The website was not pushed | Ask Claude to check the website folder and push |
| Facebook says the key is not valid | The Page key's owner lost their role, changed their password, or removed the app | Make a new key (README), typed by you into the Supabase secrets |
| A photo on a staff card shows the wrong person | It was matched from a thumbnail | Ask Claude to check it at full size against other photos and fix the card |
| Private photo storage is running short | Too many events still hold every look of every photo | **Finish event** and **Free the storage** on the events that are done |
