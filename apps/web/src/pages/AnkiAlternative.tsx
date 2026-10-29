import { Link } from "react-router-dom";
import { PAGES } from "@/lib/seo";
import { usePageMeta } from "@/lib/usePageMeta";

export default function AnkiAlternative() {
  usePageMeta(PAGES.ankiAlternative);

  return (
    <main className="page-shell landing-editorial">
      <article className="mx-auto max-w-3xl">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-4 text-sm text-ink/60">
          <Link to="/" className="hover:text-ink">Schwanki</Link> › <span className="text-ink">Anki Alternative</span>
        </nav>

        {/* Page Header */}
        <header className="mb-8 space-y-4">
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-tight">
            The Anki Alternative Built for Language Learners: Keep Your Decks, Lose the Grind
          </h1>
          <p className="text-sm text-ink/60">Last verified: October 27, 2026</p>
        </header>

        {/* Direct Answer Snippet */}
        <div className="mb-8 p-6 rounded-xl bg-white/60 border border-ink/20">
          <p className="text-lg leading-relaxed">
            <strong>Schwanki is an Anki alternative built for language learners.</strong> Upload your <code className="px-1.5 py-0.5 rounded bg-ink/10">.apkg</code> or <code className="px-1.5 py-0.5 rounded bg-ink/10">.colpkg</code> export from Anki Desktop, AnkiMobile, or AnkiDroid, and Schwanki keeps your cards, media, review history, and FSRS v5 scheduling intact. Then review in a thumb-friendly mobile feed and fix stubborn words with AI example sentences, ridiculous scene images, and native audio.
          </p>
        </div>

        {/* Primary CTA */}
        <div className="mb-8 flex flex-wrap gap-4 items-center">
          <a href="#connect" className="primary-button">Import your Anki deck</a>
          <a href="#connect" className="secondary-button">Turn class notes into cards</a>
        </div>

        {/* Trust Strip */}
        <div className="mb-12 flex flex-wrap gap-4 text-sm font-bold text-ink/70">
          <span>✓ Imports .apkg & .colpkg</span>
          <span>·</span>
          <span>✓ FSRS v5 scheduling</span>
          <span>·</span>
          <span>✓ No AnkiWeb password needed</span>
        </div>

        {/* Comparison Matrix */}
        <section className="mb-16">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <caption className="mb-4 text-left text-base font-bold">
                Anki vs Schwanki vs StudyDaily vs Space vs Repple vs FSRS Mobile vs FlashSRS: what matters for language learners (checked October 27, 2026)
              </caption>
              <thead>
                <tr className="border-b-2 border-ink">
                  <th scope="col" className="p-3 text-left font-bold">Feature</th>
                  <th scope="col" className="p-3 text-left font-bold">Classic Anki / AnkiMobile</th>
                  <th scope="col" className="p-3 text-left font-bold bg-ruled/10"><strong>Schwanki</strong></th>
                  <th scope="col" className="p-3 text-left font-bold">StudyDaily</th>
                  <th scope="col" className="p-3 text-left font-bold">Space</th>
                  <th scope="col" className="p-3 text-left font-bold">Repple</th>
                  <th scope="col" className="p-3 text-left font-bold">FSRS Mobile</th>
                  <th scope="col" className="p-3 text-left font-bold">FlashSRS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/20">
                <tr>
                  <th scope="row" className="p-3 text-left font-semibold">Best for</th>
                  <td className="p-3">Power users who want full control; every subject</td>
                  <td className="p-3 bg-ruled/5"><strong>Language learners with tutors, reviewing mostly on a phone</strong></td>
                  <td className="p-3">Offline-first FSRS-6 users across Apple/Android/desktop</td>
                  <td className="p-3">General-purpose: med, STEM, languages</td>
                  <td className="p-3">Learners who build atomic cards from PDFs; developers</td>
                  <td className="p-3">Minimalist iPhone-only offline FSRS review</td>
                  <td className="p-3">Simple offline iOS basic/cloze review</td>
                </tr>
                <tr>
                  <th scope="row" className="p-3 text-left font-semibold">Import Anki decks</th>
                  <td className="p-3">Native (.apkg / .colpkg)</td>
                  <td className="p-3 bg-ruled/5"><strong>Yes: .apkg and .colpkg from Desktop, AnkiMobile, and AnkiDroid, with step-by-step export guides for all three in the app</strong></td>
                  <td className="p-3">Yes: .apkg and .colpkg (per their Oct 2026 guide)</td>
                  <td className="p-3">Yes: .apkg with history (per their page)</td>
                  <td className="p-3">Yes: replays your review log through FSRS (per their page)</td>
                  <td className="p-3">Yes: .apkg via Files / Share Sheet</td>
                  <td className="p-3">Yes: supported .apkg collections (basic & cloze)</td>
                </tr>
                <tr>
                  <th scope="row" className="p-3 text-left font-semibold">Keeps review history & scheduling</th>
                  <td className="p-3">n/a (native)</td>
                  <td className="p-3 bg-ruled/5"><strong>Yes: scheduling state, review history, and suspended status</strong></td>
                  <td className="p-3">Yes: state, due date, interval, reps, lapses, FSRS-6 memory (per their page)</td>
                  <td className="p-3">Yes (per their page)</td>
                  <td className="p-3">Yes, by replaying the review log (per their page)</td>
                  <td className="p-3">Yes: imports study progress (if exported with scheduling)</td>
                  <td className="p-3">Imports supported .apkg (schema-dependent)</td>
                </tr>
                <tr>
                  <th scope="row" className="p-3 text-left font-semibold">Scheduler</th>
                  <td className="p-3">SM-2 by default; FSRS optional</td>
                  <td className="p-3 bg-ruled/5"><strong>FSRS v5</strong></td>
                  <td className="p-3">FSRS-6 (per their page)</td>
                  <td className="p-3">FSRS-6 (per their page)</td>
                  <td className="p-3">FSRS (per their page)</td>
                  <td className="p-3">FSRS (built-in)</td>
                  <td className="p-3">Spaced repetition (custom schedules in Pro)</td>
                </tr>
                <tr>
                  <th scope="row" className="p-3 text-left font-semibold">Mobile review experience</th>
                  <td className="p-3">Classic card UI; AnkiMobile is $24.99 on iOS, AnkiDroid is free</td>
                  <td className="p-3 bg-ruled/5"><strong>Swipe-and-scroll social-style feed on phone; clean flashcard layout on desktop</strong></td>
                  <td className="p-3">Native card UI (free core; paid sync)</td>
                  <td className="p-3">Native iOS app, free (per their page)</td>
                  <td className="p-3">Web card UI (2-button Again/Good)</td>
                  <td className="p-3">Native iPhone card UI (free core; 1-time Pro for widgets/listen mode)</td>
                  <td className="p-3">Native iOS card UI (30 cards free; $1.99/mo or $9.99 lifetime Pro)</td>
                </tr>
                <tr>
                  <th scope="row" className="p-3 text-left font-semibold">Fix for stubborn "leech" words</th>
                  <td className="p-3">Tags/suspends leeches; any fix is manual</td>
                  <td className="p-3 bg-ruled/5"><strong>AI example sentence (free) + ridiculous scene image + native-voice audio (1 credit for picture + audio, or 0 with your own API keys)</strong></td>
                  <td className="p-3">Not a focus</td>
                  <td className="p-3">General AI card generation (7 free per month, per their page)</td>
                  <td className="p-3">Not a focus (per their page)</td>
                  <td className="p-3">Not a focus</td>
                  <td className="p-3">Not a focus</td>
                </tr>
                <tr>
                  <th scope="row" className="p-3 text-left font-semibold">Turn tutor notes into cards</th>
                  <td className="p-3">Manual entry or add-ons</td>
                  <td className="p-3 bg-ruled/5"><strong>Google Docs, Google Sheets, class PDFs (≤10 MB, incl. Canva exports), PowerPoint (≤100 MB), and Preply profile auto-fill, all landing in an Inbox you review first</strong></td>
                  <td className="p-3">Not a focus</td>
                  <td className="p-3">—</td>
                  <td className="p-3">PDF reader for making atomic cards (per their page)</td>
                  <td className="p-3">Not a focus</td>
                  <td className="p-3">Not a focus</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-sm text-ink/60">
            Competitor details are taken from their public pages and App Store listings as of October 27, 2026 and may have changed. Spot something out of date? Tell us at support. Weighing AnkiMobile's $24.99 specifically? See <Link to="/vs/ankimobile" className="text-ruled hover:underline">Schwanki vs AnkiMobile</Link> →
          </p>
        </section>

        {/* Main Content Sections */}
        <section className="mb-12 space-y-8">
          <div>
            <h2 className="text-3xl font-black tracking-tight mb-4">Why Language Learners Look for an Anki Alternative</h2>
            <div className="space-y-4 text-lg">
              <p>Anki is powerful, free on desktop, and its algorithm works. The problem isn't the algorithm.</p>
              <p>Here are the three language-specific frictions that make learners look elsewhere:</p>
              <ol className="list-decimal list-inside space-y-2 ml-4">
                <li>Reviewing on a phone feels like homework, not something your thumb wants to do.</li>
                <li>Leech words look the same as every other plain-text card, so you fail them over and over.</li>
                <li>Tutor notes pile up in Google Docs and slides and never become cards.</li>
              </ol>
              <p>Schwanki keeps what Anki gets right (your decks, your history, a modern FSRS scheduler) and fixes those three things.</p>
            </div>
          </div>

          <div>
            <h2 className="text-3xl font-black tracking-tight mb-4">What Transfers When You Import .apkg or .colpkg</h2>
            <p className="text-lg mb-4">Everything that matters for your reviews: cards, scheduling state, review history, suspended cards, pictures, and audio.</p>
            
            <h3 className="text-2xl font-bold tracking-tight mb-3">What comes across</h3>
            <ul className="list-disc list-inside space-y-2 text-lg ml-4">
              <li>Cards</li>
              <li>Scheduling state</li>
              <li>Review history</li>
              <li>Suspended status</li>
              <li>Pictures</li>
              <li>Audio</li>
            </ul>

            <h3 className="text-2xl font-bold tracking-tight mb-3 mt-6">.apkg vs .colpkg: which should I export?</h3>
            <p className="text-lg mb-4">
              <code className="px-1.5 py-0.5 rounded bg-ink/10">.apkg</code> = one deck (or several selected decks). <code className="px-1.5 py-0.5 rounded bg-ink/10">.colpkg</code> = your whole collection. Schwanki accepts both.
            </p>
            <p className="text-lg">
              <strong>Tip:</strong> when exporting, check <strong>"Include scheduling information"</strong> and <strong>"Include media"</strong>, or your history and audio won't come across.
            </p>

            <h3 className="text-2xl font-bold tracking-tight mb-3 mt-6">What happens to cards you haven't studied yet</h3>
            <p className="text-lg">
              New cards come in at <strong>20 per day by default (you can change this)</strong>, in the <strong>same order Anki would have shown them</strong>, so you aren't hit with a wall of new cards on day one.
            </p>

            <h3 className="text-2xl font-bold tracking-tight mb-3 mt-6">Your imported cards work right away, no AI needed</h3>
            <p className="text-lg">
              Your deck works exactly as you built it. AI is optional and works card by card when you need it.
            </p>
          </div>

          <div>
            <h2 className="text-3xl font-black tracking-tight mb-4">
              Step-by-Step: Export from Anki Desktop, AnkiMobile, and AnkiDroid, Then Import into Schwanki
            </h2>
            <p className="text-lg mb-6">
              Export a .apkg or .colpkg from Anki with scheduling and media included, then upload it in Schwanki. It takes about a minute, and Schwanki never asks for your AnkiWeb password.
            </p>

            <h3 className="text-2xl font-bold tracking-tight mb-3">Export from Anki Desktop (Windows, macOS, Linux)</h3>
            <ol className="list-decimal list-inside space-y-2 text-lg ml-4 mb-6">
              <li>Open Anki and go to <strong>File → Export</strong></li>
              <li>Choose <strong>Anki Deck Package (.apkg)</strong> or <strong>Anki Collection Package (.colpkg)</strong></li>
              <li>Check <strong>Include scheduling information</strong> and <strong>Include media</strong></li>
              <li>Click <strong>Export</strong> and save the file</li>
            </ol>

            <h3 className="text-2xl font-bold tracking-tight mb-3">Export from AnkiMobile (iPhone/iPad)</h3>
            <ol className="list-decimal list-inside space-y-2 text-lg ml-4 mb-6">
              <li>Open AnkiMobile and tap the deck list</li>
              <li>Tap <strong>Add/Export</strong> at the bottom</li>
              <li>Select the deck to export with scheduling and media included</li>
              <li>Save the file to Files or share it</li>
            </ol>

            <h3 className="text-2xl font-bold tracking-tight mb-3">Export from AnkiDroid (Android)</h3>
            <ol className="list-decimal list-inside space-y-2 text-lg ml-4 mb-6">
              <li>Open AnkiDroid and press and hold the deck</li>
              <li>Tap <strong>Export</strong></li>
              <li>Turn on <strong>Include scheduling information</strong> and <strong>Include media</strong></li>
              <li>Save the .apkg file</li>
            </ol>

            <h3 className="text-2xl font-bold tracking-tight mb-3">Import into Schwanki</h3>
            <ol className="list-decimal list-inside space-y-2 text-lg ml-4 mb-6">
              <li>Open Schwanki and go to Import</li>
              <li>Upload the .apkg or .colpkg file</li>
              <li>Set your daily new-card limit (default 20)</li>
              <li>Start reviewing</li>
            </ol>

            <h3 className="text-2xl font-bold tracking-tight mb-3">Why Schwanki doesn't ask for your AnkiWeb login</h3>
            <p className="text-lg">
              It's on purpose: a file you exported is more transparent and safer than handing over your password. You decide exactly what gets shared.
            </p>
          </div>

          <div>
            <h2 className="text-3xl font-black tracking-tight mb-4">FSRS v5 Scheduling & Offline Review</h2>
            <p className="text-lg mb-4">
              Schwanki schedules reviews with FSRS v5, so your intervals pick up where Anki left off instead of resetting.
            </p>

            <h3 className="text-2xl font-bold tracking-tight mb-3">What FSRS tracks for every card</h3>
            <ul className="list-disc list-inside space-y-2 text-lg ml-4">
              <li><strong>Stability</strong>: how long the memory lasts</li>
              <li><strong>Difficulty</strong>: how hard the card is for you</li>
              <li><strong>Retrievability</strong>: your current chance of remembering it</li>
              <li>Plus: reps, due date, and last review</li>
            </ul>

            <h3 className="text-2xl font-bold tracking-tight mb-3 mt-6">Reviewing offline on the subway</h3>
            <p className="text-lg">
              Install Schwanki to your home screen as a PWA. <strong>Once your due cards have loaded, you can review them offline.</strong> New imports, note processing, and AI generation need a connection.
            </p>

            <h3 className="text-2xl font-bold tracking-tight mb-3 mt-6">"You out-scrolled your due cards"</h3>
            <p className="text-lg">
              The queue ends. Unlike an endless feed, Schwanki stops when you're done. <em>The queue ends. Go live a little.</em>
            </p>
          </div>

          <div>
            <h2 className="text-3xl font-black tracking-tight mb-4">A Review Feed Your Thumb Already Knows</h2>
            <p className="text-lg mb-4">
              On your phone, reviews feel like scrolling a social feed. On desktop, you get a clean classic flashcard layout.
            </p>
            <p className="text-lg font-bold">
              Your thumb knows what to do. Give it your vocabulary.
            </p>
          </div>

          <div>
            <h2 className="text-3xl font-black tracking-tight mb-4">
              Fixing Stubborn "Leech" Words with Ridiculous AI Scenes & Native Audio
            </h2>
            <p className="text-lg mb-4">
              When a word won't stick, give it a memorable scene and real pronunciation. In Schwanki, you can add a free AI example sentence, plus a ridiculous scene image and native-voice audio for 1 credit, or for free with your own API keys.
            </p>

            <h3 className="text-2xl font-bold tracking-tight mb-3">Why leeches happen with vocabulary</h3>
            <p className="text-lg mb-4">
              On plain-text cards, similar-looking words blur together. A vivid, absurd image and the sound of the word in a sentence give your memory something distinct to hold onto.
            </p>

            <h3 className="text-2xl font-bold tracking-tight mb-3">"A ridiculous scene": how it works</h3>
            <ol className="list-decimal list-inside space-y-2 text-lg ml-4">
              <li>Flag the stubborn card</li>
              <li>Add an AI example sentence (<strong>free</strong>)</li>
              <li>Add a scene picture and native-voice audio together (<strong>1 Schwanki credit</strong>)</li>
              <li>Review again — the card now has a picture and a voice</li>
            </ol>

            <h3 className="text-2xl font-bold tracking-tight mb-3 mt-6">Bring your own API keys (0 credits)</h3>
            <p className="text-lg mb-4">
              Add your own provider keys in Settings, and picture + audio generation costs 0 Schwanki credits.
            </p>
            <p className="text-lg text-ink/70">
              Transparency: Schwanki's built-in pipeline uses DeepSeek for sentences, fal for pictures, and ElevenLabs / Fish Audio s2.1 Pro for audio.
            </p>
          </div>

          <div>
            <h2 className="text-3xl font-black tracking-tight mb-4">
              From Preply/iTalki Class Notes to Reviewed Cards via the Inbox
            </h2>
            <p className="text-lg mb-4">
              Drop in your tutor's Google Doc, Sheet, PDF, or slides. Schwanki pulls out the vocabulary into an Inbox, you approve it, and only then does it join your FSRS reviews.
            </p>

            <h3 className="text-2xl font-bold tracking-tight mb-3">Supported sources</h3>
            <ul className="list-disc list-inside space-y-2 text-lg ml-4">
              <li>Google Sheets</li>
              <li>Google Docs (picked with Google Picker, so you choose the specific files)</li>
              <li>Class PDFs up to <strong>10 MB</strong> (including Canva "PDF Standard" exports)</li>
              <li>PowerPoint files up to <strong>100 MB</strong></li>
            </ul>

            <h3 className="text-2xl font-bold tracking-tight mb-3 mt-6">Paste your Preply tutor link</h3>
            <p className="text-lg">
              A Preply tutor profile link fills in the teacher's name, photo, and language automatically, so your cards stay organized by teacher.
            </p>

            <h3 className="text-2xl font-bold tracking-tight mb-3 mt-6">The Inbox: "Keep it, correct it, or tell it nah"</h3>
            <p className="text-lg mb-4">
              Why it matters: auto-extracted vocabulary can contain mistakes or words you already know. The Inbox keeps your active deck clean. Nothing enters review until you approve it.
            </p>

            <h3 className="text-2xl font-bold tracking-tight mb-3">A weekly routine that takes about 5 minutes</h3>
            <p className="text-lg">
              After the lesson: drop in the notes → clear the Inbox → the new words show up in tomorrow's feed alongside your imported Anki cards.
            </p>
          </div>

          <div>
            <h2 className="text-3xl font-black tracking-tight mb-4">
              Honest Trade-Offs: When to Stay on Classic Anki vs Switch to Schwanki
            </h2>
            <p className="text-lg mb-4">
              Stay on Anki if you rely on add-ons, complex note types, or LaTeX-heavy decks. Switch to Schwanki if you're learning a language, review mostly on your phone, and want leech fixes and tutor-notes import built in.
            </p>

            <h3 className="text-2xl font-bold tracking-tight mb-3">Stay on classic Anki if…</h3>
            <ul className="list-disc list-inside space-y-2 text-lg ml-4">
              <li>You depend on Anki add-ons or AnkiConnect workflows</li>
              <li>Your decks are heavy on math or LaTeX, or are med-school decks with complex custom note types</li>
              <li>You need a native desktop app and full manual control over every scheduler setting</li>
            </ul>

            <h3 className="text-2xl font-bold tracking-tight mb-3 mt-6">Switch to Schwanki if…</h3>
            <ul className="list-disc list-inside space-y-2 text-lg ml-4">
              <li>You're learning a language with a tutor and your notes live in Docs, Sheets, PDFs, or slides</li>
              <li>You review on your phone and want reviews to feel lighter</li>
              <li>You have leech words that plain text can't fix</li>
            </ul>

            <h3 className="text-2xl font-bold tracking-tight mb-3 mt-6">You don't have to choose forever</h3>
            <p className="text-lg">
              Exporting from Anki leaves your original Anki collection untouched. Anki keeps working as before.
            </p>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="mb-16">
          <h2 className="text-3xl font-black tracking-tight mb-6">Frequently Asked Questions</h2>
          <div className="space-y-6">
            <div className="p-6 rounded-xl bg-white/60 border border-ink/20">
              <h3 className="text-xl font-bold mb-3">Can I import my Anki decks into Schwanki without losing my progress?</h3>
              <p className="text-lg">
                Yes. Export your deck as an .apkg file, or your whole collection as a .colpkg file, from Anki Desktop, AnkiMobile, or AnkiDroid with "Include scheduling information" and "Include media" checked. Schwanki brings over your cards, scheduling state, review history, suspended cards, pictures, and audio, then continues scheduling with FSRS v5 so your intervals pick up where Anki left off.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-white/60 border border-ink/20">
              <h3 className="text-xl font-bold mb-3">Does Schwanki need my AnkiWeb username and password?</h3>
              <p className="text-lg">
                No. Schwanki deliberately does not log in to AnkiWeb. Instead, you export an .apkg or .colpkg file from Anki yourself and upload it. That way, you choose exactly which decks to share, and your AnkiWeb credentials never leave your hands. Schwanki shows step-by-step export instructions for Anki Desktop, AnkiMobile, and AnkiDroid.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-white/60 border border-ink/20">
              <h3 className="text-xl font-bold mb-3">What spaced repetition algorithm does Schwanki use?</h3>
              <p className="text-lg">
                Schwanki uses FSRS v5. For every card it tracks stability, difficulty, retrievability, number of reviews, due date, and last review time. Imported Anki cards keep their scheduling state, so reviews continue from where you were. New cards you haven't studied yet arrive at 20 per day by default, in the order Anki would have shown them, and you can change that limit.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-white/60 border border-ink/20">
              <h3 className="text-xl font-bold mb-3">How does Schwanki help with leech words that never stick?</h3>
              <p className="text-lg">
                Your imported cards work as-is, with no AI required. When a word keeps slipping, you can add an AI example sentence for free, then add a memorable, ridiculous scene image and native-voice pronunciation audio together for 1 Schwanki credit. If you add your own API keys in Settings, the picture and audio cost 0 credits.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-white/60 border border-ink/20">
              <h3 className="text-xl font-bold mb-3">Can Schwanki turn my Preply or iTalki tutor's notes into flashcards?</h3>
              <p className="text-lg">
                Yes. Schwanki extracts vocabulary from Google Docs, Google Sheets, class PDFs up to 10 MB (including Canva PDF exports), and PowerPoint files up to 100 MB. Paste a Preply tutor profile link to fill in your teacher's name, photo, and language. Extracted words land in your Inbox first, so you can keep, correct, or reject each one before it joins your reviews.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-white/60 border border-ink/20">
              <h3 className="text-xl font-bold mb-3">Does Schwanki work offline and on my phone?</h3>
              <p className="text-lg">
                Yes. Schwanki runs in your browser and can be installed to your home screen as a PWA. On a phone, reviews use a swipe-and-scroll feed; on desktop, you get a clean classic flashcard layout. Once your due cards have loaded, you can keep reviewing them offline. Importing decks, processing notes, and generating AI media need a connection.
              </p>
            </div>
          </div>
        </section>

        {/* Closing CTA */}
        <section id="connect" className="mb-16 p-8 rounded-2xl bg-ink text-paper text-center">
          <h2 className="text-3xl font-black tracking-tight mb-4">Bring your Anki deck. Keep your history. Start scrolling.</h2>
          <div className="flex flex-wrap gap-4 justify-center">
            <a href="/sources" className="primary-button">Import your Anki deck</a>
            <a href="/sources" className="secondary-button">Turn class notes into cards</a>
          </div>
        </section>

        {/* Footer note */}
        <footer className="text-sm text-ink/60 border-t border-ink/20 pt-8">
          <p>Anki is a trademark of its respective owner; Schwanki is not affiliated with Anki, AnkiWeb, AnkiMobile, or AnkiDroid.</p>
        </footer>
      </article>
    </main>
  );
}
