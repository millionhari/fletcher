# Fletcher roadmap: the Marketing Playbook, section by section

Snapshot taken 2026-09-17 from the Claude doc "Fletcher vs. the Marketing Playbook". This file is the working copy: edit it here as features land, and keep the status column and the checkboxes current.

## Working the list

- Pick the next item from **Tier 1** below, top to bottom, unless a customer conversation reorders it.
- When something ships: tick its checkbox, move its row in the section table to **Built**, and add a line under **What is built** describing the screen.
- When something is half-done: leave the checkbox open and add a row under **What is partial** saying what exists and what is missing.
- Platform gaps at the bottom are not playbook sections but block selling to a team; treat them as a parallel track.

## How to read this

The playbook is the 204-page Google Doc management runs each MŌRIAH campaign from. Fletcher replaces it with a structured app: 10 of its 22 sections are built, 4 are partly covered by generic pieces, and 8 are not started. Everything in it is built to be a template or a tab on the same engine, so the remaining sections are mostly configuration, not new plumbing.

Status words used below:

- **Built**: usable today in the app, verified in the browser.
- **Partial**: the underlying data or tasks exist, but there is no dedicated screen for it yet.
- **Not yet**: nothing in the app addresses it beyond a task on the timeline.

## Playbook section by section

One row per section of the Google Doc, in the order they appear in it.

| Playbook section | What it holds in the doc | How Fletcher does it | Status |
| --- | --- | --- | --- |
| Campaign timeline + overview | Release/deadline table, overall artist timeline by month, quick links, goals | Projects with an anchor date; the timeline engine generates every task backward from it (Single, Album, EP, Music Video, Tour templates). Calendar page shows all projects by month. | Built |
| Team members | Mgmt, marketing co, socials, agents, label, publicist, biz mgmt, legal | Team page: members with role, company, external flag, access level. Roles drive assignee suggestions. | Built |
| Pre-release checklist (6–8 wks, 4 wks, 3 wks, week of, post) | Dated to-dos: DSP access, Discovery Mode, pitching, Canvas, reports | Dated tasks in the timeline templates, each with a seeded sub-checklist; the digital audit is the DSP-access task's checklist. | Built |
| Content hub | Per-single card: UPC, ISRC, Apple ID, Spotify URI, links, lyrics, genre, pitch quote, Spotify blurb; album masters, art, tracklist | Release info card on every release project (all those fields, editable in a sheet). No shared file library yet; files attach to tasks. | Built |
| Asset checklist (pixel specs) | Profile images 1000², FB/X/YouTube/Spotify/Amazon banners, canvas, ad cutdowns, press photos | Profile Kit (workspace) plus pre-release and release asset sets per project. Uploads are measured and checked against each spec. | Built |
| Videos (OMV, lyric, teasers, cutdowns, countdown) | Deliverables list per single, links to files | Deliverables with versions (YouTube, Vimeo, upload), time-coded comments, approval that closes the task. | Built |
| Liners (Pandora, Spotify, Amazon, Apple, Deezer scripts) | Script templates with artist/title blanks | A "Liners recorded" task with a checklist per platform. No script generator. | Partial |
| Collab ideas | Feature candidates per song | Nothing dedicated; fits the task doc or project notes. | Not yet |
| D2C / indie retail (merch calendar, webstore collections, variants, PPD, pop-ups) | Holiday calendar, product forms, vinyl variant grid, projections | Album template has a "physical formats" option that adds vinyl-variant, projection and Luminate tasks. No merch module. | Partial |
| Touring (dates, billing, presales, comms, checklist) | Tour grid, presale passwords, announce/on-sale rollout | Tour Announce timeline template (prep, announce, staggered presales, Friday on-sale). No tour-specific screen or comms template. | Partial |
| Press (team questions, targets, opportunities, recaps, pick-up log) | Target lists, opportunity grid, press recaps | Press release tasks only. | Not yet |
| Radio (format guide, ship/add dates, promo, reports) | Format primer, add-date grid | Nothing. | Not yet |
| Social media (best practices, fan funnel, feature reminders, content ideas, shot lists) | Platform tips, content idea library, per-single content-day shot list | Nothing dedicated; per-platform items live inside comms moments. | Not yet |
| DSPs (playbook questions, partner priorities, promo grid) | Ingestion questions, DSP promo asks | Pitch tasks (Spotify, Apple/Amazon/Pandora) with checklists; release-night QC per DSP. No partner-promo tracker. | Partial |
| Advertising (assets, budgets per single, Marquee/Showcase, tracker) | Budget grid per platform, ad specs | Ad-cutdown asset specs and Marquee/Showcase tasks. No budget planner. | Partial |
| Partnerships (brand opps grid, redline notes) | Opportunity tracker, contract redline guide | Nothing. | Not yet |
| Sync / film / TV / games | Opportunity grid | Nothing. | Not yet |
| Awards (per-show dates, eligibility, voting, history) | Award calendar | Nothing. | Not yet |
| CRM / fan strategy (SMS/email providers, audit, fan accounts) | Provider details, audit checklist, best practices | Email/SMS items in comms moments and the CRM-drafts task. No CRM module. | Partial |
| Comms plans (per release: overview table, rollout moments, per-platform checklists, owners) | The core rollout doc, copied per single | Comms tab per project: overview table, dated moments with CTA/asset/link/copy, nested platform checklists, owners, status colors. Generated from templates. | Built |
| Release checklists (single, album) | Retail-link and DSP QC checklists | Standing checklists on the comms plan; release-night QC is also a task checklist. | Built |
| Reporting (First Friday, First Week, editorial comps, interpreting streaming) | Stream tables per DSP with comps to prior singles | Report tasks on the timeline at R+3d and R+7d. No reporting screens. | Not yet |

## What is built

Eight modules cover the playbook's release timeline, team, assets, video review and rollout. Everything below has been exercised end to end in the browser.

**Projects and the timeline engine.** A project is a single, album, EP, music video, tour or campaign with one anchor date. A template of tasks with day offsets generates the schedule: production 1 week, mix 10 days, master 48 h, distro delivery 42 days out, editorial pitch 21 days out, announce 11 days out, reports at +3 and +7 days. Albums carry a four-single waterfall (R−217, −105, −70, −28) with milestones that spawn child single projects. Moving the date re-flows every task except ones pinned by hand, and the engine flags dependencies that end up out of order.

**Task detail.** Any task opens as a side panel (URL-addressable) or a full page: a rich-text brief in read mode with explicit Edit and Save, a checklist seeded from the playbook ("Deliver to distributor" starts with master, art, label copy, lyrics, release type, genre), attachments (deliverables, Profile Kit assets, links, uploaded files), a comment thread, dependency chips, and per-task activity.

**Video and asset review.** Deliverables hold versions from YouTube, Vimeo or upload. Video review has a scrub bar with comment markers, time-coded threads, resolve, and an approval that flips the linked task to done. Image slots probe dimensions and file size against each platform's spec.

**Profile Kit and asset sets.** Every profile image, banner, canvas, playlist cover, thumbnail and ad cutdown from the asset checklist is a slot with its exact spec. Workspace-level kit for the live profiles; pre-release and release sets per project.

**Comms plan builder.** Each release gets the playbook's rollout: CRM teaser, artwork reveal + presave, teaser 2, reminder, release night, release morning, premiere, promo. Each moment has CTA, copy, link, a linked asset, and the per-platform checklist with owners. The overview table hover-links to the cards, and cards and rows are colored by status (ready, posted, skipped, missed).

**Overview.** A work list for one person or everyone, grouped by due date, mixing tasks and rollout items, with done-in-place checkboxes and filters that persist. Project cards, upcoming rollout moments and an activity feed sit beside it.

**Team, templates, calendar.** Team roster with roles and access levels. System templates for timelines and comms plans that can be duplicated and edited per workspace, including each task's checklist. A month calendar of every deadline, moment and release date across projects.

## What is partial

Five sections have their tasks and checklists but no screen of their own. Each is a small build on top of what exists.

| Section | What exists | What is missing |
| --- | --- | --- |
| Liners | A dated task with a per-platform checklist (Pandora ×3, Spotify, Amazon Alexa, Apple) | A generator that fills the playbook's scripts with artist and title, and a place to attach the recorded audio per platform |
| D2C / merch | Physical-formats option on the album template: vinyl variants, projections, webstore preorder, Luminate registration as tasks | Product forms (soft goods, media), variant grid, PPD and projection tables, the holiday merch calendar |
| Touring | Tour Announce timeline template with presale and on-sale tasks | Tour dates grid, presale passwords and limits, the tour comms plan template, the timezone-by-timezone on-sale check |
| DSPs | Pitch tasks with checklists, release-night QC per DSP, DSP bio and exclusive-photo tasks | Partner-promo tracker (partner, status, due, live), pitch copy stored on the release |
| Advertising | Ad asset specs (:15 vertical, :30 square) and Marquee/Showcase tasks | Budget grid per single and platform, campaign results tracker |
| CRM | Email and SMS items in comms moments, CRM-drafts task | Provider details (SMS, email), pre-campaign audit checklist, fan-account list, segment planning |

## What is not built yet

Tier 1 is what a management team needs before Fletcher can replace the doc for a live campaign. Tier 2 is the reporting and side-business sections that can stay in spreadsheets a while longer.

**Tier 1**

- [ ] **Liner script generator**: fills the Pandora, Spotify, Amazon, Apple and Deezer scripts with artist and title, and attaches the recording per platform.
- [ ] **Collaborator asks**: the cross-promo request list for featured artists (accept collab post, pin for a week, share stories three times, Artist Pick), as a shareable checklist per collaborator.
- [ ] **Tour module**: dates grid, presale passwords and limits, the tour comms template, and the per-timezone on-sale check.
- [ ] **Press**: press team questions, targets by channel, opportunity tracker with status, per-release recaps, pick-up log.
- [ ] **DSP partner tracker**: partner, ask, status, due, live date; pitch copy saved on the release.
- [ ] **CRM**: provider details, pre-campaign audit, segment plan, fan-account list.
- [ ] **File library**: one place per workspace and project for brand files, fonts, key art, one-sheets; attachments already exist per task.
- [ ] **Key-art to every size**: upload one master image and generate every profile and banner slot from it.

**Tier 2**

- [ ] **Reporting**: First Friday and First Week stream tables per DSP with comps to prior singles, editorial playlist comps, the interpreting-streaming guide as inline help.
- [ ] **Advertising planner**: budget per single per platform, Marquee and Showcase dates, results tracker.
- [ ] **Merch / D2C**: product forms, variants, PPD and projections, holiday calendar, pop-ups and in-stores.
- [ ] **Radio**: format guide, ship and add dates by format, promo trips, radio reports.
- [ ] **Partnerships**: brand opportunity tracker and the redline checklist for contracts.
- [ ] **Sync / film / TV / games**: opportunity tracker.
- [ ] **Awards**: per-show dates, eligibility, submission deadlines, voting rounds, history.
- [ ] **Content ideas and shot lists**: the social best-practices library and per-single content-day shot lists, attached to the shoot task.
- [ ] **Integrations**: Chartmetric, Feature.fm, Google Drive, Slack.

## Platform gaps outside the playbook

These are not sections of the doc, but they gate selling Fletcher to a team.

- [ ] **Sign-in and invites**. Today: A dev-user stub stands in for the session; everyone is the same person. Needed: Supabase auth, email invites, the existing access levels (owner, admin, member, guest) enforced on mutations.
- [ ] **Billing**. Today: Nothing. Needed: Stripe per-seat subscription on the workspace.
- [ ] **Mobile**. Today: Nothing. Needed: Expo app on the same tRPC API; deadlines, task panel, video review first.
- [ ] **Concurrent editing**. Today: Last save wins on the task brief; no live sync. Needed: Stale-write check now; Tiptap + Yjs collaboration once auth gives real identities.
- [ ] **File storage**. Today: Local disk behind a storage adapter. Needed: Supabase Storage or Mux for video.
- [ ] **Notifications**. Today: Activity feed only. Needed: Email or Slack on assignment, comments and due dates.
