# Self-hosted fonts

The site serves these fonts from its own files. No font is requested from a third-party server.

| File | Family | Axes used | Source |
|---|---|---|---|
| `inter-latin-wght.woff2` | Inter | `wght` 100–900 | Google Fonts (`fonts.gstatic.com/s/inter/v20`), Latin subset |
| `jetbrains-mono-latin-wght.woff2` | JetBrains Mono | `wght` 400–800 | Google Fonts (`fonts.gstatic.com/s/jetbrainsmono/v24`), Latin subset |
| `source-serif-4-latin-wght-opsz.woff2` | Source Serif 4 (roman) | `wght` 200–900, `opsz` 8–60 | Google Fonts (`fonts.gstatic.com/s/sourceserif4/v15`), Latin subset |
| `source-serif-4-italic-latin-opsz.woff2` | Source Serif 4 (italic) | `opsz` 8–60 | Google Fonts (`fonts.gstatic.com/s/sourceserif4/v15`), Latin subset |

The files were downloaded on 2026-11-27 from the Google Fonts CSS API, using the Latin subset
(`unicode-range` U+0000–00FF, U+0131, U+0152–0153, U+02BB, and related punctuation). The axis ranges were read
from each file's `fvar` table.

**Licence.** All three families are licensed under the SIL Open Font License 1.1. The licence texts are in
`licenses/`. The Source Serif 4 files carry the notice 'with Reserved Font Name Source'. Whether the Latin subset used here is a modified version under the OFL has not been reviewed. Qualified legal review is required before publication.

**Limits.** Characters outside the Latin subset fall back to the system font stack in `src/styles/global.css`.
If the site needs other scripts, add the matching subsets from the same source and update this table.

**Updating.** Replace a file only with a newer build from the same upstream family. Update this table and the
`@font-face` rules in `src/styles/global.css` in the same change.
