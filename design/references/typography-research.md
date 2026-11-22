# Multi-font design language: research findings

**How to read this.** Font axes and licences were verified by downloading each Fontsource npm package's `metadata.json` (Nov 2026). Every font listed is `type: google` and OFL-1.1 there, meaning Fontsource sources it from Google Fonts. I could not check fonts.google.com, w3.org or web.dev directly, because all three are blocked in this session. Research claims come from search-result summaries of the cited pages, not full-text reads. Items marked **[unverified]** are from my own knowledge or had no source found.

## 1. Legibility and readability evidence

- **No universally best font.** Wallace et al. 2022 (ACM TOCHI 29(4), Adobe/UCF) found readers were 35% faster in their fastest font than their slowest, with comprehension unchanged. Which font won differed per person, and stated preference did not predict speed. The 35% is a best-versus-worst spread, not an average gain. (https://research.adobe.com/publication/towards-individuated-reading-experiences-different-fonts-increase-reading-speed-for-different-individuals , https://jeffhuang.com/papers/Readability_TOCHI22.pdf)
- **Atkinson Hyperlegible.** The Braille Institute released Atkinson Hyperlegible Next on 10 Feb 2025: seven weights instead of two, with italics, a variable weight axis and a Mono companion. I found no independent controlled study showing it beats Arial or Verdana; the evidence is design rationale plus client feedback. Treat it as well-reasoned, not proven. (https://en.wikipedia.org/wiki/Atkinson_Hyperlegible , https://christiantietze.de/posts/2025/02/atkinson-hyperlegible-font-next-mono/ , https://www.allaboutvision.com/low-vision/atkinson-hyperlegible-typeface/)
- **Dyslexia fonts do not help measurably.**
  - Wery & Diliberto (Annals of Dyslexia, 2017): OpenDyslexic gave no improvement in reading rate or accuracy versus Arial or Times. (https://pmc.ncbi.nlm.nih.gov/articles/PMC5629233)
  - Kuster et al. 2017: Dyslexie neither helped nor hindered. (https://pmc.ncbi.nlm.nih.gov/articles/PMC5934461)
  - Where benefits appear, they are reproduced by plain Arial with matching spacing, so spacing is the active ingredient. (https://pmc.ncbi.nlm.nih.gov/articles/PMC7188700)
  - A 2026 meta-analysis (Azzarello et al.) reports only limited improvements; I did not read it in full. (https://strathprints.strath.ac.uk/97732/1/Azzarello-etal-AD-2026-Does-font-improve-reading-in-dyslexic-children-meta-analysis.pdf)
- **Size and line height.** Rello, Pielot & Marcos (CHI 2016, 104 participants, Arial on Wikipedia) found readability and comprehension improved up to 18pt, while 10–12pt impaired it. Line spacing had only marginal effects, though the extremes (0.8 and 1.8) hurt. (https://researchr.org/publication/RelloPM16 , doi.org/10.1145/2858036.2858204)
- **Line length.** On screen, speed often favours long lines of about 95–100 characters (Dyson; Shaikh & Chaparro 2005). Readers prefer 45–72. So a 50–75ch measure is a comfort choice, not a speed one. (https://oreilly.com/library/view/100-things-every/9780132658638/ch18.html , https://portfolio.erau.edu/en/publications/the-effects-of-line-length-on-reading-performance-of-online-news-/)
- **WCAG 1.4.12 Text Spacing (AA).** Content must not lose anything when users override spacing; the values are not required defaults. The override values are line-height 1.5×, paragraph spacing 2×, letter-spacing 0.12em and word-spacing 0.16em. **[numbers from memory; w3.org unreachable]** (https://www.w3.org/WAI/WCAG22/Understanding/text-spacing)
- **All caps.** Tinker's older work found caps 9.5–19% slower. Arditi & Cho 2007 found uppercase not inherently slower, and better for low vision at small sizes because the letters are larger. Short caps labels are fine. (https://pmc.ncbi.nlm.nih.gov/articles/PMC2016788)
- **Italic, bold, underline.** I found no controlled reading-speed study isolating these. Guidance is consistent, though: the British Dyslexia Association, the ALA and Edinburgh say avoid long italics and underlining and prefer bold. web.dev notes screen readers usually ignore bold and italic styling, so use semantic `<em>`/`<strong>` and do not rely on style alone. (https://www.bumc.bu.edu/jmedday/files/2025/05/Dyslexia-friendly-style-guide.docx , https://www.ala.org/accessibility/build-better-content-readability , https://web.dev/learn/accessibility/typography)
- **How many typefaces is too many.** No empirical study found; this is convention only (see section 2).

## 2. Pairing and role assignment

- Practitioner consensus is two to three faces, with a superfamily as the safest route. More than three needs deliberate harmony. (https://www.myfonts.com/a/font/content/font-pairing-tips , https://fonts.google.com/knowledge/choosing_type/pairing_typefaces)
- The usual framework is concord, contrast, conflict: aim for clear contrast and avoid near-miss conflict, such as two similar sans faces. (https://webdesign.tutsplus.com/articles/a-beginners-guide-to-pairing-fonts--webdesign-5706)
- Match skeletons: similar x-height and apertures with contrasting surface style. (https://www.myfonts.com/a/font/content/monotype-studio-pairings-guide)
- Pairings fail when roles are left vague, which supports your explicit three-voice assignment. (https://www.creativebloq.com/design/fonts-typography/six-common-font-pairing-mistakes-and-how-to-avoid-them)
- I found no Bringhurst or Lupton quotes. **[unverified]**

## 3. Verified candidates

All are OFL-1.1 and variable unless noted.

| Voice | Font | Axes (verified) | Notes |
|---|---|---|---|
| Fancy | **Fraunces** | ital, opsz 9–144, wght 100–900, SOFT 0–100, WONK 0–1 | Most animatable serif. WONK substitutes automatically above opsz 18 (per README). Now on some "tasteful AI default" lists. |
| Fancy | Playfair | ital, opsz 5–1200, wdth 87.5–112.5, wght 300–900 | Huge optical-size range. |
| Fancy | Newsreader | ital, opsz 6–72, wght 200–800 | Also works for body text. |
| Fancy | Literata | ital, opsz 7–72, wght 200–900 | Also works for body text. |
| Fancy | Source Serif 4 | ital, opsz 8–60, wght 200–900 | |
| Fancy | Bodoni Moda | ital, opsz 6–96, wght 400–900 | |
| Fancy | Kalnia | wdth 100–125, wght 100–700 | |
| Fancy | Instrument Serif | **static**, 400 + italic only | Cannot be animated. Flagged as overused. |
| Professional | **Atkinson Hyperlegible Next** | ital, wght 200–800 | Mono companion has the same axes. |
| Professional | Recursive | slnt −15–0, wght 300–1000, CASL, CRSV, MONO (each 0–1) | One file can cover UI, code and casual. |
| Professional | Roboto Flex | opsz, slnt, wdth 25–151, wght 100–1000, GRAD −200–150, plus 8 parametric axes | GRAD changes weight without reflow. |
| Professional | Google Sans Flex | opsz 6–144, slnt, wdth 25–151, wght 1–1000, GRAD 0–100, ROND 0–100 | Updated Oct 2026. |
| Professional | Instrument Sans | ital, wdth 75–100, wght 400–700 | |
| Professional | Bricolage Grotesque | opsz 12–96, wdth 75–100, wght 200–800 | No italic. |
| Professional | Figtree | ital, wght 300–900 | |
| Professional | Hanken Grotesk | ital, wght 100–900 | |
| Professional | Public Sans | ital, wght 100–900 | |
| Professional | Schibsted Grotesk | ital, wght 400–900 | |
| Professional | Mona Sans | ital, wdth 75–125, wght 200–900 | |
| Professional | Commissioner | slnt, wght, FLAR 0–100, VOLM 0–100 | |
| Fun | **Shantell Sans** | ital, wght 300–800, BNCE −100–100, INFM 0–100, SPAC 0–100 | Purpose-built for bounce animation. |
| Fun | Recursive (CASL=1) | as above | Gives a fun voice with zero extra bytes. |
| Fun | Gluten | slnt −13–13, wght 100–900 | |
| Fun | Fredoka | wdth 75–125, wght 300–700 | |
| Fun | Sour Gummy | ital, wdth 100–125, wght 100–900 | |
| Fun | Grandstander | ital, wght 100–900 | |
| Fun | Playpen Sans | wght 100–800 | |
| Fun | Caveat | wght 400–700 | |
| Fun | Honk / Nabla | MORF, SHLN / EDPT, EHLT | Colour fonts. |
| Fun | Handjet | wght, ELGR, ELSH | |

**Overused defaults to avoid.** Geist (ital, wght 100–900), Inter (ital, opsz 14–32, wght 100–900) and Space Grotesk (wght 300–700) are all verified OFL but flagged by designers.

- Inter is number one on 13% of 2,190 designer-favoured sites, and 24% of Framer sites, where it is the default. (https://muz.li/blog/font-pairings-2026/)
- Space Grotesk is called "the model's edgy default". (https://aiskill.market/blog/banning-inter-the-font-tell)
- Geist reads as the shadcn/Vercel default. One playbook names Inter and Geist, plus Instrument Serif, Fraunces and Playfair with cream and sage, as "the 2026 tell". (https://claudecodehq.com/playbooks/unslop-ui)
- Creative Bloq reports designers saying Instrument Serif "is starting to look lazy". (https://www.creativebloq.com/design/fonts-typography/serif-fonts-are-back-in-fashion-and-i-couldnt-be-happier)
- All of this is blog sentiment, not data; only the Muzli figure is measured. The stated complaint is ubiquity, not quality. (https://fontalternatives.com/blog/neo-grotesk-fatigue-2026/)

## 4. Loading several fonts

- **Self-host WOFF2, subset with `unicode-range`, and preload only the critical file.** Preload needs `crossorigin` even on the same origin. (https://web.dev/learn/performance/optimize-web-fonts , https://web.dev/articles/font-best-practices)
- **Third-party CDNs have lost their edge.** Cache partitioning removed the shared-cache benefit. A Munich court (Jan 2022) awarded €100 damages for leaking a visitor's IP address to Google Fonts. Fontsource npm packages are the easy self-hosting route. (https://www.theregister.com/2022/01/31/website_fine_google_fonts_gdpr/ , https://gomakethings.com/google-fonts-and-gdpr/)
- **`font-display`.** Use `swap` for the professional voice. Use `optional`, which applies the font only if it arrives within about 100ms, or lazy loading for the fancy and fun voices, since they are non-critical by definition.
- **Fallback metric overrides.** `size-adjust`, `ascent-override`, `descent-override` and `line-gap-override` make a local fallback match the web font and remove layout shift. Fontaine, Capsize and `next/font` generate these. (https://developer.chrome.com/blog/font-fallbacks , https://developer.chrome.com/blog/framework-tools-font-fallback)
- **Variable fonts.** One file replaces many, but each file is larger. Do not preload a heavy variable font if only one weight shows above the fold. (https://24ways.org/2019/interactivity-and-animation-with-variable-fonts/)
- **Animating axes.**
  - It is not GPU-accelerated and triggers repaints, plus reflow when glyph widths change. (https://valhead.com/2020/11/15/animating-variable-fonts-with-css/ , https://developer.mozilla.org/en-US/docs/Web/CSS/font-variation-settings)
  - Keep it to short headings, prefer CSS transitions over JS, and avoid many per-character spans on mobile.
  - Width-neutral axes such as GRAD, SOFT, WONK and BNCE are cheaper than wght or wdth, and gating behind `prefers-reduced-motion` is sensible. **[unverified: my inference, no source found]**
- **User preferences.** Size in `rem`, never set a px root size, and survive 1.4.12 overrides and 200% zoom. (https://www.joshwcomeau.com/css/surprising-truth-about-pixels-and-accessibility/) Given Wallace et al., a user-facing reading-font switcher is evidence-backed. I found nothing on users who force their own fonts. **[unverified]**

## 5. Underline

- **WCAG 1.4.1.** Links must not be distinguished by colour alone. Without an underline you need 3:1 contrast against surrounding text plus a non-colour cue on hover and focus (technique G183; failure F73). Underlining is the most robust option. (https://www.w3.org/WAI/WCAG22/Techniques/general/G183.html)
- **Underline as emphasis is read as a link.** The ALA and Edinburgh say do not underline non-links on the web. (https://information-services.ed.ac.uk/editorial-style-guide/formatting/bold-italic-and-underlined-text)
- **Styling.** A `text-underline-offset` of about 2–3px and a slightly thicker or muted underline improve legibility. (https://frontendmasters.com/blog/chilled-out-text-underlines)
- `text-decoration-skip-ink: auto` is the browser default and keeps descenders clear; em-based thickness and offset scale better than px. **[unverified: my knowledge]**
- **If underline is a semantic tool,** make it visibly different from links. Use wavy, dotted or highlighter-style `text-decoration`, a different colour, and no pointer cursor, and reserve the solid underline for links. **[my recommendation]**

## Recommendations

1. **Professional voice:** Atkinson Hyperlegible Next, with its Mono for code, at a body size of 1.125rem or more, line-height about 1.5, and a 60–75ch measure. Alternatives with more character are Instrument Sans, Figtree or Hanken Grotesk. Avoid Inter, Geist and Space Grotesk.
2. **Fancy voice:** Fraunces, animating SOFT, WONK and opsz for ceremony, and using its extremes so it does not read as the default. For something less common, use Playfair, Kalnia or Bodoni Moda. Skip Instrument Serif, which is static and overexposed.
3. **Fun voice:** Shantell Sans, with BNCE and INFM for celebrations and empty states. Lazy-load it with `font-display: optional`.
4. **Budget alternative:** Recursive alone covers professional (CASL 0), fun (CASL 1) and mono, leaving one extra file for Fraunces.
5. **Emphasis rules:** bold for importance, via `<strong>`. Italic for short phrases only, via `<em>`. Solid underline for links only, with a decorative underline variant for emphasis. Caps for short labels only, with added tracking.
6. **Loading:** self-host via Fontsource, as subsetted WOFF2. Preload only the body font, add metric-override fallbacks, use rem sizing, test with the 1.4.12 overrides, and gate axis animation behind `prefers-reduced-motion`.
7. **Reader choice:** offer a reading-font setting, such as system font or Atkinson, since the best font is individual.

## Sources

All URLs are inline above. The primary ones:

- Wallace et al. 2022: https://research.adobe.com/publication/towards-individuated-reading-experiences-different-fonts-increase-reading-speed-for-different-individuals
- Wery & Diliberto: https://pmc.ncbi.nlm.nih.gov/articles/PMC5629233
- Kuster et al.: https://pmc.ncbi.nlm.nih.gov/articles/PMC5934461
- Arditi & Cho: https://pmc.ncbi.nlm.nih.gov/articles/PMC2016788
- Rello et al.: https://researchr.org/publication/RelloPM16
- WCAG 1.4.12: https://www.w3.org/WAI/WCAG22/Understanding/text-spacing
- WCAG G183: https://www.w3.org/WAI/WCAG22/Techniques/general/G183.html
- Chrome font fallbacks: https://developer.chrome.com/blog/font-fallbacks
- web.dev fonts: https://web.dev/learn/performance/optimize-web-fonts
- Muzli pairings 2026: https://muz.li/blog/font-pairings-2026/
- Fraunces README: https://github.com/undercasetype/Fraunces
- Font metadata: `https://registry.npmjs.org/@fontsource-variable/<slug>/latest` (the `metadata.json` inside each tarball)
