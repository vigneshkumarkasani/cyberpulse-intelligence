# CyberPulse Intelligence

Cybersecurity research and threat intelligence, published as a static site.

- **Live site:** https://vigneshkumarkasani.github.io/cyberpulse-intelligence/
- **Stack:** Astro 7, TypeScript, Tailwind CSS v4, Markdown content collections, GitHub Pages, GitHub Actions

> **Status:** first production-quality version. All articles in the repository are **sample content** for
> demonstrating structure and layout. They are labelled as such on every page and must not be cited as research.
> The newsletter form is a placeholder and is not connected to any service.

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
- Related articles are chosen automatically: same category first, then shared tags.
- Statistics on the homepage are computed from this folder. They describe the site's content, not threat activity.

## Deploying to GitHub Pages

1. In the repository, go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
   This is a one-time step.
2. Push to `main`. The workflow in `.github/workflows/deploy.yml` runs `npm ci`, `npm run build` and publishes
   `dist/` to Pages. It can also be started by hand from the **Actions** tab.

The site URL and base path are set in `astro.config.mjs` (`site` and `base`). If the repository is ever renamed or
moved to a custom domain, update those two values. Then update the `Sitemap:` line in `public/robots.txt`.

## Design notes

- Dark navy and black palette with electric blue accents (`src/styles/global.css`, `@theme` block).
- The animated grid and entrance animations respect `prefers-reduced-motion`.
- Glassmorphism is used only on the header, featured card, category tiles and callouts.
- Article pages have a reading-progress bar, a table of contents on wide screens and Schema.org `Article` markup.

## What is not built yet

- Automatic publishing or ingestion of threat data.
- Newsletter delivery. The form in `src/components/NewsletterSignup.astro` is disabled. Do not add provider API keys
  to this repository. Use the provider's public form endpoint, or keep secrets in GitHub Actions secrets.
- Analytics.

## Licence and contact

No licence has been chosen yet. Corrections and discussion happen through GitHub issues on this repository.
