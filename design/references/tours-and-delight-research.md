# Guided tours and easter eggs: research findings for a web-app design language

**How far to trust this.** `nngroup.com` and `developer.chrome.com` are outside this session's allowed network domains, so every NN/g claim below comes from search excerpts, not the full articles. Library versions, dates and licences were read directly from the npm registry on 2026-11-22 and are solid. Benchmark numbers are all vendor self-reported. Items marked **[unverified]** are from memory or secondary sources only.

## A. Guided tours

### 1. Do tours work?

The evidence supports a replayable, user-started tour and argues against a forced first-run tour.

- **NN/g on tutorials:** in its mobile study, users who read tutorials had lower task success (91%) than those who skipped them (94%), rated tasks as harder, and were no faster. NN/g's position is to skip onboarding where possible and fix the UI instead. https://www.nngroup.com/articles/mobile-tutorials/ and https://www.nngroup.com/articles/mobile-app-onboarding/
- **Push vs pull revelations:** push help arrives without context and blocks the interface; pull help is triggered by a signal that the user needs it now (hover tooltips, contextual coach marks, wizards). NN/g prefers pull. https://www.nngroup.com/articles/onboarding-tutorials/
- **Coach marks:** users dismiss overlays quickly without reading, so keep them very short, show few at once, and make them look different from the real UI. https://www.nngroup.com/articles/mobile-instructional-overlay/
- **Paradox of the active user (Carroll & Rosson, 1987):** people start using software immediately and will not read instructions first, even when that would save time. https://www.nngroup.com/articles/paradox-of-the-active-user/ and https://lawsofux.com/paradox-of-the-active-user/
- **Minimalism (Carroll, *The Nurnberg Funnel*, 1990):** instruction should be task-oriented and learn-by-doing, not merely shorter. https://aura-lab.siue.edu/theories/minimalism/ — the specific "minimal manual" experiment results are **[unverified]**.
- **Progressive disclosure:** defer advanced features to a secondary surface. https://www.nngroup.com/articles/progressive-disclosure/

Benchmarks (all vendor data; samples and definitions shift between years):

| Finding | Number | Year | Source |
|---|---|---|---|
| Average tour completion | 33.5% | 2024 | Chameleon |
| User-launched tour completion | 64% | 2024 | Chameleon |
| Launcher-started vs overall average | 61.65% vs ~30% | 2023 | Chameleon |
| Five-step tour completion | 21.6% | 2024 | Chameleon |
| Four-step tour completion | 46% | 2019 | Chameleon |
| Three-step / seven-step completion | 72% / 16% | 2025 | Chameleon blog, not the primary report **[unverified]** |
| Click-triggered vs delay-triggered | 67% vs 31% | 2025 | Chameleon via Userpilot **[unverified]** |
| User-initiated vs auto-started (median) | 69% vs 23% | 2026 | Produktly, 464 companies |
| By length: 1–2 / 3–5 / 6–8 / 9+ steps | 73% / 38% / 25% / 8% | 2026 | Produktly |

Sources: https://www.chameleon.io/benchmark-report-24, https://www.chameleon.io/benchmark-report-2023, https://www.chameleon.io/assets/chameleon-product-tour-benchmarks-report-2019.pdf, https://www.chameleon.io/blog/effective-product-tour-metrics, https://userpilot.com/blog/product-tours/, https://produktly.com/research/saas-onboarding-benchmarks-2026

Chameleon's blog also quotes a 61% average completion, which conflicts with its own 33.5% figure; treat the absolute values as soft. The direction is consistent everywhere: user-initiated tours complete two to three times as often as auto-started ones, and completion falls sharply past four or five steps. Appcues itself cautions that completion is not the same as successful onboarding (https://www.appcues.com/blog/app-onboarding-statistics). I found no primary Appcues or Userpilot benchmark report.

### 2. Patterns

- Keep the tour short. Fluent UI caps coach-mark sequences at three steps: https://cdn.jsdelivr.net/npm/@fluentui/react-examples@8.34.4/src/react/Coachmark/docs/CoachmarkBestPractices.md
- Keep each step brief, tied to the action it explains, and never covering the thing it points at (Adobe Spectrum): https://spectrum.adobe.com/page/coach-mark
- Tours fail when they interrupt a task in progress (NN/g's bank-app example), run long, auto-start, or paper over a confusing UI.
- A permanent launcher ("Take the tour" in a help menu) is the best-supported pattern, which matches pillar A. Push vs pull overview: https://chameleon.io/blog/delivering-help-ux
- Apple's TipKit is a platform model for contextual, rule-triggered tips: https://developer.apple.com/documentation/tipkit

### 3. Accessibility

These are practitioner and design-system patterns, not normative WCAG text.

- **Semantics:** give each step `role="dialog"`, labelled by its title and described by its body, with a polite live region announcing "Step 2 of 4". https://globalhive.github.io/vuejs-tour/guide/accessibility.html and https://react-tourlight.vercel.app/docs/accessibility
- **Focus:** move focus into the step when it opens. On close, sources disagree: some restore focus to the launcher, while Abyss lands on the last highlighted item. https://abyss.uhc.com/web/ui/coachmark — I'd restore to the launcher.
- **Escape and trapping:** Escape should dismiss the whole tour. A focus trap is acceptable only if Escape and a visible close button both release it (WCAG 2.1.2 No Keyboard Trap, cited secondhand). https://kompassify.com/blog/accessible-onboarding-guide and https://bugzilla.mozilla.org/show_bug.cgi?id=1788253
- **Spotlight overlays:** they can sit on top of interactive elements and make them unreachable.
- **Motion:** gate spotlight and scroll animation on `prefers-reduced-motion`; reduce it, don't necessarily remove it. https://web.dev/learn/accessibility/motion and https://developer.mozilla.org/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion

### 4. Libraries (npm registry, 2026-11-22)

| Library | Latest | Released | Licence | Notes |
|---|---|---|---|---|
| Driver.js | 1.14.0 | 2026-11-13 | MIT | 27.2k stars, 1 open issue, vanilla JS; the safest default |
| Shepherd.js | 16.0.0 | 2026-11-11 | AGPL-3.0 + commercial | Licence changed |
| Intro.js | 8.7.0 | 2026-11-20 | AGPL-3.0 + commercial | 23.5k stars |
| React Joyride | 3.2.0 | 2026-07-09 | MIT | v3 supports React 16.8–19 |
| Reactour (`@reactour/tour`) | 3.8.0 | 2025-05-07 | MIT | No release in 18 months |
| Onborda | 1.2.5 | 2024-12-22 | MIT | Next.js only; looks stale |
| NextStepjs | 2.3.0 | 2026-07-20 | MIT | Next.js, React Router, Remix |
| TourGuide.js (`@sjmc11/tourguidejs`) | 0.0.27 | 2025-05-06 | MIT | Still pre-1.0 |
| Frigade (`@frigade/react`) | 2.10.8 | 2026-09-16 | ELv2 | Source-available SDK for a SaaS |

- **Shepherd's licence change is confirmed.** 13.0.3 (2024-08-05) was MIT; 14.0.1 (2024-10-10) onward is AGPL-3.0. Its LICENSE.md requires a paid licence for any revenue-generating company, including internal tools; the free tier covers open-source, personal and 30-day evaluation use. https://raw.githubusercontent.com/shipshapecode/shepherd/main/LICENSE.md and https://github.com/shipshapecode/shepherd
- Driver.js: https://github.com/kamranahmedse/driver.js. Intro.js: https://github.com/usablica/intro.js. React Joyride: https://cdn.jsdelivr.net/npm/react-joyride@3.1.0/README.md
- Comparisons used for sentiment (the first is a vendor, the second a competitor's page): https://inlinemanual.com/blog/driverjs-vs-introjs-vs-shepherdjs-vs-reactour, https://guide-js.pages.dev/alternatives/onborda, https://blog.logrocket.com/best-product-tour-js-libraries-frontend-apps/
- **SaaS (Appcues, Userflow, Chameleon, Frigade):** I did not check pricing, terms or current status. **[unverified]** They are built for product teams running experiments and are overkill for a personal design language.

**Native building blocks:**
- The Popover API has been Baseline since 2025-01-27 (Safari 18.3). Popovers are always non-modal and do not make the page inert; use `<dialog>` for modal steps. `<dialog popover>` is valid. https://web.dev/blog/popover-baseline and https://developer.mozilla.org/docs/Web/API/Popover_API
- CSS anchor positioning became Baseline Newly available in January 2026 (Firefox 147, Safari 26), but caniuse still marks Firefox and early Safari 26.x as partial, so ship a fallback position. https://web.dev/blog/web-platform-01-2026 and https://caniuse.com/css-anchor-positioning
- Chrome publishes a guide to exactly this pattern, "persistent app tours", which I could not read: https://developer.chrome.com/docs/modern-web-guidance/guides/ui-components/persistent-app-tours.md.txt
- `<dialog>`/`showModal()` Baseline status was not checked. **[unverified]**

## B. Easter eggs and delight

### 5. Theory

- **Surface vs deep delight (NN/g, Fessenden):** surface delight is local and isolated (animations, transitions, gestures) and fades. Deep delight is holistic and arrives only when functionality, reliability, usability and pleasure are all met. Surface delight on a weak base loses its return. https://www.nngroup.com/articles/theory-user-delight/
- **Aarron Walter, *Designing for Emotion* (2011):** a pyramid of functional, reliable, usable, then pleasurable; the top layer only counts once the others hold. https://www.oreilly.com/library/view/designing-for-emotion/9780133052954/ and https://vasilis.nl/research/2018/02/a-comparison-of-three-pyramids/
- **Kano:** delighters decay. Kano (2001) describes attributes moving from attractive to one-dimensional to must-be, with mixed empirical support for the exact path. https://en.wikipedia.org/wiki/Kano_model and https://www.emerald.com/insight/content/doi/10.1108/09564230510592289/full/html
- **Peak-end rule:** peaks and endings dominate memory, and negative peaks count too. https://www.nngroup.com/articles/peak-end-rule/ and https://lawsofux.com/peak-end-rule/
- **Aesthetic-usability effect:** attractive design earns forgiveness for minor problems, not major ones. https://www.nngroup.com/articles/aesthetic-usability-effect/
- **Saffer, *Microinteractions*:** trigger, rules, feedback, loops and modes. "Long loops" ask what happens on the tenth or thousandth use; "signature moments" are microinteractions that become part of the brand. https://www.oreilly.com/library/view/microinteractions/9781449342760/ and https://smartdesignworldwide.com/ideas/microinteractions-details-matter/

**When whimsy backfires.** This is practitioner opinion; I found no controlled study of repeated exposure to playful copy.
- Clarity beats the joke; if the message is lost, cut the joke. https://marvelapp.com/blog/ux-microcopy-finding-balance-empathy-humor/
- Keep humour out of failed-task errors and anything about security, privacy or data loss. https://techbuzzonline.com/error-message-humor-guidelines and https://spotless.co.uk/journal/using-humour-in-ux
- Stock "Oops!" copy goes stale. https://uxdesign.cc/10-ux-copy-messages-that-have-gone-stale-cf2b5a5deaed
- Clippy is the standard cautionary tale (secondary source). The claim that Mailchimp's UK users asked to switch the jokes off is **[unverified]**.

### 6. Loved examples and what they share

- **Asana celebration creatures** (unicorn, narwhal, phoenix, yeti): they reward a real accomplishment, appear only sometimes, and can be switched off in settings. https://asana.com/inside-asana/new-celebrations-meet-the-yeti
- **Slack loading messages:** they fill dead time, vary at random, and teams can write their own or turn them off. https://slack1447178842.zendesk.com/hc/en-us/articles/360000561106-Customize-loading-messages (Slack help-centre mirror)
- **Konami code:** used by BuzzFeed, Digg, British Vogue and Paul Irish's site; a write-up also documents confetti on Stripe.com. https://gizmodo.com/the-best-easter-eggs-on-the-internet-1667711776, https://amitmerchant.com/implement-konami-code-easter-egg/, https://github.com/georgemandis/konami-js
- **Raycast confetti:** a built-in command, callable through the `raycast://confetti` deeplink, so users wire it into their own workflows. https://manual.raycast.com/deeplinks
- **Console and header messages:** hiring notes in DevTools and response headers (NYT, Pinterest). https://www.vice.com/en/article/the-new-york-times-and-pinterest-have-a-hidden-message-for-developers
- **General catalogue:** https://indieweb.org/easter_egg
- **Not sourced:** I found nothing citable for Linear, Vercel, GitHub (Octocat 404) or `/humans.txt` (humanstxt.org). **[unverified]**

The common traits: each is opt-in or earned, costs nothing to ignore, varies, sits outside the critical path, and can be turned off.

**Accessibility of easter eggs.** I found no dedicated guidance; this is derived from WCAG.
- **Key sequences:** WCAG 2.1.4 Character Key Shortcuts (Level A) requires that shortcuts made of character keys can be turned off or remapped. The Konami code ends in B, A, which collides with screen-reader quick keys (JAWS uses B for "next button") and speech input. That it applies to the Konami code is my inference. https://www.w3.org/WAI/WCAG21/Understanding/character-key-shortcuts
- **Motion:** WCAG 2.2.2 Pause, Stop, Hide (A) and 2.3.3 Animation from Interactions (AAA) apply to confetti and similar effects. https://specification.website/spec/accessibility/reduced-motion/
- **Sound:** WCAG 1.4.2 Audio Control is the relevant criterion; I did not source it here. **[unverified]**

## Recommendations

1. Ship the tour as pull, not push: a permanent "Take the tour" launcher, plus at most one dismissible first-run offer. Never auto-start it mid-task.
2. Cap it at three to five steps, one idea each. Prefer steps that advance when the user does the thing; split longer content into per-feature mini-tours.
3. Treat the tour as a supplement. Empty states and contextual hints carry the real teaching; if the app needs the tour, fix the app.
4. Make it skippable at every step, resumable, replayable, and non-blocking. Escape exits, and focus returns to the launcher.
5. Build each step as a labelled dialog with a polite "Step n of m" announcement, never cover the target, and honour reduced motion.
6. For implementation, go native (Popover API, `<dialog>`, anchor positioning with a fallback) or use Driver.js. Avoid Shepherd and Intro.js unless AGPL or a paid licence is acceptable.
7. Earn delight in order: functional, reliable, usable, then pleasurable.
8. Design for the thousandth exposure: make eggs rare, varied and tied to real accomplishment, and provide an off switch.
9. Keep whimsy out of errors, destructive actions, security, payments and data loss.
10. Easter-egg accessibility contract: never the only route to a function; reachable without a pointer; key-sequence triggers ignored while typing in inputs and possible to disable; reduced-motion safe; no sound by default; decorative output hidden from assistive tech or announced once, politely; never focus-stealing or blocking.
11. Give eggs a quiet discovery trail (console message, `/humans.txt`, an "about" page) so they are findable without being advertised.

## Sources

All URLs are cited inline above. Hosts that could not be fetched directly: `www.nngroup.com`, `developer.chrome.com` (they would need to be allowed in the session's network settings to verify the NN/g wording and read the Chrome tours guide).
