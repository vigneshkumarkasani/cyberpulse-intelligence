# Self-hosted fonts

The site serves these fonts from its own files. No font is requested from a third-party server.

| File | Family | Axes used | Source |
|---|---|---|---|
| `inter-latin-wght.woff2` | Inter | `wght` 100–900 | Google Fonts (`fonts.gstatic.com/s/inter/v20`), Latin subset |
| `jetbrains-mono-latin-wght.woff2` | JetBrains Mono | `wght` 400–800 | Google Fonts (`fonts.gstatic.com/s/jetbrainsmono/v24`), Latin subset |

The files were downloaded on 2026-11-27 from the Google Fonts CSS API, using the Latin subset
(`unicode-range` U+0000–00FF, U+0131, U+0152–0153, U+02BB, and related punctuation). The axis ranges were read
from each file's `fvar` table.

**Licence.** Both families are licensed under the SIL Open Font License 1.1. The licence texts are in `licenses/`.

**Removed: Source Serif 4.** The two Source Serif 4 font files were removed from the site in the change that replaced
the serif typeface with the system Georgia font (R6.27). The site no longer serves any Source Serif 4 file, so the
Reserved Font Name question recorded for that family does not arise for the files in this build. That is a technical
statement, not a legal clearance. The licence text `licenses/OFL-SourceSerif4.txt` is retained as a record only. It
is not used by the site, and it is not the copyright holder's copy: it omits the Adobe copyright and Reserved Font Name
header.

**Limits.** Characters outside the Latin subset fall back to the system font stack in `src/styles/global.css`.
If the site needs other scripts, add the matching subsets from the same source and update this table.

**Updating.** Replace a file only with a newer build from the same upstream family. Update this table and the
`@font-face` rules in `src/styles/global.css` in the same change.
