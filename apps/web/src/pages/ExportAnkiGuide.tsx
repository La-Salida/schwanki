import { Link } from "react-router-dom";
import { PAGES } from "@/lib/seo";
import { usePageMeta } from "@/lib/usePageMeta";

export default function ExportAnkiGuide() {
  usePageMeta(PAGES.exportAnkiGuide);

  return (
    <main className="page-shell landing-editorial">
      <article className="mx-auto max-w-3xl">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-4 text-sm text-ink/60">
          <Link to="/" className="hover:text-ink">Schwanki</Link> › <Link to="/anki-alternative" className="hover:text-ink">Anki Alternative</Link> › <span className="text-ink">Export Guide</span>
        </nav>

        {/* Page Header */}
        <header className="mb-8 space-y-4">
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-tight">
            How to Export Anki Decks Without Losing Your Progress (Include Scheduling Information, Explained)
          </h1>
          <p className="text-sm text-ink/60">Last verified: October 27, 2026 · Anki 26.09.3</p>
        </header>

        {/* Direct Answer Snippet */}
        <div className="mb-8 p-6 rounded-xl bg-white/60 border border-ink/20">
          <p className="text-lg leading-relaxed">
            <strong>To keep your progress, tick "Include scheduling information" when exporting an Anki Deck Package (.apkg).</strong> If you leave it unticked, Anki assumes you're sharing the deck and strips all scheduling data, including review history and marked and leech tags, so cards import as new. Also tick "Include media", or export a .colpkg, which always includes scheduling.
          </p>
        </div>

        {/* Sub-lede */}
        <div className="mb-8">
          <p className="text-lg">
            Already imported and everything is new? Your history isn't in the receiving app, because it was never in the file. Re-export from Anki with the box ticked (30 seconds) and import again. Sync first so the export has your latest reviews.
          </p>
        </div>

        {/* Table A: Checkbox Guide */}
        <section className="mb-16">
          <h2 className="text-2xl font-black tracking-tight mb-4">Anki Export Checkboxes Decoded</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <caption className="mb-4 text-left text-base">
                What each Anki export option does to your review history, FSRS state, leech tags, and media (Anki 26.09.3, per docs.ankiweb.net/exporting.html)
              </caption>
              <thead>
                <tr className="border-b-2 border-ink">
                  <th scope="col" className="p-3 text-left font-bold">Export option</th>
                  <th scope="col" className="p-3 text-left font-bold">Applies to</th>
                  <th scope="col" className="p-3 text-left font-bold">If ticked</th>
                  <th scope="col" className="p-3 text-left font-bold">If unticked</th>
                  <th scope="col" className="p-3 text-left font-bold">Effect on review history</th>
                  <th scope="col" className="p-3 text-left font-bold">Recommendation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/20">
                <tr>
                  <th scope="row" className="p-3 font-semibold">Include scheduling information</th>
                  <td className="p-3">.apkg (Deck Package)</td>
                  <td className="p-3">Review history and scheduling are exported</td>
                  <td className="p-3">Anki "will assume that you are sharing the deck with other people, and will remove the entire scheduling information, including marked and leech tags"</td>
                  <td className="p-3">✅ kept / ❌ removed</td>
                  <td className="p-3"><strong>Always tick</strong></td>
                </tr>
                <tr>
                  <th scope="row" className="p-3 font-semibold">Include media</th>
                  <td className="p-3">.apkg and .colpkg</td>
                  <td className="p-3">Images and audio packed into the file</td>
                  <td className="p-3">Media files left out (cards may show broken images/missing audio)</td>
                  <td className="p-3">No effect on history; ✅ kept / ❌ missing media</td>
                  <td className="p-3"><strong>Always tick</strong></td>
                </tr>
                <tr>
                  <th scope="row" className="p-3 font-semibold">Support older Anki versions (slower/larger files)</th>
                  <td className="p-3">.apkg and .colpkg</td>
                  <td className="p-3">Writes the legacy SQLite/media layout: larger, slower to export</td>
                  <td className="p-3">Writes the newer zstd-compressed format used by current Anki</td>
                  <td className="p-3">No effect (packaging only)</td>
                  <td className="p-3">Leave <strong>unticked</strong> by default. Tick only if the receiving app fails to parse a modern package.</td>
                </tr>
                <tr>
                  <th scope="row" className="p-3 font-semibold">.colpkg (Collection Package)</th>
                  <td className="p-3">Whole collection</td>
                  <td className="p-3">Scheduling is <strong>always</strong> included</td>
                  <td className="p-3">n/a</td>
                  <td className="p-3">✅ always kept</td>
                  <td className="p-3">Good for moving <em>everything</em> at once</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-sm text-ink/60">
            Shared decks downloaded from AnkiWeb have no scheduling by design. The author exported them without it. No app can restore history that was never in the file.
          </p>
        </section>

        {/* Table B: What Survives */}
        <section className="mb-16">
          <h2 className="text-2xl font-black tracking-tight mb-4">
            What Survives an .apkg / .colpkg Move Across 2026 Anki Alternatives
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <caption className="mb-4 text-left text-base">
                What carries over when you import an Anki package (as of October 2026; based on each product's public listing/site. Verify before you switch.)
              </caption>
              <thead>
                <tr className="border-b-2 border-ink">
                  <th scope="col" className="p-3 text-left font-bold">App</th>
                  <th scope="col" className="p-3 text-left font-bold">Best for</th>
                  <th scope="col" className="p-3 text-left font-bold">Import .apkg</th>
                  <th scope="col" className="p-3 text-left font-bold">Keeps history</th>
                  <th scope="col" className="p-3 text-left font-bold">Scheduler</th>
                  <th scope="col" className="p-3 text-left font-bold">Leech help</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/20">
                <tr>
                  <th scope="row" className="p-3 font-bold bg-ruled/5">Schwanki</th>
                  <td className="p-3 bg-ruled/5"><strong>Language learners with tutors, reviewing mostly on a phone</strong></td>
                  <td className="p-3 bg-ruled/5">✅ .apkg & .colpkg</td>
                  <td className="p-3 bg-ruled/5">✅ scheduling state, review history, suspended status</td>
                  <td className="p-3 bg-ruled/5">FSRS v5</td>
                  <td className="p-3 bg-ruled/5">✅ 1-tap AI scenes, free sentences, native audio</td>
                </tr>
                <tr>
                  <th scope="row" className="p-3 font-semibold">StudyDaily</th>
                  <td className="p-3">Offline-first FSRS-6 users across platforms</td>
                  <td className="p-3">✅ .apkg & .colpkg</td>
                  <td className="p-3">✅ state, due, interval, reps, lapses, FSRS-6 memory</td>
                  <td className="p-3">FSRS-6</td>
                  <td className="p-3">❌</td>
                </tr>
                <tr>
                  <th scope="row" className="p-3 font-semibold">Space</th>
                  <td className="p-3">General-purpose: med, STEM, languages</td>
                  <td className="p-3">✅ .apkg with history</td>
                  <td className="p-3">✅</td>
                  <td className="p-3">FSRS-6</td>
                  <td className="p-3">Partial: 7 free AI generations/mo</td>
                </tr>
                <tr>
                  <th scope="row" className="p-3 font-semibold">Repple</th>
                  <td className="p-3">Learners who build atomic cards from PDFs</td>
                  <td className="p-3">✅ replays review log through FSRS</td>
                  <td className="p-3">✅ by replaying log</td>
                  <td className="p-3">FSRS</td>
                  <td className="p-3">❌</td>
                </tr>
                <tr>
                  <th scope="row" className="p-3 font-semibold">FSRS Mobile</th>
                  <td className="p-3">Minimalist iPhone-only offline FSRS</td>
                  <td className="p-3">✅ via Files / Share Sheet</td>
                  <td className="p-3">✅ imports study progress</td>
                  <td className="p-3">FSRS</td>
                  <td className="p-3">❌</td>
                </tr>
                <tr>
                  <th scope="row" className="p-3 font-semibold">FlashSRS</th>
                  <td className="p-3">Simple offline iOS basic/cloze review</td>
                  <td className="p-3">✅ supported collections (basic & cloze)</td>
                  <td className="p-3">Imports supported .apkg (schema-dependent)</td>
                  <td className="p-3">Spaced repetition (custom schedules in Pro)</td>
                  <td className="p-3">❌</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-sm text-ink/60">
            Every app above still depends on you exporting with <strong>Include scheduling information</strong> ticked. No importer can recover history that isn't in the file.
          </p>
        </section>

        {/* Main Content */}
        <section className="mb-12 space-y-8">
          <div>
            <h2 className="text-3xl font-black tracking-tight mb-4">Why Your Anki Progress Reset (And How to Fix It in 30 Seconds)</h2>
            <p className="text-lg mb-4">
              Your history didn't get lost in the new app. It was never exported. In Anki's Deck Package export, "Include scheduling information" was unticked, so Anki removed it.
            </p>

            <h3 className="text-2xl font-bold tracking-tight mb-3">The checkbox that decides everything</h3>
            <blockquote className="border-l-4 border-ruled pl-4 py-2 mb-4 text-lg italic text-ink/80">
              "If true, scheduling information such as your review history will be exported. If false, Anki will assume that you are sharing the deck with other people, and will remove the entire scheduling information, including marked and leech tags."
              <footer className="text-sm mt-2 not-italic">— <a href="https://docs.ankiweb.net/exporting.html" className="text-ruled hover:underline" target="_blank" rel="noopener noreferrer">Anki Manual: Exporting</a></footer>
            </blockquote>

            <h3 className="text-2xl font-bold tracking-tight mb-3">Other ways people end up with a "fresh" deck</h3>
            <ul className="list-disc list-inside space-y-2 text-lg ml-4">
              <li>Imported a shared deck from AnkiWeb (exported without scheduling by design)</li>
              <li>Exported on a device that hadn't synced, so recent reviews are missing (partial loss, not a full reset)</li>
              <li>Left "Include media" unticked — history is fine, but images and audio are missing</li>
            </ul>

            <h3 className="text-2xl font-bold tracking-tight mb-3 mt-6">The 30-second fix</h3>
            <ol className="list-decimal list-inside space-y-2 text-lg ml-4">
              <li>Sync Anki on all your devices</li>
              <li>Go to <strong>File → Export</strong></li>
              <li>Tick <strong>Include scheduling information</strong> + <strong>Include media</strong></li>
              <li>Save the file</li>
              <li>Re-import into your new app</li>
            </ol>
            <p className="mt-4 p-4 rounded-lg bg-paper border border-ink/20 text-base">
              <strong>Tip:</strong> In Schwanki, check the preview's <strong>studied card count</strong>. If it shows 0 studied cards for a deck you've reviewed, the file has no scheduling.
            </p>
          </div>

          <div>
            <h2 className="text-3xl font-black tracking-tight mb-4">.apkg vs .colpkg: Which Package Should You Export?</h2>
            <p className="text-lg mb-4">
              Export .apkg to move one deck (with its subdecks). Export .colpkg to move your whole collection. .colpkg always includes scheduling. .apkg only includes it if you tick the box.
            </p>

            <h3 className="text-2xl font-bold tracking-tight mb-3">Anki Deck Package (.apkg)</h3>
            <p className="text-lg mb-4">
              Single deck + child subdecks. Requires <strong>Include scheduling information</strong> and <strong>Include media</strong> to be ticked.
            </p>
            <p className="text-lg p-4 rounded-lg bg-paper border border-ink/20">
              <strong>Edge case:</strong> A file named literally <code className="px-1.5 py-0.5 rounded bg-ink/10">collection.apkg</code> from older Anki versions is actually a collection package.
            </p>

            <h3 className="text-2xl font-bold tracking-tight mb-3 mt-6">Anki Collection Package (.colpkg)</h3>
            <p className="text-lg mb-4">
              Every deck, scheduling always included. Still tick <strong>Include media</strong>.
            </p>
            <div className="p-4 rounded-lg bg-ruled/10 border border-ruled/30">
              <p className="text-base font-bold mb-2">⚠️ Warning</p>
              <p className="text-base">
                In Anki itself, importing a .colpkg <strong>replaces your whole collection</strong>. Schwanki accepts both file types and lets you <strong>preview and select decks</strong> without wiping decks you already have.
              </p>
            </div>

            <h3 className="text-2xl font-bold tracking-tight mb-3 mt-6">The "Support older Anki versions" checkbox</h3>
            <p className="text-lg mb-4">
              Unticked = newer zstd-compressed format (smaller, faster). Ticked = legacy SQLite/media layout (larger, slower). It doesn't change what data is included.
            </p>
            <p className="text-lg">
              <strong>Rule:</strong> leave it unticked; <strong>tick it only if</strong> an app reports it can't read the file, then re-export.
            </p>

            <h3 className="text-2xl font-bold tracking-tight mb-3 mt-6">Quick decision guide</h3>
            <ul className="list-disc list-inside space-y-2 text-lg ml-4">
              <li>Trying out a new app with one deck → <strong>.apkg</strong></li>
              <li>Moving everything → <strong>.colpkg</strong></li>
              <li>App rejects the file → re-export with <strong>Support older Anki versions</strong> ticked</li>
            </ul>
          </div>

          <div>
            <h2 className="text-3xl font-black tracking-tight mb-4">
              Exact Platform Walkthroughs: Anki Desktop, AnkiMobile, AnkiDroid, and AnkiWeb
            </h2>
            <p className="text-lg mb-6">
              Whatever device you use, sync first, export with scheduling and media turned on, then pick the file in Schwanki.
            </p>

            <h3 className="text-2xl font-bold tracking-tight mb-3">Anki Desktop (Windows, Mac, Linux; Anki 26.09.3)</h3>
            <ol className="list-decimal list-inside space-y-2 text-lg ml-4 mb-6">
              <li>Sync with AnkiWeb</li>
              <li>Go to <strong>File → Export</strong></li>
              <li>Export format: <strong>Anki Deck Package (.apkg)</strong> (or <strong>Anki Collection Package (.colpkg)</strong>)</li>
              <li>Tick <strong>Include scheduling information</strong> and <strong>Include media</strong></li>
              <li>Save, then select the file in Schwanki's importer</li>
            </ol>

            <h3 className="text-2xl font-bold tracking-tight mb-3">AnkiMobile (iPhone / iPad)</h3>
            <ol className="list-decimal list-inside space-y-2 text-lg ml-4 mb-4">
              <li>Sync first</li>
              <li>On the deck list, tap <strong>Add/Export</strong> at the bottom</li>
              <li>Export the deck with scheduling and media included</li>
              <li>Select the file in Schwanki</li>
            </ol>
            <p className="text-base mb-6 text-ink/70">
              Deciding whether to keep AnkiMobile? Read <Link to="/vs/ankimobile" className="text-ruled hover:underline">Schwanki vs AnkiMobile</Link> →
            </p>

            <h3 className="text-2xl font-bold tracking-tight mb-3">AnkiDroid (Android)</h3>
            <ol className="list-decimal list-inside space-y-2 text-lg ml-4 mb-6">
              <li>Sync first</li>
              <li>Press and hold the deck</li>
              <li>Tap <strong>Export</strong></li>
              <li>Turn on <strong>Include scheduling information</strong> and <strong>Include media</strong></li>
              <li>Save the .apkg and select it in Schwanki</li>
            </ol>

            <h3 className="text-2xl font-bold tracking-tight mb-3">AnkiWeb (browser account)</h3>
            <p className="text-lg mb-4">
              Schwanki <strong>does not ask for your AnkiWeb password</strong>. Direct AnkiWeb login isn't supported, on purpose, to protect your account.
            </p>
            <p className="text-lg mb-4">
              <strong>Workflow:</strong> sync AnkiWeb down to Anki Desktop, AnkiMobile, or AnkiDroid → export locally (steps above) → import the file into Schwanki.
            </p>

            <h3 className="text-2xl font-bold tracking-tight mb-3">Importing into Schwanki (what you'll see)</h3>
            <p className="text-lg mb-4">
              Upload .apkg or .colpkg → <strong>preview</strong> shows the decks in the file, <strong>studied card count</strong>, and <strong>suspended card count</strong> → choose decks → import.
            </p>
            <div className="p-4 rounded-lg bg-paper border border-ink/20 space-y-2 text-base">
              <p><strong>Troubleshooting:</strong></p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>Studied count is 0? → re-export with scheduling</li>
                <li>Images missing? → re-export with media</li>
                <li>File won't open? → re-export with Support older Anki versions ticked</li>
              </ul>
            </div>
          </div>

          <div>
            <h2 className="text-3xl font-black tracking-tight mb-4">
              What Happens to FSRS Intervals, Leech Tags, and Suspended Cards on Import
            </h2>
            <p className="text-lg mb-4">
              If the file has scheduling, Schwanki keeps each card's FSRS v5 state, review history, and suspended status. Cards you've never seen arrive gradually at 20 per day.
            </p>

            <h3 className="text-2xl font-bold tracking-tight mb-3">FSRS state that carries over</h3>
            <ul className="list-disc list-inside space-y-2 text-lg ml-4">
              <li><strong>Stability</strong>: how long you're likely to remember it</li>
              <li><strong>Difficulty</strong>: how hard the card is for you</li>
              <li><strong>Retrievability</strong>: your current chance of remembering it</li>
              <li><strong>Reps</strong>: number of times you've reviewed it</li>
              <li><strong>Due</strong>: when it's next due</li>
              <li><strong>Last_review</strong>: when you last saw it</li>
            </ul>

            <h3 className="text-2xl font-bold tracking-tight mb-3 mt-6">Review history and suspended cards</h3>
            <p className="text-lg">
              Kept, and shown in the preview. Suspended cards stay suspended.
            </p>

            <h3 className="text-2xl font-bold tracking-tight mb-3 mt-6">Leech and marked tags</h3>
            <p className="text-lg">
              Kept only if exported with scheduling. Without it, Anki strips them (per the manual quote above).
            </p>

            <h3 className="text-2xl font-bold tracking-tight mb-3 mt-6">New (unseen) cards</h3>
            <p className="text-lg">
              Arrive at <strong>20/day in Anki order</strong>, so you don't get a flood on day one.
            </p>
          </div>

          <div>
            <h2 className="text-3xl font-black tracking-tight mb-4">
              How to Fix the "Leech" Words That Transfer Over Using Schwanki AI Scenes
            </h2>
            <p className="text-lg mb-4">
              Leeches are the cards you keep failing. Since your leech tags survive a scheduled export, Schwanki can surface them and give each one a memorable hook.
            </p>
            <p className="text-lg mb-4">
              Learn more: <Link to="/anki-alternative" className="text-ruled hover:underline">Anki alternative for language learners</Link>
            </p>
          </div>

          <div>
            <h2 className="text-3xl font-black tracking-tight mb-4">Switching Apps? A Pre-Flight Checklist</h2>
            <ul className="list-none space-y-2 text-lg">
              <li>☑️ Synced on all devices</li>
              <li>☑️ Chose .apkg or .colpkg</li>
              <li>☑️ Ticked scheduling (.apkg)</li>
              <li>☑️ Ticked media</li>
              <li>☑️ Kept a backup copy of the file</li>
              <li>☑️ Checked studied/suspended counts in the preview</li>
            </ul>
            <p className="mt-4 text-lg">
              Comparing apps? See our <Link to="/anki-alternative" className="text-ruled hover:underline">Anki alternative guide</Link>.
            </p>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="mb-16">
          <h2 className="text-3xl font-black tracking-tight mb-6">Frequently Asked Questions</h2>
          <div className="space-y-6">
            <div className="p-6 rounded-xl bg-white/60 border border-ink/20">
              <h3 className="text-xl font-bold mb-3">Why did my Anki review history reset after importing an .apkg file?</h3>
              <p className="text-lg">
                The file was most likely exported without "Include scheduling information" ticked. According to the Anki manual, when that option is off, Anki assumes you're sharing the deck and removes all scheduling information, including review history and marked and leech tags. The receiving app can only import what's in the file. Re-export from Anki with the box ticked, then import again.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-white/60 border border-ink/20">
              <h3 className="text-xl font-bold mb-3">Should I export .apkg or .colpkg to keep my progress?</h3>
              <p className="text-lg">
                Both can keep progress. An .apkg exports one deck and its subdecks, and only includes scheduling if you tick "Include scheduling information." A .colpkg exports your whole collection and always includes scheduling. Tick "Include media" for either. Note that importing a .colpkg into Anki replaces your collection, while Schwanki lets you preview and choose decks from either file type.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-white/60 border border-ink/20">
              <h3 className="text-xl font-bold mb-3">What does "Support older Anki versions" do when exporting?</h3>
              <p className="text-lg">
                It writes the package in the older, larger, slower legacy format instead of the newer compressed format current Anki uses. It doesn't change which data is included. Leave it unticked by default. If another app says it can't open or read your file, re-export with this option ticked and try again.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-white/60 border border-ink/20">
              <h3 className="text-xl font-bold mb-3">Will my FSRS stability and difficulty transfer to Schwanki?</h3>
              <p className="text-lg">
                Yes, if the file was exported with scheduling. Schwanki keeps each card's FSRS v5 scheduling state (stability, difficulty, retrievability, reps, due date, and last review), plus review history and suspended status. Before you import, Schwanki shows the decks in the file with studied and suspended card counts so you can confirm your progress is there.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-white/60 border border-ink/20">
              <h3 className="text-xl font-bold mb-3">Can I import my decks into Schwanki by logging into AnkiWeb?</h3>
              <p className="text-lg">
                No. Schwanki doesn't ask for your AnkiWeb password, and direct AnkiWeb login isn't supported. Instead, sync AnkiWeb to Anki Desktop, AnkiMobile, or AnkiDroid, export an .apkg or .colpkg file with scheduling and media included, and select that file in Schwanki.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-white/60 border border-ink/20">
              <h3 className="text-xl font-bold mb-3">Why are my images and audio missing after importing an Anki deck?</h3>
              <p className="text-lg">
                The deck was probably exported without "Include media" ticked, so the images and audio files weren't packed into it. Your review history can still be fine, since media and scheduling are separate options. Re-export from Anki with both "Include media" and "Include scheduling information" ticked, then import the new file.
              </p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="mb-16 p-8 rounded-2xl bg-ink text-paper text-center">
          <h2 className="text-3xl font-black tracking-tight mb-4">Ready to import with your progress intact?</h2>
          <div className="flex flex-wrap gap-4 justify-center">
            <a href="/sources" className="primary-button">Import your Anki deck</a>
            <Link to="/anki-alternative" className="secondary-button">Learn more about Schwanki</Link>
          </div>
        </section>
      </article>
    </main>
  );
}
