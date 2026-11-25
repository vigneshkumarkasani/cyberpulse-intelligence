// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// GitHub Pages project site: https://vigneshkumarkasani.github.io/cyberpulse-intelligence/
// `site` is the origin; `base` is the repository path. Use `withBase()` from
// src/lib/url.ts for every internal link so the base path is applied consistently.
export default defineConfig({
  site: 'https://vigneshkumarkasani.github.io',
  base: '/cyberpulse-intelligence',
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
  markdown: {
    shikiConfig: {
      theme: 'github-dark-dimmed',
      wrap: true,
    },
  },
});
