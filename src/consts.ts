// Single source of truth for site-wide constants.
// Category ids here are also the enum used by the content collection schema.

export const SITE = {
  name: 'CyberPulse Intelligence',
  description:
    'Cybersecurity research and threat intelligence: CVE analysis, malware triage, threat actor profiling and exploit intelligence.',
  author: 'CyberPulse Intelligence',
  locale: 'en',
  // Public GitHub repository hosting the site.
  repository: 'https://github.com/vigneshkumarkasani/cyberpulse-intelligence',
} as const;

export const CATEGORIES = ['research', 'cve', 'malware', 'threat-actors', 'exploits'] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_META: Record<Category, { label: string; path: string; summary: string }> = {
  research: {
    label: 'Latest research',
    path: '/research/',
    summary: 'Long-form analysis across the threat landscape, with sources and confidence stated.',
  },
  cve: {
    label: 'CVE intelligence',
    path: '/cve/',
    summary: 'Vulnerability triage: affected products, severity context and remediation priorities.',
  },
  malware: {
    label: 'Malware analysis',
    path: '/malware/',
    summary: 'Static and dynamic triage notes, indicators of compromise and detection ideas.',
  },
  'threat-actors': {
    label: 'Threat actors',
    path: '/threat-actors/',
    summary: 'Actor profiles built from public reporting, with attribution confidence made explicit.',
  },
  exploits: {
    label: 'Exploit intelligence',
    path: '/exploits/',
    summary: 'How exploitation activity is observed and assessed, written for defenders.',
  },
};

export const NAV_ITEMS = [
  { label: 'Research', href: '/research/' },
  { label: 'CVE', href: '/cve/' },
  { label: 'Malware', href: '/malware/' },
  { label: 'Threat actors', href: '/threat-actors/' },
  { label: 'Exploits', href: '/exploits/' },
  { label: 'Methodology', href: '/methodology/' },
  { label: 'About', href: '/about/' },
] as const;
