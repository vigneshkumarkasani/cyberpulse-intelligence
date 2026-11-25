import { getCollection, type CollectionEntry } from 'astro:content';
import { CATEGORIES, type Category } from '../consts';

export type Article = CollectionEntry<'articles'>;

/** All articles, newest first. */
export async function getAllArticles(): Promise<Article[]> {
  const articles = await getCollection('articles');
  return articles.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

export async function getArticlesByCategory(category: Category): Promise<Article[]> {
  const articles = await getAllArticles();
  return articles.filter((article) => article.data.category === category);
}

/** The article marked `featured` (newest one if several), otherwise the newest article. */
export async function getFeaturedArticle(): Promise<Article | undefined> {
  const articles = await getAllArticles();
  return articles.find((article) => article.data.featured) ?? articles[0];
}

/**
 * Related articles: same category scores highest, each shared tag adds to the score.
 * Ties are broken by recency. Falls back to the newest other articles if nothing overlaps.
 */
export function getRelatedArticles(current: Article, all: Article[], limit = 3): Article[] {
  const scored = all
    .filter((article) => article.id !== current.id)
    .map((article) => {
      const sharedTags = article.data.tags.filter((tag) => current.data.tags.includes(tag)).length;
      const sameCategory = article.data.category === current.data.category ? 3 : 0;
      return { article, score: sameCategory + sharedTags };
    })
    .sort((a, b) => b.score - a.score || b.article.data.date.valueOf() - a.article.data.date.valueOf());

  return scored.slice(0, limit).map((entry) => entry.article);
}

export interface SiteStats {
  articles: number;
  categories: number;
  tags: number;
  references: number;
  latestDate: Date | undefined;
}

/** Statistics computed from the content collection itself. No external data is used. */
export function getSiteStats(articles: Article[]): SiteStats {
  const tags = new Set(articles.flatMap((article) => article.data.tags));
  const categoriesInUse = new Set(articles.map((article) => article.data.category));
  return {
    articles: articles.length,
    categories: categoriesInUse.size,
    tags: tags.size,
    references: articles.reduce((total, article) => total + article.data.references.length, 0),
    latestDate: articles[0]?.data.date,
  };
}

export function countByCategory(articles: Article[]): Record<Category, number> {
  const counts = Object.fromEntries(CATEGORIES.map((category) => [category, 0])) as Record<Category, number>;
  for (const article of articles) counts[article.data.category] += 1;
  return counts;
}

/** Estimated reading time in minutes, from the Markdown body. Code blocks are skipped. */
export function getReadingMinutes(article: Article): number {
  const prose = (article.body ?? '').replace(/```[\s\S]*?```/g, ' ');
  const words = prose.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: '2-digit', timeZone: 'UTC' });
}
