import { Link } from "react-router-dom";
import { PAGES } from "@/lib/seo";
import { usePageMeta } from "@/lib/usePageMeta";

export default function SharedDecksSafetyGuide() {
  usePageMeta(PAGES.sharedDecksSafetyGuide);

  return (
    <main className="page-shell landing-editorial">
      <article className="mx-auto max-w-3xl">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-4 text-sm text-ink/60">
          <Link to="/" className="hover:text-ink">Schwanki</Link> › <Link to="/anki-alternative" className="hover:text-ink">Anki Alternative</Link> › <span className="text-ink">Deck Safety</span>
        </nav>

        {/* Page Header */}
        <header className="mb-8 space-y-4">
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-tight">
            Are Shared Anki Decks Safe? What Anki 26.09.4's Critical Fixes Mean Before You Import an .apkg
          </h1>
          <p className="text-sm text-ink/60">Updated 2026-11-05</p>
          <p className="text-sm text-ink/60">Facts checked against Anki's forum post, GitHub release notes and apps.ankiweb.net on 5 Nov 2026.</p>
        </header>

        {/* Direct Answer Snippet */}
        <div className="mb-8 p-6 rounded-xl bg-white/60 border border-ink/20">
          <p className="text-lg leading-relaxed">
            <strong>Short answer:</strong> Shared Anki decks are usually fine to <em>study</em>, but an .apkg isn't just plain text. It can contain HTML and media that desktop Anki processes. Anki 26.09.4 (released 4 Nov 2026) fixes two critical issues where a malicious shared deck could run code: one when notes were viewed in the <strong>editor</strong>, and one on <strong>macOS</strong> via "Show in Folder." Update desktop Anki to <strong>26.09.4 or later</strong>, update your OS, and prefer decks from sources you trust.
          </p>
        </div>

        {/* Main Content */}
        <section className="mb-12 space-y-12">
          {/* H2 1 - What Anki 26.09.4 fixed */}
          <div>
            <h2 className="text-3xl font-black tracking-tight mb-4">What Anki 26.09.4 fixed (in plain English)</h2>
            <p className="text-lg mb-6">
              Anki 26.09.4 is a security-only update released on 4 November 2026. It closes two ways a shared deck could run code on your computer, and it blocks compromised eMudhra certificates. Nothing else changes.
            </p>

            <div className="overflow-x-auto mb-6">
              <table className="w-full border-collapse text-sm">
                <caption className="mb-4 text-left text-base sr-only">
                  Three security fixes in Anki 26.09.4
                </caption>
                <thead>
                  <tr className="border-b-2 border-ink">
                    <th scope="col" className="p-3 text-left font-bold">Issue</th>
                    <th scope="col" className="p-3 text-left font-bold">What it did</th>
                    <th scope="col" className="p-3 text-left font-bold">Advisory ID</th>
                    <th scope="col" className="p-3 text-left font-bold">Credit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/20">
                  <tr>
                    <th scope="row" className="p-3 font-semibold">Editor + iframes</th>
                    <td className="p-3">Shared decks could execute arbitrary code via iframes when viewed in the editor</td>
                    <td className="p-3">GHSA-j9v5-m549-cg6c</td>
                    <td className="p-3">@DePierre</td>
                  </tr>
                  <tr>
                    <th scope="row" className="p-3 font-semibold">macOS + "Show in Folder"</th>
                    <td className="p-3">Shared decks could execute arbitrary commands via specially crafted image filenames when the "Show in Folder" editor action is used</td>
                    <td className="p-3">GHSA-gfvm-4968-jp9m</td>
                    <td className="p-3">@hyperreality and @Hama1cco</td>
                  </tr>
                  <tr>
                    <th scope="row" className="p-3 font-semibold">eMudhra certificates</th>
                    <td className="p-3">Compromised eMudhra intermediate CA certificates are now disallowed, in response to a wider security incident affecting most systems and browsers</td>
                    <td className="p-3">—</td>
                    <td className="p-3">—</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="text-lg mb-4">
              Anki 26.09.4 is built on 26.09.3, with no UX changes. Anki calls the fixes <strong>critical</strong> and strongly recommends everyone update ASAP on every platform.
            </p>

            <p className="text-lg mb-4">
              The update is available from <a href="https://apps.ankiweb.net/" className="text-ruled hover:underline" target="_blank" rel="noopener noreferrer">apps.ankiweb.net</a>, which lists 26.09.4 as the current desktop version for Windows, macOS and Linux. You can also accept the in-app update prompt. Sources: <a href="https://forums.ankiweb.net/t/anki-26-09-4-released-critical-security-update/74222" className="text-ruled hover:underline" target="_blank" rel="noopener noreferrer">Anki forum post</a> and <a href="https://github.com/ankitects/anki/releases/" className="text-ruled hover:underline" target="_blank" rel="noopener noreferrer">GitHub release notes</a> (tag 26.09.4, commit c06370f).
            </p>

            <p className="text-base text-ink/70">
              Note: The GHSA advisory IDs above were not available as public pages when checked on 5 Nov 2026. Anki's forum post and GitHub release notes are the primary sources for these details.
            </p>
          </div>

          {/* H2 2 - So, are shared Anki decks safe? */}
          <div>
            <h2 className="text-3xl font-black tracking-tight mb-4">So, are shared Anki decks safe?</h2>
            <p className="text-lg mb-4">
              Most people download shared decks without trouble. The risk is that an .apkg can carry HTML and media, not just text, and unpatched desktop Anki had bugs in how the editor handled that content.
            </p>

            <p className="text-lg mb-4">
              An Anki Deck Package (.apkg) contains notes, card templates (which include HTML and CSS), media files, and optional scheduling information. For more on what's in the file, see <Link to="/guides/export-anki-with-scheduling" className="text-ruled hover:underline">our guide to exporting with scheduling</Link>.
            </p>

            <p className="text-lg mb-4">
              The risk comes from <strong>unpatched software + untrusted content</strong>, not from decks being inherently dangerous. There is <strong>no</strong> public data on how many decks, if any, are malicious. This page does not claim AnkiWeb shared decks are compromised.
            </p>

            <h3 className="text-2xl font-bold tracking-tight mb-3">Studying vs. editing: why the distinction matters</h3>
            <p className="text-lg mb-4">
              The iframe issue was reported for notes <strong>viewed in the editor</strong>. The macOS issue requires the <strong>"Show in Folder"</strong> editor action. Both affect editor workflows.
            </p>
            <p className="text-lg">
              Anki's notes describe both issues in terms of the editor. That doesn't mean other paths are guaranteed safe, so the fix is to update rather than to avoid the editor.
            </p>
          </div>

          {/* H2 3 - What to do right now */}
          <div>
            <h2 className="text-3xl font-black tracking-tight mb-4">What to do right now (checklist)</h2>
            <p className="text-lg mb-6">
              Update desktop Anki to 26.09.4 or newer on every computer you use, then update your operating system.
            </p>

            <ol className="list-decimal list-inside space-y-3 text-lg ml-4 mb-6">
              <li><strong>Check your version:</strong> Open Anki's About screen to see which version you have.</li>
              <li><strong>Update:</strong> Accept the in-app update prompt or download from <a href="https://apps.ankiweb.net/" className="text-ruled hover:underline" target="_blank" rel="noopener noreferrer">apps.ankiweb.net</a>. The site lists 26.09.4 for Windows 10+ / 11 ARM, macOS 13+ on Apple Silicon or Intel, and Linux.</li>
              <li><strong>Update your OS</strong> because of the eMudhra certificate note.</li>
              <li><strong>Update before</strong> you open newly downloaded decks in the editor. On a Mac, avoid "Show in Folder" on shared-deck media until you've updated.</li>
              <li><strong>Prefer trusted sources:</strong> people you know, course instructors, well-known community decks. Be more careful with random .apkg files from file-sharing links, Discord dumps and the like.</li>
              <li><strong>Keep backups</strong> before importing big shared decks (see <Link to="/guides/export-anki-with-scheduling" className="text-ruled hover:underline">our export guide</Link>). This is general good practice, not a security fix.</li>
            </ol>

            <h3 className="text-2xl font-bold tracking-tight mb-3">"I opened a shared deck in the editor before updating — now what?"</h3>
            <p className="text-lg">
              Update Anki and the OS now. If you have reason to think a deck was malicious, treat it like any other suspicious download: run your usual security software and follow your OS vendor's guidance.
            </p>
          </div>

          {/* H2 4 - Timeline */}
          <div>
            <h2 className="text-3xl font-black tracking-tight mb-4">A short timeline: Anki's 26.09.x security fixes</h2>
            <p className="text-lg mb-6">
              26.09.4 isn't the first fix in this series. Several 26.09.x releases addressed how Anki handles content from notes and decks, which is a sign the team is actively hardening it.
            </p>

            <div className="overflow-x-auto mb-6">
              <table className="w-full border-collapse text-sm">
                <caption className="mb-4 text-left text-base sr-only">
                  Anki 26.09.x security timeline
                </caption>
                <thead>
                  <tr className="border-b-2 border-ink">
                    <th scope="col" className="p-3 text-left font-bold">Version</th>
                    <th scope="col" className="p-3 text-left font-bold">Date</th>
                    <th scope="col" className="p-3 text-left font-bold">Security-relevant note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/20">
                  <tr>
                    <th scope="row" className="p-3 font-semibold">26.09</th>
                    <td className="p-3">14 Sep 2026</td>
                    <td className="p-3">Notes could read local files when viewed in the editor; the "Open image" context menu didn't validate file extensions</td>
                  </tr>
                  <tr>
                    <th scope="row" className="p-3 font-semibold">26.09.2</th>
                    <td className="p-3">15 Sep 2026</td>
                    <td className="p-3">Prevented external links in deck descriptions on the overview/congrats screens from manipulating the page in certain cases when clicked. Upgrade-ASAP messaging</td>
                  </tr>
                  <tr>
                    <th scope="row" className="p-3 font-semibold">26.09.3</th>
                    <td className="p-3">23 Sep 2026</td>
                    <td className="p-3">Bugfixes, still with "Please upgrade to 26.09+ … important security fixes" messaging</td>
                  </tr>
                  <tr>
                    <th scope="row" className="p-3 font-semibold">26.09.4</th>
                    <td className="p-3">4 Nov 2026</td>
                    <td className="p-3">The two critical shared-deck fixes plus the eMudhra CA change</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="text-lg">
              The takeaway isn't "stop using Anki." It's "stay on the latest version."
            </p>
          </div>

          {/* H2 5 - Mobile and other apps */}
          <div>
            <h2 className="text-3xl font-black tracking-tight mb-4">What about mobile and other apps that open Anki decks?</h2>
            <p className="text-lg mb-4">
              The 26.09.4 notes are about desktop Anki. Other apps that import .apkg files have their own code and their own update cycles, so keep whichever app you use up to date.
            </p>

            <p className="text-lg mb-4">
              AnkiMobile and AnkiDroid are separate apps. We don't know whether they were affected. Check each app's own release notes and keep it updated. For context on AnkiMobile, see <Link to="/vs/ankimobile" className="text-ruled hover:underline">our AnkiMobile comparison</Link>.
            </p>

            <p className="text-lg">
              General principle: any app that renders deck HTML is processing content written by someone else. The source still matters.
            </p>
          </div>

          {/* H2 6 - Where Schwanki fits */}
          <div>
            <h2 className="text-3xl font-black tracking-tight mb-4">Where Schwanki fits (soft)</h2>
            <p className="text-lg mb-4">
              Schwanki is a phone-first review app. It imports your .apkg or .colpkg exports into an FSRS swipe feed. It is not a security tool.
            </p>

            <p className="text-lg mb-4">
              Schwanki imports .apkg and .colpkg files, keeping scheduling and history when the export includes scheduling and media. It uses FSRS v5 and runs as an installable PWA. Schwanki <strong>never asks for your AnkiWeb password</strong>.
            </p>

            <p className="text-lg mb-6">
              <strong>Importing a deck into Schwanki doesn't make an untrusted deck safe. Only import decks you'd trust in Anki too, and keep desktop Anki updated.</strong>
            </p>

            <div className="flex flex-wrap gap-4 items-center">
              <Link to="/anki-alternative" className="primary-button">Try Schwanki with your Anki deck</Link>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="mb-16">
          <h2 className="text-3xl font-black tracking-tight mb-6">Frequently Asked Questions</h2>
          <div className="space-y-6">
            <div className="p-6 rounded-xl bg-white/60 border border-ink/20">
              <h3 className="text-xl font-bold mb-3">Are shared Anki decks safe to download?</h3>
              <p className="text-lg">
                Usually, yes, but an .apkg can contain HTML and media, not just text. Anki 26.09.4 (4 Nov 2026) fixed two critical bugs where a malicious shared deck could run code via the desktop editor or, on macOS, the "Show in Folder" action. Update to 26.09.4 or later and prefer decks from sources you trust.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-white/60 border border-ink/20">
              <h3 className="text-xl font-bold mb-3">What did Anki 26.09.4 fix?</h3>
              <p className="text-lg">
                Three things: shared decks could execute code via iframes when viewed in the editor (GHSA-j9v5-m549-cg6c); on macOS, crafted image filenames could execute commands via "Show in Folder" (GHSA-gfvm-4968-jp9m); and compromised eMudhra intermediate CA certificates are now blocked. Nothing else changed.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-white/60 border border-ink/20">
              <h3 className="text-xl font-bold mb-3">Do I need to update if I only study and never edit cards?</h3>
              <p className="text-lg">
                Yes. Anki recommends that everyone update on every platform. The reported issues involve the editor, but updating is the simple, recommended fix regardless of how you use Anki.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-white/60 border border-ink/20">
              <h3 className="text-xl font-bold mb-3">Is updating Anki enough?</h3>
              <p className="text-lg">
                Not completely. Anki says that because of the eMudhra certificate incident, which affects most systems and browsers, you should also fully update your operating system.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-white/60 border border-ink/20">
              <h3 className="text-xl font-bold mb-3">Where do I get Anki 26.09.4?</h3>
              <p className="text-lg">
                Accept the in-app update prompt, or download it from apps.ankiweb.net, which lists 26.09.4 as the current desktop version for Windows, macOS and Linux.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-white/60 border border-ink/20">
              <h3 className="text-xl font-bold mb-3">Does importing a deck into Schwanki make it safe?</h3>
              <p className="text-lg">
                No. Schwanki is a review app that imports .apkg/.colpkg files. It isn't a security scanner or sandbox. Only import decks you'd trust in Anki, and keep desktop Anki updated.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-white/60 border border-ink/20">
              <h3 className="text-xl font-bold mb-3">Were AnkiMobile or AnkiDroid affected?</h3>
              <p className="text-lg">
                Anki's 26.09.4 notes cover desktop Anki. Check each app's own release notes and keep it updated.
              </p>
            </div>
          </div>
        </section>

        {/* Closing line */}
        <section className="mb-12">
          <p className="text-lg">
            Update Anki to 26.09.4+, update your OS, and stick to decks from sources you trust. That covers what Anki's critical fixes ask of you.
          </p>
        </section>

        {/* CTA */}
        <section className="mb-16 p-8 rounded-2xl bg-ink text-paper text-center">
          <h2 className="text-3xl font-black tracking-tight mb-4">Updated Anki? Import your deck into Schwanki</h2>
          <div className="flex flex-wrap gap-4 justify-center">
            <a href="/sources" className="primary-button">Import your Anki deck</a>
            <Link to="/anki-alternative" className="secondary-button">Learn more about Schwanki</Link>
          </div>
        </section>
      </article>
    </main>
  );
}
