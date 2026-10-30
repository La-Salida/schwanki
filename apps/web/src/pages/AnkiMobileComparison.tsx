import { Link } from "react-router-dom";
import { PAGES } from "@/lib/seo";
import { usePageMeta } from "@/lib/usePageMeta";

export default function AnkiMobileComparison() {
  usePageMeta(PAGES.ankiMobileComparison);

  return (
    <main className="page-shell landing-editorial">
      <article className="mx-auto max-w-3xl">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-4 text-sm text-ink/60">
          <Link to="/" className="hover:text-ink">Schwanki</Link> › <span className="text-ink">Schwanki vs AnkiMobile</span>
        </nav>

        {/* Page Header */}
        <header className="mb-8 space-y-4">
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-tight">
            Schwanki vs AnkiMobile (2026): Is AnkiMobile Still Worth $24.99?
          </h1>
          <p className="text-sm text-ink/60">Last verified: October 29, 2026 · AnkiMobile 25.09 on the App Store · 26.10 in TestFlight beta</p>
        </header>

        {/* Direct Answer Snippet */}
        <div className="mb-8 p-6 rounded-xl bg-white/60 border border-ink/20">
          <p className="text-lg leading-relaxed">
            <strong>Yes, AnkiMobile is still worth $24.99 if you already use desktop Anki</strong> and want free AnkiWeb sync, your exact note types and the same SM-2/FSRS scheduling on iPhone. It isn't abandoned: version 26.10 is in TestFlight beta. If you mostly review language vocab on your phone and want a swipe-style feed, try Schwanki alongside it.
          </p>
        </div>

        {/* Sub-lede */}
        <div className="mb-8">
          <p className="text-lg">
            You don't have to pick one today. Exporting a deck from Anki leaves your collection untouched, and Schwanki imports .apkg and .colpkg files with review history and scheduling intact, as long as you tick "Include scheduling information" and "Include media".
          </p>
        </div>

        {/* Table A: Feature Comparison */}
        <section className="mb-16">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <caption className="mb-4 text-left text-base">
                Schwanki vs AnkiMobile, feature by feature (as of October 29, 2026; AnkiMobile facts from its US App Store listing and the Anki forums, Schwanki facts from schwankiapp.com)
              </caption>
              <thead>
                <tr className="border-b-2 border-ink">
                  <th scope="col" className="p-3 text-left font-bold">Feature</th>
                  <th scope="col" className="p-3 text-left font-bold">AnkiMobile (iPhone/iPad)</th>
                  <th scope="col" className="p-3 text-left font-bold bg-ruled/10">Schwanki</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/20">
                <tr>
                  <th scope="row" className="p-3 text-left font-semibold">Price</th>
                  <td className="p-3">$24.99 one-time (US App Store, checked 2026-10-29). Family Sharing supported.</td>
                  <td className="p-3 bg-ruled/5">AI example sentences free. AI scene picture + native-voice audio: 1 Schwanki credit, or 0 credits with your own API keys.</td>
                </tr>
                <tr>
                  <th scope="row" className="p-3 text-left font-semibold">How you get it / platforms</th>
                  <td className="p-3">Native iOS app from the App Store, requires iOS 15.2+. Desktop Anki (free) and AnkiDroid (free, Android) are separate apps.</td>
                  <td className="p-3 bg-ruled/5">Runs in the browser and installs to the home screen as a PWA (not an App Store app). Swipe feed on phone, clean flashcard layout on desktop.</td>
                </tr>
                <tr>
                  <th scope="row" className="p-3 text-left font-semibold">Review experience on phone</th>
                  <td className="p-3">Classic Anki card review. 26.10 beta has a redesigned UI that beta testers praise.</td>
                  <td className="p-3 bg-ruled/5">Swipe-and-scroll, social-style feed. The queue ends when your due cards are done ("You out-scrolled your due cards").</td>
                </tr>
                <tr>
                  <th scope="row" className="p-3 text-left font-semibold">Scheduler</th>
                  <td className="p-3">SM-2 and FSRS, same as desktop. FSRS6 added in 25.07.</td>
                  <td className="p-3 bg-ruled/5">FSRS v5 (tracks stability, difficulty, retrievability, reps, due date, last review). New cards 20/day by default, Anki order.</td>
                </tr>
                <tr>
                  <th scope="row" className="p-3 text-left font-semibold">Sync</th>
                  <td className="p-3">Free AnkiWeb sync with desktop Anki and AnkiDroid</td>
                  <td className="p-3 bg-ruled/5">Doesn't use AnkiWeb and never asks for your AnkiWeb password.</td>
                </tr>
                <tr>
                  <th scope="row" className="p-3 text-left font-semibold">Bringing in existing Anki decks</th>
                  <td className="p-3">Native: it's Anki</td>
                  <td className="p-3 bg-ruled/5">Imports .apkg and .colpkg from Anki Desktop, AnkiMobile and AnkiDroid. Keeps cards, scheduling, review history, suspended status, pictures and audio when exported with both boxes ticked.</td>
                </tr>
                <tr>
                  <th scope="row" className="p-3 text-left font-semibold">Note types</th>
                  <td className="p-3">Same note types as desktop, but they must be modified on the computer</td>
                  <td className="p-3 bg-ruled/5">For complex custom note types, Schwanki's own guidance is to stay on Anki.</td>
                </tr>
                <tr>
                  <th scope="row" className="p-3 text-left font-semibold">Add-ons</th>
                  <td className="p-3">Not supported</td>
                  <td className="p-3 bg-ruled/5">Not supported. Stay on Anki if you rely on add-ons or AnkiConnect.</td>
                </tr>
                <tr>
                  <th scope="row" className="p-3 text-left font-semibold">Making cards on the phone</th>
                  <td className="p-3">Supported. The developer said on Oct 28, 2026 that card creation, "especially mobile", "needs work".</td>
                  <td className="p-3 bg-ruled/5">Imports tutor notes: Google Docs, Google Sheets, class PDFs ≤10 MB (incl. Canva exports), PowerPoint ≤100 MB, Preply profile link autofill. Extracted words go to an Inbox you approve first.</td>
                </tr>
                <tr>
                  <th scope="row" className="p-3 text-left font-semibold">Help with leech cards</th>
                  <td className="p-3">Anki's standard leech handling. No AI tools listed.</td>
                  <td className="p-3 bg-ruled/5">Free AI example sentence. Ridiculous scene picture + native-voice audio for 1 credit (0 with your own keys).</td>
                </tr>
                <tr>
                  <th scope="row" className="p-3 text-left font-semibold">Offline</th>
                  <td className="p-3">Not stated</td>
                  <td className="p-3 bg-ruled/5">Review of loaded due cards works offline. Imports, note processing and AI need a connection.</td>
                </tr>
                <tr>
                  <th scope="row" className="p-3 text-left font-semibold">Public update status</th>
                  <td className="p-3">App Store: 25.09 (released Sept 8, 2025). 26.10 in TestFlight beta since Sept 22, 2026, final QA started Oct 27, 2026.</td>
                  <td className="p-3 bg-ruled/5">Web app (no App Store versions)</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-sm text-ink/60">
            AnkiMobile is a paid native app built to mirror desktop Anki. Schwanki is a phone-first web app built around a review feed. Many people use both.
          </p>
        </section>

        {/* Table B: Quick Pick */}
        <section className="mb-16">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <caption className="mb-4 text-left text-base">
                Quick pick: AnkiMobile, Schwanki, or both (based on how you study)
              </caption>
              <thead>
                <tr className="border-b-2 border-ink">
                  <th scope="col" className="p-3 text-left font-bold">If you…</th>
                  <th scope="col" className="p-3 text-left font-bold">Pick</th>
                  <th scope="col" className="p-3 text-left font-bold">Why</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/20">
                <tr>
                  <td className="p-3">Build decks on desktop Anki and want the same decks on iPhone</td>
                  <td className="p-3"><strong>AnkiMobile</strong></td>
                  <td className="p-3">Free AnkiWeb sync, the same SM-2/FSRS scheduling, your note types</td>
                </tr>
                <tr>
                  <td className="p-3">Rely on add-ons, AnkiConnect, LaTeX/math, or complex custom note types</td>
                  <td className="p-3"><strong>Anki + AnkiMobile</strong></td>
                  <td className="p-3">Schwanki itself recommends staying on Anki for these</td>
                </tr>
                <tr>
                  <td className="p-3">Want full manual scheduler control in a native app</td>
                  <td className="p-3"><strong>Anki + AnkiMobile</strong></td>
                  <td className="p-3">Per Schwanki's own trade-offs</td>
                </tr>
                <tr>
                  <td className="p-3">Review mostly language vocab on your phone and want a feed you can thumb through</td>
                  <td className="p-3 bg-ruled/5"><strong>Schwanki</strong></td>
                  <td className="p-3 bg-ruled/5">Swipe-and-scroll feed, queue ends when due cards are done</td>
                </tr>
                <tr>
                  <td className="p-3">Keep failing the same words (leeches)</td>
                  <td className="p-3 bg-ruled/5"><strong>Schwanki</strong></td>
                  <td className="p-3 bg-ruled/5">AI example sentences, ridiculous scene pictures, native-voice audio</td>
                </tr>
                <tr>
                  <td className="p-3">Get class notes from a tutor (Docs, Sheets, PDFs, slides, Preply)</td>
                  <td className="p-3 bg-ruled/5"><strong>Schwanki</strong></td>
                  <td className="p-3 bg-ruled/5">Tutor-notes import into an approval Inbox</td>
                </tr>
                <tr>
                  <td className="p-3">Already own AnkiMobile but want to try a feed</td>
                  <td className="p-3"><strong>Both</strong></td>
                  <td className="p-3">Exporting leaves your Anki collection untouched. Import a copy into Schwanki.</td>
                </tr>
                <tr>
                  <td className="p-3">Are on Android</td>
                  <td className="p-3"><strong>AnkiDroid (free)</strong> or <strong>Schwanki</strong></td>
                  <td className="p-3">AnkiMobile is iOS-only</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Main Content */}
        <section className="mb-12 space-y-12">
          {/* H2 1: The Short Answer */}
          <div>
            <h2 className="text-3xl font-black tracking-tight mb-4">The Short Answer: Who Should Pay $24.99, and Who Should Try Schwanki</h2>
            <p className="text-lg mb-4">
              AnkiMobile is worth it for people already invested in desktop Anki. Schwanki is built for language learners who review mostly on their phone and want a feed instead of a deck screen.
            </p>
            <ul className="list-disc list-inside space-y-2 text-lg ml-4 mb-4">
              <li>Desktop Anki users: AnkiMobile gives you the same decks, scheduling and sync on iPhone.</li>
              <li>Phone-first vocab learners: Schwanki turns your reviews into a swipe feed and adds AI help for stubborn words.</li>
              <li>Unsure? Try both. Exporting from Anki doesn't touch your collection.</li>
            </ul>
            <p className="text-lg mb-4">
              See the <a href="#quick-pick" className="text-ruled hover:underline">quick pick table</a> above for your exact situation.
            </p>
            <div className="p-4 rounded-lg bg-paper border border-ink/20">
              <p className="text-base mb-2"><strong>Try it with one deck</strong></p>
              <p className="text-base">
                <Link to="/guides/export-anki-with-scheduling" className="text-ruled hover:underline">Export your deck with scheduling</Link> from Anki, then import it into Schwanki. Your Anki collection stays exactly as it is.
              </p>
            </div>
          </div>

          {/* H2 2: Is AnkiMobile Dead? */}
          <div>
            <h2 className="text-3xl font-black tracking-tight mb-4">Is AnkiMobile Dead? What the 26.10 Beta Shows</h2>
            <p className="text-lg mb-6">
              No. AnkiMobile is still in active development. The public App Store version is 25.09 from September 2025, but version 26.10, with a redesigned interface, has been in TestFlight beta since September 22, 2026.
            </p>

            <h3 className="text-2xl font-bold tracking-tight mb-3">Why people are asking</h3>
            <p className="text-lg mb-4">
              On October 14, 2026, a user on the Anki forums asked: <a href="https://forums.ankiweb.net/t/mobile-version-card-scheduling-out-of-sync/71449" className="text-ruled hover:underline" target="_blank" rel="noopener noreferrer">"Is iOS version dead or will it get updates like the desktop version?"</a> A reply confirmed that AnkiMobile is in active development and that the 26.10 beta had been out for a few weeks.
            </p>
            <p className="text-lg mb-4">
              On October 27, a beta tester wrote: "it's been nearly a year since the last update". That gap, from September 8, 2025 to now, is why the question came up.
            </p>

            <h3 className="text-2xl font-bold tracking-tight mb-3">What we know about 26.10</h3>
            <ul className="list-disc list-inside space-y-2 text-lg ml-4 mb-4">
              <li><strong>Redesigned UI.</strong> On October 8, 2026, a beta tester said <a href="https://forums.ankiweb.net/t/ankimobile-26-10-beta/71167" className="text-ruled hover:underline" target="_blank" rel="noopener noreferrer">"the ui looks beautiful"</a>.</li>
              <li><strong>Final QA started October 27, 2026</strong> (posted by the developer, @ianankihub).</li>
              <li><strong>A known image-occlusion editor toolbar bug</strong> will be fixed in a quick follow-up release, not in 26.10 itself.</li>
            </ul>

            <h3 className="text-2xl font-bold tracking-tight mb-3">What the developer says still needs work</h3>
            <p className="text-lg mb-4">
              On October 28, 2026, the developer <a href="https://forums.ankiweb.net/t/ankimobile-26-10-beta/71167" className="text-ruled hover:underline" target="_blank" rel="noopener noreferrer">wrote</a>: "Card creation—on all platforms but especially mobile—needs work, and we're aware."
            </p>

            <h3 className="text-2xl font-bold tracking-tight mb-3">When will 26.10 be released?</h3>
            <p className="text-lg mb-4">
              No public release date has been announced.
            </p>

            {/* Timeline table */}
            <div className="overflow-x-auto mb-4">
              <table className="w-full border-collapse text-sm">
                <caption className="mb-2 text-left font-bold">AnkiMobile 26.10 timeline</caption>
                <thead>
                  <tr className="border-b border-ink">
                    <th scope="col" className="p-2 text-left">Date</th>
                    <th scope="col" className="p-2 text-left">Event</th>
                    <th scope="col" className="p-2 text-left">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/20">
                  <tr>
                    <td className="p-2">Sept 8, 2025</td>
                    <td className="p-2">AnkiMobile 25.09 released on the App Store</td>
                    <td className="p-2"><a href="https://apps.apple.com/us/app/ankimobile-flashcards/id373493387" className="text-ruled hover:underline" target="_blank" rel="noopener noreferrer">App Store listing</a></td>
                  </tr>
                  <tr>
                    <td className="p-2">Sept 22, 2026</td>
                    <td className="p-2">AnkiMobile 26.10 TestFlight beta opened</td>
                    <td className="p-2"><a href="https://forums.ankiweb.net/t/ankimobile-26-10-beta/71167" className="text-ruled hover:underline" target="_blank" rel="noopener noreferrer">Anki forums</a></td>
                  </tr>
                  <tr>
                    <td className="p-2">Oct 8, 2026</td>
                    <td className="p-2">Beta tester: "the ui looks beautiful"</td>
                    <td className="p-2"><a href="https://forums.ankiweb.net/t/ankimobile-26-10-beta/71167" className="text-ruled hover:underline" target="_blank" rel="noopener noreferrer">Anki forums</a></td>
                  </tr>
                  <tr>
                    <td className="p-2">Oct 14, 2026</td>
                    <td className="p-2">User asks: "Is iOS version dead or will it get updates?"</td>
                    <td className="p-2"><a href="https://forums.ankiweb.net/t/mobile-version-card-scheduling-out-of-sync/71449" className="text-ruled hover:underline" target="_blank" rel="noopener noreferrer">Anki forums</a></td>
                  </tr>
                  <tr>
                    <td className="p-2">Oct 27, 2026</td>
                    <td className="p-2">Developer: final QA started; image-occlusion toolbar bug to be fixed in follow-up</td>
                    <td className="p-2"><a href="https://forums.ankiweb.net/t/ankimobile-26-10-beta/71167" className="text-ruled hover:underline" target="_blank" rel="noopener noreferrer">Anki forums</a></td>
                  </tr>
                  <tr>
                    <td className="p-2">Oct 28, 2026</td>
                    <td className="p-2">Developer: "Card creation—on all platforms but especially mobile—needs work"</td>
                    <td className="p-2"><a href="https://forums.ankiweb.net/t/ankimobile-26-10-beta/71167" className="text-ruled hover:underline" target="_blank" rel="noopener noreferrer">Anki forums</a></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="text-lg font-bold">
              Takeaway: If you're buying AnkiMobile today, you're buying an app that's maintained and about to get a visual refresh.
            </p>
          </div>

          {/* H2 3: What You Get for $24.99 */}
          <div>
            <h2 className="text-3xl font-black tracking-tight mb-4">What You Get for $24.99 with AnkiMobile</h2>
            <p className="text-lg mb-6">
              AnkiMobile gives you desktop Anki's scheduling and decks on iPhone and iPad for a one-time $24.99, with free AnkiWeb sync and Family Sharing.
            </p>

            <h3 className="text-2xl font-bold tracking-tight mb-3">Strengths</h3>
            <ul className="list-disc list-inside space-y-2 text-lg ml-4 mb-6">
              <li>Same SM-2 and FSRS scheduling as desktop Anki (FSRS6 added in version 25.07, released July 21, 2025).</li>
              <li>Free AnkiWeb sync with desktop Anki and AnkiDroid.</li>
              <li>One-time $24.99 payment, no subscription. Family Sharing supported.</li>
              <li>Requires iOS 15.2+.</li>
              <li>4.0 stars from 2.4K ratings on the US App Store (as of October 29, 2026).</li>
            </ul>

            <h3 className="text-2xl font-bold tracking-tight mb-3">What it's designed <em>not</em> to do</h3>
            <p className="text-lg mb-4">
              From the <a href="https://apps.apple.com/us/app/ankimobile-flashcards/id373493387" className="text-ruled hover:underline" target="_blank" rel="noopener noreferrer">App Store listing</a>, the developer describes AnkiMobile as "a companion to the computer version of Anki, rather than a complete replacement."
            </p>
            <ul className="list-disc list-inside space-y-2 text-lg ml-4 mb-4">
              <li>Note types must be modified on the computer.</li>
              <li>Add-ons aren't supported.</li>
            </ul>
          </div>

          {/* H2 4: Where Schwanki Is Different */}
          <div>
            <h2 className="text-3xl font-black tracking-tight mb-4">Where Schwanki Is Different</h2>
            <p className="text-lg mb-6">
              Schwanki turns your due cards into a swipe-and-scroll feed on your phone, schedules them with FSRS v5, and adds tools aimed at language learners: AI help for leech words and tutor-notes import.
            </p>

            <h3 className="text-2xl font-bold tracking-tight mb-3">A review feed instead of a deck screen</h3>
            <p className="text-lg mb-4">
              Swipe-and-scroll on phone, clean flashcard layout on desktop. The queue ends when due cards are done ("You out-scrolled your due cards"). Installs to the home screen as a PWA, not from the App Store.
            </p>

            <h3 className="text-2xl font-bold tracking-tight mb-3">FSRS v5 scheduling that keeps your Anki history</h3>
            <p className="text-lg mb-4">
              Imported fields: stability, difficulty, retrievability, reps, due date, last review. New cards 20/day by default, in Anki order.
            </p>

            <h3 className="text-2xl font-bold tracking-tight mb-3">Fixing leech words</h3>
            <p className="text-lg mb-4">
              Free AI example sentence. Ridiculous scene picture + native-voice audio for 1 Schwanki credit, or 0 with your own API keys (pipeline: DeepSeek sentences, fal pictures, ElevenLabs / Fish Audio s2.1 Pro audio).
            </p>

            <h3 className="text-2xl font-bold tracking-tight mb-3">Turning tutor notes into cards</h3>
            <p className="text-lg mb-4">
              Google Docs, Google Sheets, class PDFs ≤10 MB (incl. Canva exports), PowerPoint ≤100 MB, Preply tutor profile link autofill. Words land in an Inbox you approve first.
            </p>

            <h3 className="text-2xl font-bold tracking-tight mb-3">Offline</h3>
            <p className="text-lg mb-4">
              Loaded due cards can be reviewed offline. Imports, note processing and AI need a connection.
            </p>
          </div>

          {/* H2 5: Feature-by-Feature */}
          <div>
            <h2 className="text-3xl font-black tracking-tight mb-4">Feature-by-Feature: Schwanki vs AnkiMobile</h2>
            <p className="text-lg mb-4">
              AnkiMobile wins on Anki fidelity and sync. Schwanki wins on phone-first review and language-learning tools.
            </p>
            <ul className="list-disc list-inside space-y-2 text-lg ml-4 mb-4">
              <li><strong>Review UX:</strong> AnkiMobile is classic Anki on iPhone (26.10 will look better). Schwanki is a thumb-friendly swipe feed.</li>
              <li><strong>Sync:</strong> AnkiMobile syncs free through AnkiWeb. Schwanki doesn't use AnkiWeb. You import a file once.</li>
              <li><strong>Note types and add-ons:</strong> AnkiMobile mirrors desktop Anki's note types but requires editing on the computer and doesn't run add-ons. Schwanki recommends staying on Anki for complex note types, LaTeX, or add-ons.</li>
              <li><strong>Leeches:</strong> AnkiMobile has Anki's standard leech tagging. Schwanki adds AI sentences, scene pictures and native audio.</li>
            </ul>
            <p className="text-lg">
              See the <a href="#comparison" className="text-ruled hover:underline">full comparison table</a> above for every detail.
            </p>
          </div>

          {/* H2 6: Use Both */}
          <div>
            <h2 className="text-3xl font-black tracking-tight mb-4">Use Both: Try Schwanki Without Giving Up AnkiMobile</h2>
            <p className="text-lg mb-6">
              Exporting from Anki leaves your original collection untouched, so you can keep AnkiMobile and try Schwanki with a copy of your decks.
            </p>
            <ol className="list-decimal list-inside space-y-2 text-lg ml-4 mb-6">
              <li>Sync AnkiMobile with AnkiWeb.</li>
              <li>Export a deck (.apkg) or your collection (.colpkg).</li>
              <li>Tick <strong>Include scheduling information</strong> and <strong>Include media</strong>.</li>
              <li>Import the file into Schwanki (no AnkiWeb password needed).</li>
              <li>Review in the feed and compare.</li>
            </ol>
            <p className="text-lg mb-4">
              <Link to="/guides/export-anki-with-scheduling" className="text-ruled hover:underline">Full walkthrough for AnkiMobile, Desktop and AnkiDroid</Link>
            </p>
            <div className="p-4 rounded-lg bg-ruled/10 border border-ruled/30">
              <p className="text-base font-bold mb-2">⚠️ Important</p>
              <p className="text-base">
                A file exported without scheduling arrives as new cards. No app can restore history that isn't in the file.
              </p>
            </div>
          </div>

          {/* H2 7: When You Should Stay on Anki */}
          <div>
            <h2 className="text-3xl font-black tracking-tight mb-4">When You Should Stay on Anki</h2>
            <p className="text-lg mb-4">
              Stay on Anki and AnkiMobile if your workflow depends on things Schwanki doesn't try to do.
            </p>
            <ul className="list-disc list-inside space-y-2 text-lg ml-4 mb-4">
              <li>Add-ons or AnkiConnect</li>
              <li>Math- or LaTeX-heavy decks</li>
              <li>Complex custom note types</li>
              <li>Wanting a native desktop app with full manual scheduler control</li>
            </ul>
            <p className="text-lg">
              That's not a knock on either app. They're built for different study habits.
            </p>
          </div>

          {/* H2 8: Verdict */}
          <div>
            <h2 className="text-3xl font-black tracking-tight mb-4">Verdict: Who Should Choose What</h2>
            <p className="text-lg mb-6">
              Buy AnkiMobile if you live in desktop Anki. Try Schwanki if your phone is where you actually review. If you're unsure, run both for a week.
            </p>

            <div className="space-y-4 mb-6">
              <div className="p-4 rounded-lg bg-paper border border-ink/20">
                <p className="font-bold mb-2">Anki power user</p>
                <p className="text-base">
                  You have add-ons, custom note types, AnkiConnect automations, or LaTeX. AnkiMobile keeps everything synced. Schwanki isn't built for that workflow.
                </p>
              </div>

              <div className="p-4 rounded-lg bg-ruled/10 border border-ruled/30">
                <p className="font-bold mb-2">Phone-first language learner</p>
                <p className="text-base">
                  You review mostly on your phone, often in short bursts. Schwanki's swipe feed fits how you already scroll. Import your deck and try it.
                </p>
              </div>

              <div className="p-4 rounded-lg bg-paper border border-ink/20">
                <p className="font-bold mb-2">AnkiMobile owner worried it's dead</p>
                <p className="text-base">
                  It's not. 26.10 is in final QA. If you want to try a feed while you wait for the redesigned UI, import a deck into Schwanki.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 items-center">
              <a href="/sources" className="primary-button">Import one deck into Schwanki</a>
              <Link to="/anki-alternative" className="secondary-button">Compare Anki alternatives</Link>
            </div>

            <p className="mt-4 text-base text-ink/70">
              Your Anki collection stays exactly as it is.
            </p>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="mb-16" id="faq">
          <h2 className="text-3xl font-black tracking-tight mb-6">Frequently Asked Questions</h2>
          <div className="space-y-6">
            <div className="p-6 rounded-xl bg-white/60 border border-ink/20">
              <h3 className="text-xl font-bold mb-3">Is AnkiMobile worth $24.99 in 2026?</h3>
              <p className="text-lg">
                It depends on how you study. AnkiMobile costs $24.99 once on the US App Store, supports Family Sharing, syncs free through AnkiWeb and uses the same SM-2 and FSRS scheduling as desktop Anki. That makes it worth it if you build decks on a computer and want them unchanged on your iPhone. If you mostly review on your phone and want a swipe-style feed, compare a phone-first app like Schwanki first.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-white/60 border border-ink/20">
              <h3 className="text-xl font-bold mb-3">Is AnkiMobile dead?</h3>
              <p className="text-lg">
                No. AnkiMobile is still in active development. Version 26.10, which has a redesigned interface, has been in TestFlight beta since September 22, 2026, and on October 27 the developer said final QA had started. The current public App Store version, 25.09, was released in September 2025. That long gap is why some users have asked whether the app was abandoned.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-white/60 border border-ink/20">
              <h3 className="text-xl font-bold mb-3">Can I use AnkiMobile and Schwanki at the same time?</h3>
              <p className="text-lg">
                Yes. Exporting a deck from Anki leaves your original collection untouched, so you can keep reviewing in AnkiMobile and try Schwanki side by side. Export an .apkg or .colpkg file with "Include scheduling information" and "Include media" ticked, then import it into Schwanki. Schwanki never asks for your AnkiWeb password, and you can start with a single deck.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-white/60 border border-ink/20">
              <h3 className="text-xl font-bold mb-3">Will my AnkiMobile review history transfer to Schwanki?</h3>
              <p className="text-lg">
                Yes, if you export with scheduling. Schwanki imports .apkg and .colpkg files from AnkiMobile, Anki Desktop and AnkiDroid. It keeps cards, scheduling state, review history, suspended status, pictures and audio when "Include scheduling information" and "Include media" are ticked, then schedules with FSRS v5. A file exported without scheduling arrives as new cards, because no app can restore history that isn't in the file.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-white/60 border border-ink/20">
              <h3 className="text-xl font-bold mb-3">Is Schwanki a native iPhone app?</h3>
              <p className="text-lg">
                No. Schwanki runs in your browser and installs to your iPhone home screen as a progressive web app (PWA). It isn't in the App Store. On a phone it shows your due cards as a swipe-and-scroll feed, and the queue ends when your due cards are done. You can review loaded due cards offline. Imports, note processing and AI features need a connection.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-white/60 border border-ink/20">
              <h3 className="text-xl font-bold mb-3">When should I stay with Anki and AnkiMobile instead of switching?</h3>
              <p className="text-lg">
                Stay with Anki if you rely on add-ons or AnkiConnect, study math- or LaTeX-heavy material, use complex custom note types, or want a native app with full manual control over the scheduler. AnkiMobile doesn't run add-ons, and note types must be changed on the computer, but it reviews the decks you build there with the same scheduling as desktop Anki.
              </p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="mb-16 p-8 rounded-2xl bg-ink text-paper text-center">
          <h2 className="text-3xl font-black tracking-tight mb-4">Ready to try Schwanki alongside AnkiMobile?</h2>
          <div className="flex flex-wrap gap-4 justify-center">
            <a href="/sources" className="primary-button">Import your Anki deck</a>
            <Link to="/guides/export-anki-with-scheduling" className="secondary-button">Export guide</Link>
          </div>
        </section>
      </article>
    </main>
  );
}
