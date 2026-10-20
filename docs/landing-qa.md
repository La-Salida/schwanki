# Landing page visual regression checks

Check the initial, revealed, subsequent-card, comparison, and completed states.
Use the manual arrows in short windows; page scroll drives taller windows.

| Viewport | Regression to prevent |
| --- | --- |
| 320 × 568 | Copy and revealed vocabulary must not overlap; controls remain reachable by normal page scroll. |
| 390 × 667 | Initial and revealed vocabulary must clear the copy. |
| 390 × 681, 700, 736, 800 | Check every card above the short-window cutoff; expanded copy must not reappear over vocabulary. |
| 390 × 844 | Full-screen feed; compact copy after reveal; no horizontal scrolling. |
| 1280 × 720 | Full-screen feed with headline left and vocabulary right. |

For each active card, run this read-only browser assertion after transitions
settle. It reproduced the short-screen overlap before the fix on October 20,
2026. The same assertion must pass with the answer hidden and revealed.

```js
const copy = document.querySelector('.landing-hero-copy').getBoundingClientRect();
const element = document.querySelector(
  '.hero-feed-slide[aria-hidden="false"] .hero-feed-content'
);
const content = element.getBoundingClientRect();
// offsetTop ignores the feed track's temporary slide transition.
const contentTop = document.querySelector('.landing-hero-stage')
  .getBoundingClientRect().top + element.offsetTop;
const horizontalClearance = copy.right + 16 <= content.left;
const verticalClearance = copy.bottom + 16 <= contentTop;
console.assert(horizontalClearance || verticalClearance, 'Hero copy overlaps vocabulary');
console.assert(document.documentElement.scrollWidth <= innerWidth, 'Horizontal overflow');
```

Also check keyboard navigation, skip link, poster fallback, pause control,
Google sign-in failure recovery, and reduced-motion mode. Reduced motion must
use manual steps with no automatic playback, scrolling, or card transitions.
The Vitest suites cover navigation, variable-length demo decks, media failures,
short-window/manual mode, reduced-motion playback, and accessible illustrations;
DOM-only tests cannot certify these visual layout conditions.
