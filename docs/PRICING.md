# Fletcher pricing

Proposal, September 2026. Not yet implemented in billing; the `workspaces.plan` column and the staff Admin view carry `free / paid / custom` until Stripe lands (see "Mapping to today" at the end).

## Principles

1. **The unit is the artist, not the seat.** One workspace = one artist = one subscription. This is how the app is built and how the buyer thinks. A management company pays per artist on its roster.
2. **External collaborators are free, on every tier, forever.** Every invite is a lead: the videographer who reviews a cut on one artist's workspace is the person who brings Fletcher to the next artist. Per-seat pricing punishes exactly the behaviour we want. Frame.io ("reviewers are free") trained this market already.
3. **Price like release-operations software, not project management.** The comparison set is Frame.io, Chartmetric, Feature.fm and Symphony, which artist teams already pay real money for. It is not Jira, Airtable or Notion. Say "release operating system," never "project management for artists."
4. **Free must be genuinely good.** Free tier walls are things a *successful* artist hits naturally (a second active release), never things that make a struggling one feel punished (history caps, task limits).
5. **Don't discount to close.** Give onboarding, a longer trial, an extra artist slot. Never cut the number. Once a firm knows the price is soft, every renewal is a negotiation.

## Tiers

| | **Free** | **Artist** | **Team** | **Management** | **Enterprise** |
|---|---|---|---|---|---|
| For | Trying it out | Self-managed artist | One artist, a real team | Management company, roster | Labels, large firms |
| Price, annual billing | $0 | **$49 / mo** | **$199 / mo** | **$899 / mo** | From **$2,500 / mo** |
| Price, monthly billing | $0 | $59 / mo | $249 / mo | $1,099 / mo | Annual contract only |
| Unit | 1 artist | 1 artist | 1 artist | Up to 5 artists, then **$149 / artist / mo** | Unlimited artists |
| Active projects | **1** | Unlimited | Unlimited | Unlimited | Unlimited |
| Archived projects | Unlimited | Unlimited | Unlimited | Unlimited | Unlimited |
| Storage | 2 GB | 100 GB | 1 TB | 5 TB pooled, +1 TB per extra artist | Custom |
| Video hosting | Links only (YouTube, Vimeo) | Upload | Upload | Upload | Upload |
| Team seats | 2 | 5 included, **+$15 / seat** | 20 included, +$15 / seat | 75 included, +$15 / seat | Unlimited |
| External collaborators | **Free, unlimited** | Free, unlimited | Free, unlimited | Free, unlimited | Free, unlimited |
| Templates | System templates | Custom templates | Custom templates | Custom, shared across roster | Custom, shared, admin-locked |
| Review | Time-coded comments, region and drawing markup on video, images, PDFs | Same | Same, plus approval sign-off | Same | Same |
| Comms rollout plans | Yes | Yes | Yes | Yes | Yes |
| Mentions | Yes | Yes | Yes | Yes | Yes |
| Cloud imports (Drive, Dropbox, Box) | — | Yes | Yes | Yes | Yes |
| Cross-artist calendar | — | — | — | Yes | Yes |
| Permissions | Owner, member | Owner, admin, member, guest | Same, plus view-only reviewers | Same | Same, plus SSO / SAML |
| Admin controls, audit log | — | — | Basic | Full | Full |
| Support | Community | Email | Priority | Dedicated contact, onboarding | Account manager, SLA, custom onboarding |

Annual billing is roughly 20% below monthly, the Notion / Slack / Linear norm. Default the UI to annual; album campaigns run 6–9 months, so "$588 for the whole rollout" is an easy yes.

### Add-ons

| Add-on | Price | Notes |
|---|---|---|
| Extra team seat | $15 / seat / mo | Any paid tier |
| Extra storage | $49 per 500 GB / mo | Any paid tier |
| Onboarding package | $2,500–5,000 one-time | Build custom templates from their last campaigns, migrate files, train the team. Management companies expect this; it makes the sale stick. |
| Campaign pass | $499 one-time | 90 days of Team for a single big release. Some convert to annual. |

### Why these tiers

- **Artist ($49)** is the indie floor. Five times cheaper than one Sprout Social seat, and under one release cycle's worth of tools for a serious independent (DistroKid, Linkfire, Canva, Dropbox).
- **Team ($199)** is where a professional artist's operation lives. Priced like one Sprout or Hootsuite seat, but it covers the whole team. That's the comparison the manager will make.
- **Management ($899 for five)** is what the business is built on. It works out to ~$180 per artist, $149 beyond five. A firm with 12 artists pays ~$1,950/mo. For a company taking 15–20% of major-artist revenue, that's noise.
- **Enterprise (from $2,500)** exists so Management doesn't look like the top, and to catch labels who need SSO, contracts and procurement.

### Worked example: 20 people, one artist

Realistic split, 6 team + 14 external:

| Plan | Seats | Monthly (annual rate) | Per year |
|---|---|---|---|
| Artist | 5 + 1 extra | $49 + $15 = $64 | $768 |
| Team | 20 included | $199 | **$2,388** |

Everyone marked as a team seat (the worst case):

| Plan | Seats | Monthly | Per year |
|---|---|---|---|
| Artist | 5 + 15 extra | $274 | $3,288 |
| Team | 20 included | $199 | **$2,388** |

Team is the obvious home. Artist becomes the wrong tier past ten team seats, which is where the upgrade should happen. For the same 20 people: Slack Pro is $1,740/yr, Asana Advanced $6,000, Airtable Business $10,800, Sprout Social $60,000.

## Team seats vs external collaborators

The line is **what the person does in the tool**, not who employs them or how long they've been around. A videographer you've worked with for five years is still External. He uploads cuts and answers comments; he doesn't run the release.

### Team seat (paid)

Someone who **runs the release**. They need the whole workspace.

- Artist
- Manager, day-to-day manager, assistant
- Marketing lead, marketing coordinator
- Social media manager, community manager
- Creative director or content lead who plans shoots and owns the calendar
- Anyone at a management company assigned to this artist
- Anyone who needs to create projects, edit templates, invite people, or see the calendar and Files across the workspace

### External collaborator (free)

Someone who **does work inside a project** and hands it back. They need their assignments, their deliverables, and the conversation about them.

- Videographer, editor, colourist, animator
- Photographer, retoucher, designer
- Producer, mix engineer, mastering engineer
- Publicist, PR agency
- Label A&R, label marketing, distributor contact
- Booking agent, tour manager (for tour projects)
- Merch vendor, web developer
- Lawyer, business manager reviewing a contract deliverable
- Anyone from another company, even one you work with constantly

### What each can do

The distinction is enforced by capability, so it doesn't need policing. This is the Frame.io / Figma approach: viewers are free because viewers can't do the things that make you the owner of the workflow.

| | Team seat | External |
|---|---|---|
| See projects | All in the workspace | Only projects they're assigned to |
| Tasks, checklists, comms items | Everything | Their own, plus anything on their projects |
| Upload deliverable versions | Yes | Yes, to their own deliverables |
| Review: comments, time codes, drawing, approvals | Yes | Yes |
| Mentions | Yes | Yes |
| Create projects | Yes | No |
| Edit templates | Yes | No |
| Invite people | Yes | No |
| Workspace overview, calendar, Files tab | Yes | No |
| Owner or admin permission | Yes | No |

### Edge cases

- **Long-standing videographer who only uploads and responds.** External. Fair and intended.
- **Videographer who starts creating his own content-shoot projects.** That's team work. The product tells him when he tries to create one, and the manager decides whether to give him a seat.
- **In-house marketer marked External to dodge a seat.** She can't see the calendar, can't create the next single's project, can't invite the publicist. She'll ask to be made a team seat within a week. No enforcement needed.
- **Label employee who's on ten of your artists.** External on every workspace. Externals are per-workspace and never accumulate into a seat anywhere. This is also the growth loop: after the third artist, they know Fletcher.
- **Artist's family member or friend who helps.** External unless they're running things, in which case they're team.
- **A workspace with 2 team seats and 25 externals.** Allowed, but the staff Admin view flags it, and the product can nudge: "Most of your team is marked external. Externals can't see the calendar or create projects. Want to switch anyone?" Cheap insurance, not a hard cap.

### Naming

The invite form keeps the External checkbox, with the copy "External collaborator: vendor, label, agency" replaced by something that describes the role rather than the employer, e.g. "Works on projects, doesn't run the workspace (videographers, engineers, publicists, label contacts). Free." The word External stays.

## Free tier, in detail

What's limited, and why each limit is a door rather than a wall:

- **1 active project.** A single release fits entirely. Planning the next single while this one is live, or starting an album (parent project plus child singles), needs two. Success is the upgrade trigger. Shown at the moment of creating the second project: "Artist gives you unlimited projects."
- **2 GB, video by link only.** Image, audio and PDF review work in full. Video review works via unlisted YouTube or Vimeo, with time-coded comments intact. Only *hosting* video is paid, and that's the expensive part anyway. The existing "Video uploads need a paid plan" message is the door.
- **System templates only.** The industry-standard plans are the value. Making them your own is the "this is my process now" moment, and that's worth paying for.
- **2 team seats.** Artist plus manager. The third is the upgrade. Externals are unlimited, so a free artist can still run a whole release with their crew.

What Free never limits: comment or activity history, number of tasks, comms checklists, the profile kit, mentions. These are what make Fletcher the place the release lives.

## Making Fletcher hard to leave, without hostage-taking

Lock-in should come from accumulated value.

1. **Templates as institutional memory.** After two releases, the custom template encodes everything the team learned. That's their process now.
2. **The review record.** Every cut, every time-coded note, every approval. "Which version did the label approve?" is answered in Fletcher and nowhere else.
3. **Files as system of record.** The Files tab is where masters, artwork and cuts live. Storage tiers monetise this directly.
4. **The comms plan.** Per-platform rollout checklists are the runbook nobody wants to rebuild in a spreadsheet.
5. **Mentions and activity.** The conversation about the release lives here, not in iMessage.
6. **The collaborator graph.** Their videographer, publicist and engineers already have accounts and know the tool.

Worth building next, in order: approval sign-off on deliverables (Team), a release archive / export (which paradoxically reduces churn because people trust they can leave), and the cross-artist calendar (Management).

## Upgrade prompts inside the product

Each wall is shown at the moment of need, with the specific thing they'll get:

| Trigger | Prompt |
|---|---|
| Second active project on Free | "Artist gives you unlimited projects. $49/mo." |
| Video upload on Free | "Video uploads need a paid plan. Paste a YouTube or Vimeo link, or upgrade." (exists) |
| Third team seat on Free | "Add your team. Artist includes 5 seats." |
| Editing a system template on Free | "Make it yours. Custom templates are on Artist." |
| Hitting 100 GB on Artist | "Team gives you 1 TB." (the Files tab meter already shows this) |
| Eleventh team seat on Artist | "Team includes 20 seats and costs less than adding more here." |
| Second workspace | "Managing more than one artist? Management." |

## Infrastructure cost check

Supabase Pro: $25/mo base, 100 GB storage included, $0.021/GB beyond, 250 GB egress included, $0.09/GB beyond.

- 1 TB stored: ~$19/mo. A Team customer at $199 is fine.
- The real cost is **egress**: a busy 1 TB video workspace can stream 1–2 TB/mo, which is $70–160/mo. Still profitable at $199, but egress is 3–8× the storage line and scales with usage.
- When video volume grows, move bytes to **Cloudflare R2** ($0.015/GB/mo, zero egress). The `StorageAdapter` interface makes this a contained change. Keep Supabase for auth and Postgres.

That's why Team is 1 TB, not unlimited, and why Management storage is pooled.

## Mapping to today

`workspaces.plan` supports `free / paid / custom`, and the staff Admin view (`/admin`, allow-listed by `FLETCHER_SUPERADMIN_EMAILS`) switches it by hand.

| Proposed tier | Today |
|---|---|
| Free | `free` (2 GB and no-video-upload rules already enforced) |
| Artist | `paid` (100 GB already the number) |
| Team, Management, Enterprise | `custom` with the GB box |

Not yet enforced in code, all small: active-project cap on Free, team-seat caps per tier, custom-templates gate on Free, and the External capability limits (scope `projects.list` to assigned projects; gate `projects.create`, `templates.*`, `members.add`; hide overview, calendar and Files nav). The External limits should land before pricing does, because the free-externals promise only holds if externals are genuinely limited.

Billing itself: Stripe Checkout plus a webhook that flips `plan`. Enterprise stays manual.
