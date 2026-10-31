import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const ids = [373493387, 546473125, 442415567, 1545429784, 1507775056,
  307840670, 635966718, 939540371, 6463744184, 1439949520];
const terms = ['flashcard', 'vocabulary', 'study', 'language', 'spaced repetition',
  'memory', 'offline', 'import', 'audio', 'visual', 'swipe', 'feed'];
const themes = {
  pricing: /subscription|paywall|expensive|price|payment|paid|cost/i,
  reliability: /crash|bug|glitch|freez|broken|not work|doesn.t work/i,
  sync: /sync|lost|missing|disappear/i,
  usability: /easy|simple|interface|design|confusing|difficult to use/i,
  learning: /learn|remember|memor|study|exam/i,
};
const fetchedAt = new Date().toISOString();
const lookupUrl = `https://itunes.apple.com/lookup?id=${ids.join(',')}&country=us&entity=software`;
const response = await fetch(lookupUrl);
if (!response.ok) throw new Error(`Apple lookup returned ${response.status}`);
const lookup = await response.json();
if (lookup.results.length !== ids.length) throw new Error('Incomplete competitor lookup');
const apps = [];
for (const id of ids) {
  const app = lookup.results.find(app => app.trackId === id);
  const opening = app.description.split(/\s+/).slice(0, 100).join(' ');
  const text = `${app.trackName} ${opening}`.toLowerCase();
  const coverage = Object.fromEntries(terms.map(term => [term,
    term === 'vocabulary' ? /vocab/.test(text) : text.includes(term)]));
  const reviewsUrl = `https://itunes.apple.com/us/rss/customerreviews/page=1/id=${id}/sortby=mostrecent/json`;
  let reviews = { url: reviewsUrl, available: false };
  try {
    const res = await fetch(reviewsUrl);
    if (res.ok) {
      const feed = await res.json();
      const sample = (feed.feed?.entry ?? []).filter(entry => entry['im:rating']);
      const themeCounts = (filter) => Object.fromEntries(Object.entries(themes).map(([theme, pattern]) =>
        [theme, sample.filter(entry => filter(Number(entry['im:rating'].label)) &&
          pattern.test(`${entry.title?.label} ${entry.content?.label}`)).length]));
      reviews = { url: reviewsUrl, available: true, sampleSize: sample.length,
        lowRatings: sample.filter(entry => Number(entry['im:rating'].label) <= 2).length,
        highRatings: sample.filter(entry => Number(entry['im:rating'].label) >= 4).length,
        lowRatingThemeMentions: themeCounts(rating => rating <= 2),
        highRatingThemeMentions: themeCounts(rating => rating >= 4),
        method: 'Keyword mentions in the latest public review page, grouped by star rating; not sentiment or prevalence estimates.' };
    }
  } catch { /* Preserve an explicit unavailable result rather than inventing reviews. */ }
  apps.push({ id, name: app.trackName, seller: app.sellerName,
    url: app.trackViewUrl, rating: app.averageUserRating, ratingCount: app.userRatingCount,
    price: app.formattedPrice, genres: app.genres, version: app.version,
    descriptionOpeningWordCount: opening.split(/\s+/).length, coverage, screenshotCount: app.screenshotUrls?.length ?? 0,
    screenshotUrls: app.screenshotUrls, iconUrl: app.artworkUrl512, reviews });
}
await mkdir(root, { recursive: true });
await writeFile(`${root}competitors.json`, JSON.stringify({ fetchedAt, storefront: 'US', lookupUrl,
  limitation: 'Public metadata sample. No keyword search-volume, download, ranking, conversion or revenue data.', apps }, null, 2) + '\n');
const matrix = ['| App | Rating / count | Screens | ' + terms.join(' | ') + ' |',
  '| --- | --- | --- | ' + terms.map(() => '---').join(' | ') + ' |',
  ...apps.map(app => `| [${app.name}](${app.url}) | ${app.rating.toFixed(2)} / ${app.ratingCount.toLocaleString('en-US')} | ${app.screenshotCount} | ${terms.map(term => app.coverage[term] ? 'yes' : '—').join(' | ')} |`),
  `| Coverage | | | ${terms.map(term => `${apps.filter(app => app.coverage[term]).length}/10`).join(' | ')} |`].join('\n');
const reviewRows = apps.map(app => `| ${app.name} | ${app.reviews.sampleSize ?? 'Unavailable'} | ${app.reviews.lowRatings ?? '—'} | ${app.reviews.highRatings ?? '—'} | ${Object.entries(app.reviews.lowRatingThemeMentions ?? {}).filter(([,n]) => n).map(([t,n]) => `${t}: ${n}`).join(', ') || '—'} |`);
await writeFile(`${root}competitor-matrix.md`, `# US competitor snapshot\n\nCollected ${fetchedAt}. Verified public Apple metadata for ten selected competitors: six flashcard tools, two language-learning apps, and two study tools. This is a comparison set, not an App Store top-ten ranking.\n\n${matrix}\n\nCoverage searches titles plus the first 100 description words, case-insensitively. “Vocabulary” includes “vocab”; other terms use literal substring matching. It is not a ranking or full-feature audit. Public ratings change over time. Subtitles are not available in this API and were not inferred.\n\n## Recent public review sample\n\n| App | Reviews sampled | 1–2 stars | 4–5 stars | Low-rating theme mentions |\n| --- | --- | --- | --- | --- |\n${reviewRows.join('\n')}\n\nThemes are simple keyword matches and can overlap. They indicate issues to inspect, not representative complaint rates. No private review data or reviewer identities are retained. Exact public feed URLs and aggregate counts are in competitors.json.\n\n## Positioning decision\n\n**Medium confidence:** lead with vocabulary flashcards; use the illustrated swipe feed as the reason to choose Schwanki. Treat “Doomscroll your vocab” as conversion copy rather than an established search term. Spaced repetition explains the learning mechanism. Avoid generic homework, exam-answering, AI-tutor and built-in-course claims: the iPhone companion does not provide those flows.\n\n**Verified scope:** iPhone review, sample feed, implemented deck import, offline cache and sync; creation/editing/document connections belong to the web. Native import remains gated on hosted migration and end-to-end acceptance before release.\n\n**Unverified:** monthly keyword volume, search difficulty, organic ranking, conversion lift and download forecasts. No numerical estimates are supplied without an ASO-provider dataset. A low coverage count alone does not demonstrate demand or competitive whitespace.\n`);
console.log(JSON.stringify({ competitors: apps.length, reviewSamples: apps.reduce((n, app) => n + (app.reviews.sampleSize ?? 0), 0), output: root }));
