# Research report: a fluid, "mercury" design language — evidence and platform status (Nov 2026)

**Method caveat.** Direct page fetches were blocked in this session (nngroup.com, benji.org, rauno.me, emilkowal.ski, developer.chrome.com and web-platform-dx.github.io are outside the allowed network domains). Everything below comes from search-result excerpts, except items marked **[unverified]**, which are from my own background knowledge and were not confirmed against a source this session.

## 1. Apple Liquid Glass

**What it is.** Announced 9 June 2025 for iOS/macOS 26. Apple describes it as a translucent material that "reflects and refracts its surroundings", with controls forming a distinct functional layer above content and shapes concentric with hardware corners. Apple's stated goals were hierarchy, harmony and consistency (attributed to Billy Sorrentino via TechRepublic). [apple.com newsroom] [techrepublic]

**Reception.**
- NN/g published "Liquid Glass Is Cracked, and Usability Suffers in iOS 26". Its thesis is that the material obscures content instead of letting it take centre stage, on the old principle that anything placed on top of something else becomes harder to see. It calls the result "light, airy — and often invisible". I only saw excerpts, so its detailed findings are **[unverified]**. [nngroup]
- TidBITS and others cited legibility problems, animation lag and eye strain. [tidbits] [slashgear]

**Apple's retreat, step by step.**
- **iOS 26.1 (autumn 2025):** added a Clear/Tinted toggle under Display & Brightness. Reviewers found its effect modest and uneven across elements. [macrumors] [tidbits]
- **Accessibility settings:** Reduce Transparency is a separate setting; on macOS Tahoe, Increase Contrast forces it on. [sixcolors]
- **iOS 27 (June 2026):** added a continuous slider from "Ultra Clear" to "Fully Tinted", and reworked the blur so complex backgrounds are diffused more. Existing apps inherit this automatically. [9to5mac] [macrumors-27]
- **Still contested:** MacStories' iOS 27 review reports severe legibility problems where content scrolls under tab bars and floating toolbars. Digital Trends reads the slider as an admission. [macstories] [digitaltrends]

**Lessons.**
- Material is a variable, so give users an opacity dial from day one.
- Guarantee contrast against the worst-case backdrop, not the hero screenshot.
- Keep glass for the navigation layer, never for content.
- Honour the transparency and contrast preferences automatically.
- Ship an opaque variant as a first-class material, not a fallback.

## 2. UI motion: purpose, timing, evidence

**Purpose and timing (NN/g).**
- Most UI animation should run 100–500 ms, scaled by distance and complexity; about 100 ms for toggle or checkbox feedback.
- Choose the shortest duration that isn't jarring. Animations are more often too long than too short.
- Eased motion reads as more natural than linear. [nngroup-duration]
- NN/g's framing of motion as serving feedback, state change, spatial orientation and attention is **[unverified]** (article not fetched).

**Material 3 Expressive (May 2025).**
- Google reports 46 studies with more than 18,000 participants.
- In eye-tracking, participants found the key action up to 4x faster.
- The age gap in spotting key elements reportedly disappeared (secondary paraphrase).
- These are vendor-published claims and the methods are not independently reviewed. [design.google] [dezeen]
- M3 replaced duration-and-easing with a spring "motion physics" system: spatial tokens (position/size, may overshoot) and effects tokens (colour/opacity, no bounce), each in fast/default/slow, under "standard" and "expressive" schemes. The structure comes from third-party ports; the numeric values conflict between ports and are **[unverified]**. [m3e-port]

**Apple HIG motion.** Purposeful, brief, optional, never the sole carrier of information, and interruptible. **[unverified]**, not fetched.

**Does animation help comprehension?** The evidence is mixed.
- Heer & Robertson (2007) found significant benefits of animated transitions for object tracking and value estimation, and recommend staging so one thing changes at a time. [heer]
- Tversky et al. (2002) found no comprehension benefit once information content is equalised.
- Robertson et al. (2008) found animated trend charts less accurate than small multiples. [uw-course]
- Takeaway: animation reliably helps with continuity and object constancy, not with understanding.

**Over-animation.** Practitioner consensus rather than controlled evidence: animate less the more often an action happens, and don't animate keyboard-driven or high-frequency actions. The Kowalski and Freiberg specifics are **[unverified]** (see section 5).

## 3. Accessibility

**WCAG 2.2 criteria** (all **[unverified]** this session; wording from memory of w3.org/TR/WCAG22):
- **2.3.3 Animation from Interactions (AAA):** motion triggered by interaction can be disabled unless essential.
- **2.2.2 Pause, Stop, Hide (A):** auto-starting motion lasting over 5 s alongside other content needs a control.
- **2.3.1 (A):** no more than 3 flashes per second.
- **1.4.3 / 1.4.11:** 4.5:1 for text and 3:1 for UI components. Over translucent or blurred surfaces this must hold for every backdrop the surface can sit on, which in practice means a minimum-opacity scrim.
- **2.4.11 Focus Not Obscured (AA):** floating or sticky "blob" navigation must not fully cover the focused element.
- **2.4.7 / 2.4.13:** visible focus, and focus appearance.
- **2.5.8 Target Size (AA):** 24×24 CSS px minimum, or adequate spacing. Morphing targets must stay hittable mid-transition.

**Reduced motion.**
- "Reduce is not remove": keep opacity and colour fades, and drop scale, slide, parallax, spring overshoot and morphs.
- CSS-Tricks criticises the blanket `animation-duration: 0.01ms` reset.
- web.dev suggests making the reduced version the default when motion isn't needed for comprehension. [css-tricks] [web.dev-motion] [mdn-prm]

**Preference media queries.**
- `prefers-reduced-transparency`: Chromium 118+; Safari not supported; Firefox was behind a flag, and caniuse data conflicts on whether recent versions (about 156+) ship it. Treat it as Chromium-only progressive enhancement and add an in-app toggle. [caniuse-prt] [chrome-prt]
- `prefers-contrast` and `forced-colors`: widely supported **[unverified]**. In forced-colors mode, backgrounds, shadows and blur filters are overridden, so every material needs real borders.

**WCAG 3 and APCA.** WCAG 3 is still a Working Draft (drafts in March and September 2026), with a standard "a few years" out; it does not replace WCAG 2. APCA's status is unsettled. My recollection that it was pulled from the draft text in 2023 pending further research is **[unverified]**. Use APCA as a secondary design check and conform to WCAG 2.2 ratios. [w3c-wcag3] [w3c-news]

## 4. Web implementation status

| Technique | Support (Chromium / Safari / Firefox) | Notes |
|---|---|---|
| Same-document View Transitions | 111 / 18 / 144; Baseline Oct 2025 | Snapshot-based; old state is non-interactive while running [web.dev-vt] |
| Cross-document (`@view-transition`) | 126 / 18.2 / partial or absent (sources conflict at 147) | Same-origin only [caniuse-xdoc] |
| `view-transition-name: match-element` | 137 / 18.4 / 144 | Removes the need for per-item unique names [caniuse-me] |
| Element-scoped `el.startViewTransition()` | 147 (Apr 2026) / no / no | Concurrent and nested transitions; best fit for "mercury" components [chrome-scoped] |
| `linear()` easing | Baseline since about Dec 2023 **[unverified]** | Bake springs to `linear()`; fixed duration, not velocity-aware |
| `@starting-style` + `transition-behavior: allow-discrete` | 117 / 17.4–17.5 / 129; Baseline Aug 2024 | Entry and exit from `display: none` and the top layer [web.dev-entry] |
| `interpolate-size` / `calc-size()` | 129 / Technology Preview only / no | Animates layout, so it is costly; enhancement only [caniuse-is] |
| Scroll-driven animations | 115 / 26 / 159 (Oct 2026); Baseline newly | Compositor-driven; gate behind reduced-motion [web.dev-oct26] |
| Anchor positioning | 125 / 26 / 147; Baseline Jan 2026 | [web.dev-jan26] |
| Popover API, `<dialog>` | Baseline **[unverified]** | Give free top-layer, focus and light-dismiss handling |
| `backdrop-filter: blur()` | Baseline **[unverified]** | Expensive: large radii over scrolling content cost GPU; avoid nesting and animating the radius |
| SVG filter in `backdrop-filter` (feDisplacementMap refraction) | Chromium only, out of spec | Others fall back to plain blur; use `@supports`. Refracts only what is behind the box [logrocket] [ekino] [aave] |
| SVG gooey filter (blur + feColorMatrix alpha threshold) | Everywhere in principle | CPU-heavy; slow or unreliable on Safari/iOS and inconsistent on DOM elements in Firefox [css-tricks-gooey] [webkit-bug] [drweb] |
| `corner-shape: squircle` | 139 (Aug 2025) / no / no | Falls back to `border-radius` [caniuse-cs] [smashing] |
| `shape()` in `clip-path` | 135 / 18.4 / about 148 (conflicting) | Interpolates when command lists match [chrome-shape] |

**Gooey filter accessibility pitfall.** The filter blurs and thresholds its children, so text and focus rings inside it are destroyed. Keep the goo on a decorative `aria-hidden` layer with real controls above it. This is my inference from how the filter works, not a sourced claim.

**SDF/WebGL metaballs.** The most controllable and fastest "mercury" approach at scale, but a canvas is invisible to assistive technology, so it must be mirrored by a real DOM. No source was checked for this.

**Libraries.**
- **Motion** (formerly Framer Motion): independent since Nov 2024, imported from `motion/react`. Its `layout`/`layoutId` animations are FLIP-style and transform-only. [motion-blog] [motion-docs]
- **GSAP:** fully free including MorphSVG, Flip and SplitText since 30 Apr 2025, after the Webflow acquisition. The licence has Webflow-related restrictions, so read it. [webflow] [gsap]
- **Rive, Lottie, AutoAnimate:** not researched this session **[unverified]**.

## 5. Prior art

- **Benji Taylor, "Family Values":** three pillars of Simplicity, Fluidity and Delight, where each depends on the previous one; rarer features deserve more delight; nothing should "teleport". Seen only through a secondhand summary. [benji]
- **Rauno Freiberg, "Invisible Details of Interaction Design" (2023):** interaction design as responding "fluidly to human intent". His points on frequency of use and the Dynamic Island are **[unverified]**. [rauno]
- **Emil Kowalski:** easing matters most; in functional contexts "no animation would be better"; honour the motion preference. The under-300 ms, ease-out and "never animate keyboard actions" rules are **[unverified]**. [emil-good] [emil-7]
- **Dynamic Island and Material container transform (FAB to sheet):** canonical shared-element morphs **[unverified]**.
- **Gooey menus:** Lucas Bebber's 2015 CSS-Tricks and Codrops pieces. [css-tricks-gooey] [codrops]

## Recommendations

1. Define materials as tokens (opaque, paper, metal, glass), each with a guaranteed minimum scrim. Meet 4.5:1 and 3:1 against the worst-case backdrop, and expose a user opacity control.
2. Make opaque the baseline material. Glass, refraction and squircles are `@supports` enhancements, since they are Chromium-only today.
3. Build "gather and spread" on View Transitions: `match-element` is cross-browser, scoped transitions are Chromium 147+. Fall back to Motion layout animation or FLIP. Use goo filters or SDF only as a decorative, non-semantic layer.
4. Use two motion channels as M3 does: spatial springs that may overshoot, and effects that never bounce. Target about 100–500 ms settle time, and keep everything interruptible.
5. For reduced motion, swap morphs for cross-fades of 150 ms or less; never zero everything out. Also wire up `prefers-reduced-transparency`, `prefers-contrast` and `forced-colors` (real borders).
6. Set a frequency budget: no decorative motion on keyboard or high-frequency actions, and save expressive merges for rare, meaningful transitions.
7. Keep focus visible and unobscured by floating blobs, with 24 px minimum targets (44 px preferred) throughout a morph.
8. Stage transitions so one thing changes at a time, and justify motion by continuity, not comprehension.

## Sources

- [apple.com newsroom] https://www.apple.com/newsroom/2025/06/apple-introduces-a-delightful-and-elegant-new-software-design/
- [techrepublic] https://www.techrepublic.com/article/news-apple-platforms-state-union-2025/
- [nngroup] https://www.nngroup.com/articles/liquid-glass/
- [tidbits] https://tidbits.com/2025/10/21/ios-26-1-to-add-optional-opacity-to-liquid-glass/
- [macrumors] https://www.macrumors.com/how-to/ios-26-1-reduce-liquid-glass-effects/
- [sixcolors] https://sixcolors.com/post/2025/11/soaping-up-liquid-glass-less-transparency-more-contrast/
- [slashgear] https://www.slashgear.com/2019119/ios-26-update-liquid-glass-control-users-say-not-enough/
- [9to5mac] https://9to5mac.com/2026/06/12/ios-27-fixes-liquid-glass-and-not-just-with-a-slider/
- [macrumors-27] https://macrumors.com/2026/06/10/how-liquid-glass-is-changing-in-ios-27
- [macstories] https://www.macstories.net/stories/ios-and-ipados-27-review/2/
- [digitaltrends] https://www.digitaltrends.com/computing/apple-made-liquid-glass-adjustable-which-says-plenty-about-liquid-glass/
- [nngroup-duration] https://www.nngroup.com/articles/animation-duration/
- [design.google] https://design.google/library/expressive-material-design-google-research
- [dezeen] https://dezeen.com/2025/05/28/google-ushers-in-age-of-expressive-interfaces-with-material-design-update/
- [m3e-port] https://matraic.github.io/m3e/styles/motion.html
- [heer] https://homes.cs.washington.edu/~jheer/files/2007-AnimatedTrans-InfoVis.pdf
- [uw-course] https://courses.cs.washington.edu/courses/cse442/24au/lectures/CSE442-Animation.pdf
- [css-tricks] https://css-tricks.com/?p=363057
- [web.dev-motion] https://web.dev/learn/accessibility/motion
- [mdn-prm] https://developer.mozilla.org/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion
- [caniuse-prt] https://caniuse.com/mdn-css_at-rules_media_prefers-reduced-transparency
- [chrome-prt] https://developer.chrome.com/blog/css-prefers-reduced-transparency
- [w3c-wcag3] https://www.w3.org/WAI/WCAG3
- [w3c-news] https://www.w3.org/WAI/news/2026-03-03/wcag3
- [web.dev-vt] https://web.dev/blog/same-document-view-transitions-are-now-baseline-newly-available
- [caniuse-xdoc] https://caniuse.com/cross-document-view-transitions
- [caniuse-me] https://caniuse.com/mdn-css_properties_view-transition-name_match-element
- [chrome-vt2025] https://developer.chrome.com/blog/view-transitions-in-2025
- [chrome-scoped] https://developer.chrome.com/blog/element-scoped-view-transitions
- [web.dev-entry] https://web.dev/blog/baseline-entry-animations
- [caniuse-is] https://caniuse.com/mdn-css_properties_interpolate-size
- [web.dev-oct26] https://web.dev/blog/web-platform-10-2026
- [web.dev-jan26] https://web.dev/blog/web-platform-01-2026
- [logrocket] https://blog.logrocket.com/how-create-liquid-glass-effects-css-and-svg/
- [ekino] https://medium.com/ekino-france/liquid-glass-in-css-and-svg-839985fcb88d
- [aave] https://aave.com/design/building-glass-for-the-web
- [css-tricks-gooey] https://css-tricks.com/?p=195076
- [codrops] https://tympanus.net/codrops/2015/03/10/creative-gooey-effects/
- [webkit-bug] https://bugs.webkit.org/show_bug.cgi?id=191197
- [drweb] https://www.drweb.de/liquid-gooey-react-komponente-safari/
- [caniuse-cs] https://caniuse.com/mdn-css_properties_corner-shape_squircle
- [smashing] https://www.smashingmagazine.com/2026/03/beyond-border-radius-css-corner-shape-property-ui/
- [chrome-shape] https://developer.chrome.com/blog/css-shape
- [motion-blog] https://motion.dev/blog/framer-motion-is-now-independent-introducing-motion
- [motion-docs] https://motion.dev/docs/react-layout-animations
- [webflow] https://webflow.com/blog/gsap-becomes-free
- [gsap] https://gsap.com/blog/3-13/
- [benji] https://benji.org/family-values
- [rauno] https://rauno.me/craft/interaction-design
- [emil-good] https://emilkowal.ski/ui/good-vs-great-animations
- [emil-7] https://emilkowal.ski/ui/7-practical-animation-tips

Check before publishing the spec: WCAG wording at https://www.w3.org/TR/WCAG22/, and live MDN/caniuse data for the cross-document, `shape()`, `interpolate-size` and `prefers-reduced-transparency` rows, where sources conflicted.
