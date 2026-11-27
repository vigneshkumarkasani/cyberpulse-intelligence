# CyberPulse Intelligence

Cybersecurity research and threat intelligence, published as a static site.

- **Live site:** https://vigneshkumarkasani.github.io/cyberpulse-intelligence/
- **Stack:** Astro 7, TypeScript, Tailwind CSS v4, Markdown content collections, GitHub Pages, GitHub Actions

> **Status:** first version of the site. It has **no published research articles yet**, and nothing on it should be cited
> as research. The six demonstration articles were removed from the site and are kept, unchanged, in
> `archive/demo-articles/` (outside `src/`, so they are not built). There is **no functional newsletter**: the signup
> form has been removed. Articles are published by hand (see "Publishing workflow" below). Automated publishing and
> engine integration do not exist.

## Requirements

- Node.js **22.23.4 or newer** (Astro 7 requirement). Node 24 is recommended. See `.nvmrc`.
- npm (ships with Node).

## Local development

```bash
npm install        # install dependencies (uses package-lock.json)
npm run dev        # start the dev server
```

Open http://localhost:4321/cyberpulse-intelligence/. The base path matches the GitHub Pages URL, so local and
production links behave the same way.

Other scripts:

| Command | What it does |
| --- | --- |
| `npm run check` | Type-checks Astro, TypeScript and content frontmatter |
| `npm run build` | Runs the type check, then builds the static site into `dist/` |
| `npm run build:fast` | Builds without the type check |
| `npm run preview` | Serves the built `dist/` folder locally to test the production output |

## Project structure

```text
src/
  consts.ts              site name, categories, navigation (single source of truth)
  content.config.ts      article collection and frontmatter schema
  content/articles/      Markdown articles (one file per article)
  components/            reusable Astro components
  layouts/               BaseLayout (SEO, header, footer) and ArticleLayout
  lib/articles.ts        queries: latest, featured, by category, related, statistics
  lib/url.ts             withBase(): applies the /cyberpulse-intelligence base path
  pages/                 routes: /, /research, /cve, /malware, /threat-actors,
                         /exploits, /about, /methodology, /articles/[slug], 404
  styles/global.css      theme tokens, grid background, glass surfaces, article typography
public/                  favicon, robots.txt (static files, served as-is)
.github/workflows/       deploy.yml, the GitHub Pages deployment workflow
```

## Writing an article

Create a Markdown file in `src/content/articles/`. The filename becomes the URL slug.

```markdown
---
title: "Your article title"
description: "One or two sentences, 40 to 220 characters, shown in cards and search results."
date: 2026-11-25
updated: 2026-12-01          # optional; shown as "Updated"
category: cve                # research | cve | malware | threat-actors | exploits
tags: [cve, patching]        # at least one
featured: false              # true puts it in the homepage hero (newest featured wins)
demo: false                  # defaults to true; set false only for real, reviewed research
references:
  - title: "Source title"
    url: "https://example.org/source"
    publisher: "Publisher"
---

Article body in Markdown. Code blocks and tables are styled automatically.
```

Notes:

- `demo` defaults to **true**, so any article is labelled as sample content unless its author opts out.
- Required fields are validated at build time. A missing or malformed field fails the build with a clear error.
- `references` must contain at least one entry. An article without references fails the build.
- Related articles are chosen automatically: same category first, then shared tags.
- Statistics on the homepage are computed from this folder. They describe the site's content, not threat activity.

## Publishing workflow (manual)

Articles are written by hand and published only through this repository. Nothing imports content from any other system.

1. Write the article as a Markdown file in `src/content/articles/`, with every field from the example above. Set
   `demo: false` only for real research that has been reviewed.
2. Check each reference. The source must be public, its link must work, and its terms must allow republication with
   attribution. Record the attribution in `references`.
3. Run `npm run check` and then `npm run build`. Both must pass before you commit.
4. Open a pull request with the new file. A second person should review the claims, the sources, the confidence
   statements and the `demo` flag before it is merged.
5. Merging into `main` deploys the site (see below).

## Deploying to GitHub Pages

1. **One-time setup:** in **Settings → Pages → Build and deployment → Source**, choose **GitHub Actions**.
2. **Every push to `main` deploys.** `.github/workflows/deploy.yml` runs `npm ci`, `npm test`, `npm run build` and
   publishes `dist/` to Pages. The workflow has no manual trigger. Changes reach the live site as soon as they are
   merged, so review before merging.
3. **Branch protection is recommended** for `main`: require a pull request and a review before merging. Check it under
   **Settings → Branches**. This repository's protection settings were not verified when this README was written.

### Rerunning and rolling back a deployment

- **Rerunning an earlier deployment publishes that run's commit, not the current `main`.** GitHub's re-run keeps the
  commit and ref of the original run. A re-run of an old deployment can therefore put an older version of the site
  back online, even when `main` has moved on. Do not rerun an old deployment run unless you intend that version.
- **Before any deployment or rerun, confirm which commit `main` points to.** Run `git fetch origin` and
  `git rev-parse origin/main`, or read the commit at the top of the `main` branch on GitHub. Check the run's
  commit in the Actions tab against it.
- **To publish the current `main`, push a new commit or merge a pull request.** Do not rerun an old run to
  republish.
- **Rollback is an explicit owner decision.** To return the site to an earlier version, revert the unwanted commit
  on `main` through a pull request, and let the normal push trigger deploy the result. Nothing in this repository
  rolls back automatically, and no deployment is triggered by a rollback decision alone.

The site URL and base path are set in `astro.config.mjs` (`site` and `base`). If the repository is ever renamed or
moved to a custom domain, update those two values. Then update the `Sitemap:` line in `public/robots.txt`.

## Design notes

- Dark navy and black palette with electric blue accents (`src/styles/global.css`, `@theme` block).
- The animated grid and entrance animations respect `prefers-reduced-motion`.
- Glassmorphism is used only on the header, featured card, category tiles and callouts.
- Article pages have a reading-progress bar, a table of contents on wide screens and Schema.org `Article` markup.

## What is not built yet

- Automatic publishing or ingestion of threat data.
- Newsletter delivery. The signup form has been removed, so no form is shown. Do not add provider API keys to this
  repository. Use the provider's public form endpoint, or keep secrets in GitHub Actions secrets.
- Engine integration. Nothing is imported from the CyberPulse Engine repository. Articles are written by hand.
- Analytics.

## Licence and contact

No licence has been chosen yet. Corrections and discussion happen through GitHub issues on this repository.
