import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, '..', 'dist');
const indexHtml = readFileSync(join(distDir, 'index.html'), 'utf-8');

// Routes to prerender
const routes = [
  {
    path: '/anki-alternative',
    title: 'Anki Alternative for Language Learners | Schwanki',
    description: 'Switch from Anki without starting over. Import .apkg/.colpkg with review history and FSRS v5 scheduling, then review in a swipeable mobile feed.',
    canonical: 'https://schwankiapp.com/anki-alternative'
  },
  {
    path: '/guides/export-anki-with-scheduling',
    title: 'Export Anki Decks Without Losing Progress (2026 Guide)',
    description: 'Progress reset after an .apkg import? Tick "Include scheduling information" in Anki\'s export. Step-by-step for Desktop, AnkiMobile & AnkiDroid.',
    canonical: 'https://schwankiapp.com/guides/export-anki-with-scheduling'
  }
];

function prerenderRoute({ path, title, description, canonical }) {
  // Update the index.html template with proper meta tags
  let html = indexHtml;
  
  // Replace title
  html = html.replace(
    /<title>.*?<\/title>/,
    `<title>${title}</title>`
  );
  
  // Update or add meta description
  html = html.replace(
    /<meta name="description" content="[^"]*" \/>/,
    `<meta name="description" content="${description}" />`
  );
  if (!html.includes(`<meta name="description" content="${description}"`)) {
    // If replacement didn't work, add it
    html = html.replace(
      '</head>',
      `<meta name="description" content="${description}" /></head>`
    );
  }
  
  // Add canonical link
  if (!html.includes('<link rel="canonical"')) {
    html = html.replace(
      '</head>',
      `<link rel="canonical" href="${canonical}"></head>`
    );
  }
  
  // Add Open Graph tags
  const ogTags = `
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${description}">
    <meta property="og:url" content="${canonical}">
    <meta property="og:type" content="article">
    <meta property="og:image" content="https://schwankiapp.com/icons/icon-512.png">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${title}">
    <meta name="twitter:description" content="${description}">
  `;
  
  html = html.replace('</head>', `${ogTags}</head>`);
  
  // Write to the appropriate directory
  const outputPath = join(distDir, path, 'index.html');
  const outputDir = dirname(outputPath);
  
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }
  
  writeFileSync(outputPath, html, 'utf-8');
  console.log(`✓ Prerendered ${path}`);
}

// Create 301 redirect for the alias
function createRedirect() {
  const redirectPath = join(distDir, 'guides', 'move-anki-decks-without-losing-progress');
  const redirectHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="0;url=/guides/export-anki-with-scheduling">
  <link rel="canonical" href="https://schwankiapp.com/guides/export-anki-with-scheduling">
  <title>Redirecting...</title>
</head>
<body>
  <p>Redirecting to <a href="/guides/export-anki-with-scheduling">Export Anki With Scheduling</a>...</p>
</body>
</html>`;
  
  if (!existsSync(redirectPath)) {
    mkdirSync(redirectPath, { recursive: true });
  }
  
  writeFileSync(join(redirectPath, 'index.html'), redirectHtml, 'utf-8');
  console.log('✓ Created redirect for /guides/move-anki-decks-without-losing-progress');
}

// Prerender all routes
routes.forEach(prerenderRoute);
createRedirect();

console.log('\nPrerendering complete! Routes:');
routes.forEach(({ path }) => console.log(`  - ${path}`));
console.log('  - /guides/move-anki-decks-without-losing-progress (redirect)');
