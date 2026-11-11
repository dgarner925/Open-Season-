# Open Season: how to get it found

Written 2026-11-10, against live numbers pulled the same day.

---

## 1. What the numbers actually say

| | |
|---|---|
| First user | 13 July 2026 |
| Profiles | **97** |
| Paying subscribers | **6** |
| Comped / grandfathered | 33 |
| Users who set up follows | **91 of 97** |
| Total follows | **1,879** (about 20.6 each) |
| New users, last 30 days | 21 |
| New users, last 7 days | 10 |

Signups by month: Jul 13 · Aug 41 · Sep 19 · Oct 12 · **Nov 12 in ten days**.

Read that table twice, because it says something unusual.

**The product is not the problem.** Ninety-one of ninety-seven people who made
an account went on to follow seasons, and they followed twenty each. That is
not tyre-kicking. People who find this app use it hard, and November is running
at roughly triple October's pace without a single marketing dollar spent.

**The top of the funnel is one person wide.** Ninety-seven users in four months
is the number you get from friends, family and whoever stumbled in. The
marketing problem is not persuasion, positioning or price. It is that almost
nobody has had the chance to see it.

**The one owned channel with real leverage was switched off.** Until four days
ago the website had **one page indexed by Google**. Fifty state pages existed
and had never been discovered. The sitemap went in on 6 November and fifty-two
pages were found the same day — that clock started last week.

So: everything below is about distribution, and the cheapest distribution this
app has is the thing it already does better than anyone — knowing when seasons
open in fifty states.

---

## 2. The asset nobody is using yet

The database holds **933 verified state-by-species season records** plus draw
windows, results dates and plain-English regulation summaries for all fifty
states, audited nightly by the coverage watchdog.

Every one of those records is the answer to a question somebody is typing into
Google right now:

- "when does deer season open in georgia"
- "colorado elk draw deadline 2027"
- "pennsylvania bear season dates"
- "idaho turkey season 2027"

The current top results for those queries are **state agency PDFs**. They are
slow, unreadable on a phone, often a year out of date, and they bury the one
date you came for under forty pages of statute. That is the competition, and it
is beatable with a page that answers in the first line.

The marginal cost of publishing one of those pages is roughly zero: the data is
already maintained, and `scripts/gen_state_pages.py` already builds fifty of
them. The work is widening the generator, not finding content.

**This is the whole strategy. Everything else is support.**

---

## 3. The deadline that sets the calendar

Western draw application season runs **January to April 2027**. Wyoming elk
opens in January, Montana and Colorado in March, Arizona and Idaho in between.
It is the single biggest spike in hunting search traffic all year, and it is
the moment this app is most obviously worth paying for.

Google takes roughly **four to twelve weeks** to discover, crawl and rank a new
page. Pages published in December will not be ranking in January.

**Everything SEO has to ship in November.** That is the forcing function, and
it is why the order below is the order below.

---

## 4. Four plays, in priority order

### Play 1 — Fix what the people who already arrive see (this week, half a day)

The App Store listing still carries **the six pre-redesign screenshots**. Every
person the rest of this plan sends to the store is judging the app on pictures
of a version that no longer exists.

This is the cheapest conversion win available and it gates every other play.
New screenshots from the current build, and listing copy that leads with the
search terms people actually use ("season dates", "draw deadlines", the state
names) rather than with brand language.

Same half-day: **Android to production**. The alpha has been sitting there with
the subscription live and the credentials uploaded. Android skews rural, which
is precisely this audience, and every day it stays in alpha is half the market
unreachable.

### Play 2 — Own the search results (November, the big one)

Widen the site from 51 pages to roughly **1,000**, generated from the database:

- **One page per state per species.** "Georgia black bear season dates
  2026-27." The table above the fold, the date it was last verified, and a link
  to the agency's own page under it.
- **One deadline page per state.** "Colorado draw deadlines 2027" — every
  application window and results date for the state on one page.
- **A leftover-tag page per state** once that feature lands (see Play 3).

The warning already on record: if these land in Google's "Crawled — currently
not indexed", that is a verdict that the template is too thin. A bare table is
thin. Each page needs something the PDF cannot give:

- the plain-English regulation summary already in the database
- what changed from last year, which the app already computes
- legal shooting hours for that state, which the app already calculates
- the sunrise and sunset table for the opener

All four already exist in code. None of them exist on the website.

**Measure:** Google Search Console, Indexed climbing 1 to 51 to 500+. Check
weekly. It is the only number in this plan that compounds.

### Play 3 — The "didn't draw" moment (spring, highest intent of the year)

Leftover and over-the-counter tag alerts are being built now. The timing is not
incidental — it is the best conversion story the app has.

Draw results land April to June. Leftover tags go on sale days later, at a
published hour, and in Colorado and Utah they are gone in minutes. A hunter who
misses that window loses the season. That is a person who will pay for a push
notification, and they will pay in the ten minutes after they find out they did
not draw.

So: a landing page per state ("Colorado leftover elk tags 2027 — when they go
on sale"), an email capture on it, and the push alert as the thing behind the
subscription. The free page earns the trust; the alert is what is worth money.

One blocker to clear first: customer email **fails closed without a physical
mailing address** set, for CAN-SPAM. That is a ten-minute environment variable
with the Piece & Quiet, LLC address, and nothing in Play 3 or 4 works until it
is done.

### Play 4 — Be where hunters already are (30 minutes a day, starting now)

This is the only play that works immediately, and the only one that costs time
rather than code.

- **State Facebook groups** are where this audience actually lives — "Georgia
  Deer Hunters", "Colorado Elk Hunting", and the hundred like them. Far more
  than Reddit, and far more than X.
- **Reddit** (r/Hunting, r/elkhunting, r/bowhunting) punishes promotion and
  rewards usefulness. The move is answering date and deadline questions with
  the correct answer, linking the state page when it genuinely helps.

The discipline that makes this work rather than get you banned: **post the
answer, not the app.** Link the state page, which is free and has no signup
wall. People who want the alerts will find the app from there.

- **The weekly brief as a public magnet.** The daily brief already exists
  inside the app. A public weekly version — "what opens this week in Georgia",
  free, email only, no account — builds a list that compounds and that neither
  Apple nor Google can take away from you.

---

## 5. What not to do yet

**Paid ads.** Six paying subscribers is not enough to know what a customer is
worth. Spending against an unknown lifetime value is how small app budgets
disappear. Revisit after organic proves the funnel converts — specifically,
after the site is sending traffic and you can see what fraction of it
subscribes.

**Influencers and sponsorships.** Expensive, slow to measure, and at this scale
a single bad fit is the whole budget.

**App Store Search Ads** are the one exception worth a small, capped test — but
in January, against draw-deadline keywords, when intent is at its peak and you
have the screenshots to convert it. Not before.

**Rebuilding or repositioning the product.** Ninety-one of ninety-seven users
set up follows. Nothing in these numbers says the product needs changing.

---

## 6. The eight weeks to 1 January

| Week | The one thing |
|---|---|
| **Nov 10–16** | New App Store screenshots. Android to production. Mailing address set so email can send. |
| **Nov 17–23** | Widen the page generator to state-by-species. Ship about 1,000 pages, submit the sitemap. |
| **Nov 24–30** | Deepen the template: regulation summaries, shooting hours, what-changed. Start the daily 30 minutes in Facebook groups. |
| **Dec 1–7** | Deadline page per state, built for the January draw spike. Check GSC indexing. |
| **Dec 8–14** | Public weekly brief live, email capture on every state page. |
| **Dec 15–21** | Leftover-tag landing pages for the six automated states. |
| **Dec 22–28** | Quiet week. Fix whatever indexing says is thin. |
| **Dec 29–Jan 4** | Draw season opens. Small capped Search Ads test. Watch what converts. |

---

## 7. The numbers to watch

Four, checked weekly, in this order:

1. **Pages indexed** in Search Console. 1 today. 51 is the floor. 500 is the
   plan working.
2. **New profiles per week.** 10 in the last 7 days is the baseline to beat.
3. **Paying subscribers.** 6 today. This is the one that matters, and it should
   move last — organic traffic takes weeks to become a subscription.
4. **Follows per new user.** 20.6 today. If this falls as traffic grows, the
   new arrivals are the wrong people and the pages are drawing the wrong query.

If pages indexed is climbing and new profiles is flat eight weeks from now, the
pages are ranking for the wrong things. If both climb and subscribers do not,
the problem moved to the paywall, and that is a much better problem to have
than the one in section 1.
