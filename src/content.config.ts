import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { CATEGORIES } from './consts';

// Each Markdown file in src/content/articles becomes one article.
// Required frontmatter: title, description, date, category, tags, references.
const articles = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/articles' }),
  schema: z.object({
    title: z.string().min(1),
    description: z.string().min(40).max(220),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    category: z.enum(CATEGORIES),
    tags: z.array(z.string().min(1)).min(1),
    references: z
      .array(
        z.object({
          title: z.string().min(1),
          url: z.url().optional(),
          publisher: z.string().optional(),
        }),
      ).min(1),
    featured: z.boolean().default(false),
    // Defaults to true so that any article is labelled as sample content
    // unless its author explicitly marks it as real research.
    demo: z.boolean().default(true),
    // Optional metadata written by scripts/import-intelligence.mjs from an engine export.
    // Hand-written articles do not need these fields.
    article_key: z.string().optional(),
    revision: z.number().int().positive().optional(),
    content_sha256: z.string().regex(/^[a-f0-9]{64}$/).optional(),
    cve_ids: z.array(z.string().regex(/^CVE-\d{4}-\d{4,}$/)).optional(),
    last_verified: z.coerce.date().optional(),
    confidence: z.enum(['high', 'medium', 'low']).optional(),
    verification_status: z.enum(['confirmed', 'unverified']).optional(),
    // The weakest cited claim: CONFIRMED only when every claim is CONFIRMED. Shown on the article page.
    verification_label: z.enum(['CONFIRMED', 'ASSESSED', 'UNVERIFIED']).optional(),
  }),
});

export const collections = { articles };
