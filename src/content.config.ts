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
      )
      .default([]),
    featured: z.boolean().default(false),
    // Defaults to true so that any article is labelled as sample content
    // unless its author explicitly marks it as real research.
    demo: z.boolean().default(true),
  }),
});

export const collections = { articles };
