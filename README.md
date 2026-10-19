# Project Details

How can we improve knowledge production in an age of AI? We have an experiment to answer this question. We think reducing misinterpretations and misconceptions can help produce higher quality knowledge and we run an experiment to test it. If we succeed, we could change how Wikipedians edit their articles with massive positive impact! We already present to Wikimedia Foundation leaders each year at https://wikicred.org so this funding can unlock widespread impact if this hypothesis holds up. 

We want to pay participants to participate in an experiment to test if we can make wikipedia editing better in an age of AI. Participants will use https://editbetter.vercel.app, and a randomized treatment of "social media claims about this article" will be shown to Wikipedia editors as they edit the articles. Our hypothesis is the transparency about how the article is quoted will help editors better position the article to avoid misinterpretations. We already have pilot data of (a small but mightly) 7 samples, and agreement from Wikimedians in the Bay Area to help us host these sessions. With your help we can make it possible to run this experiment and write an academic paper about it! 

Part of the funds will be used to support sourcing social media claims from Meta, Reddit, Twitter, Instagram, TikTok, and other platforms on specific issue areas like PFAS, COVID, Semaglutides, Vaccination, Right to Repair Policy, and a variety of diverse subjects. We already have a platform collecting such data from social media, that gathers 100M+ posts a month from 9 social media platforms reaching ~2 billion people. This took us 3 years to build, it works beautifully and is used by Pulitzer and Nobel winning journalists in 8 countries. You can sign up and check it out: https://arbiter.simppl.org/auth/register





## Trying it on your own (`/try`)

Anyone can open `/try`, pick one of the articles, and edit it beside the claims people made about its subject on X and YouTube between June and August 2026. Each article opens at the revision live on about 1 June 2026. When you press Finish, the results page shows your changes next to what Wikipedia's editors did by the end of August, and you can download them as JSON or CSV.

Finish also sends the run to `/api/persist` under an id starting `self_`, then reads it back. The results page says "Saved on the server" only when that read-back finds the row. If the database is down, the page says so, and the run stays in the browser for download.

Facilitators see every stored run at `/try/runs` (same login as `/admin`), with CSV and JSON export of the whole set.

Listing or deleting rows on `/api/persist` needs the facilitator password in an `x-admin-key` header; the two admin pages send it for you. Set `ADMIN_KEY` in the Vercel project to replace the default password, which ships in the page code. Anyone can still save a run or check that their own run id was stored.

Someone who has already started or finished the experiment sees a choice on the home page: carry on, or start a new attempt. A new attempt gets a fresh participant id and the opposite condition order; the earlier attempt's dashboard stays in the browser.

The claims come from the Claims tab of four Arbiter studies, pulled through the browser on 2026-10-14 and labeled section by section against the June revision. The raw captures, labels and notes live in the workshop repo under `scratchpad/arbiter-claims-2026-10-14/`. Rebuild the sidebar files with `python3 scripts/build_selfserve_claims.py`, and re-pin both snapshots with `npx tsx scripts/fetch-articles.ts --window <revisions.json> --suffix jun26`.

Run `npx playwright test tests/selfserve.spec.ts` against a dev server on port 3001 to check the whole path at desktop and phone widths.

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

editbetter.vercel.app builds from `main` of [SwapneelM/wikicredcon-experiment](https://github.com/SwapneelM/wikicredcon-experiment) (git remote `deploy`) on Swapneel's personal Vercel, so `git push deploy main` ships. The project needs `DATABASE_URL` (Neon, added through the Storage tab) and, optionally, `ADMIN_KEY`. Vercel there only builds commits authored by SwapneelM. [SimPPL/wikicredcon-experiment](https://github.com/SimPPL/wikicredcon-experiment) holds the same history but deploys nothing.
