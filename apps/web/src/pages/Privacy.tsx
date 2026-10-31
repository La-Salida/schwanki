import { LegalPage } from "@/components/LegalPage";
import { OPERATOR, SUPPORT_EMAIL } from "@/lib/legal";
import { PAGES } from "@/lib/seo";

export default function Privacy() {
  return (
    <LegalPage page={PAGES.privacy} heading="Privacy Policy">
      <p>Schwanki is run by {OPERATOR} ("we"). This policy explains what we collect when you use schwankiapp.com, why, who else handles it, and how to delete it. Questions go to <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>Your Google account basics.</strong> When you sign in with Google we receive your name, email address and profile picture. We don't receive your Google password.</li>
        <li><strong>What you study.</strong> Cards, decks, notes, review ratings and scheduling data, plus anything you import: Anki files (.apkg, .colpkg) with their media, class PDFs and slides, Preply chats and teacher profile links, and recordings you choose to make with the browser extension.</li>
        <li><strong>Google Drive files you pick.</strong> If you connect Google Drive, we can only open the Docs and Sheets you select in Google's file picker. We read their text to find vocabulary and refresh them so new notes show up. We keep a token so this works while you're away.</li>
        <li><strong>Memory aids we make for you.</strong> Example sentences, pictures, audio and video generated for your cards.</li>
        <li><strong>Purchases.</strong> Which credit packs you bought and how many credits you've used. Stripe handles your card details; we never see or store them.</li>
        <li><strong>Your own AI keys.</strong> If you add API keys for other AI providers, we store them so we can make requests for you. They're never shown back in the app.</li>
        <li><strong>Reminders.</strong> If you turn on notifications, your browser's push subscription.</li>
        <li><strong>How you found us and how you use the app.</strong> The link that first brought you here (campaign tags and referring site), your answer if you tell us how you heard about Schwanki, and usage events such as pages viewed, decks imported, cards reviewed and purchases started. These are tied to your account ID, not your name or email, and never include the words on your cards.</li>
      </ul>

      <h2>How we use it</h2>
      <p>Only to run Schwanki: to sign you in, schedule and sync your reviews, turn your notes into suggested cards, generate the memory aids you ask for, process payments, send the reminders you turn on, and answer you when you write to us. We don't sell your data, show ads, or use your content to train AI models.</p>

      <h2>Who else handles your data</h2>
      <p>We use these services to run Schwanki. Each one only gets what it needs for its job.</p>
      <ul>
        <li><strong>Supabase</strong>: database, file storage and sign-in. Data is stored in Singapore.</li>
        <li><strong>Cloudflare</strong>: hosts the website.</li>
        <li><strong>Google</strong>: sign-in and the Drive files you pick.</li>
        <li><strong>Stripe</strong>: payments.</li>
        <li><strong>Amplitude</strong>: product analytics, so we can see which parts of Schwanki help people keep studying. Gets the usage events above and your browser type, and may infer a rough location (country or city) from your connection, but not your name, email or card contents.</li>
        <li><strong>Sentry</strong>: crash and error reports, so we can fix bugs. Reports include your account ID, browser and the page you were on, but not your name or email.</li>
        <li><strong>DeepSeek</strong>: reads note text to suggest vocabulary and writes example sentences.</li>
        <li><strong>Fal</strong>: generates pictures and video.</li>
        <li><strong>ElevenLabs</strong>: generates pronunciation audio.</li>
        <li><strong>Providers you choose</strong>: if you add your own key for a provider such as OpenAI, Anthropic or OpenRouter, requests for your cards go to that provider under your account with them.</li>
      </ul>
      <p>Some of these providers process data in other countries, including the United States and China.</p>

      <h2>Google user data</h2>
      <p>Schwanki's use and transfer of information received from Google APIs adheres to the <a href="https://developers.google.com/terms/api-services-user-data-policy">Google API Services User Data Policy</a>, including the Limited Use requirements. We use Drive content only to make your cards, don't use it for ads, and don't let people read it except when you ask us to help with a problem, for security, or when the law requires it.</p>

      <h2>Cookies and storage</h2>
      <p>We don't use advertising or tracking cookies. The app keeps your sign-in session and an offline copy of your due cards in your browser's storage so reviews work without a connection. Amplitude keeps a random device ID in the same storage so it can count visits.</p>

      <h2>How long we keep it</h2>
      <p>We keep your data while you have an account. When you delete your account, we delete your cards, review history, files, generated media and stored keys straight away, and ask Google to revoke Schwanki's access to your Drive. Stripe keeps payment records as required by law. Backups made before deletion expire on their normal schedule.</p>

      <h2>Your choices and rights</h2>
      <ul>
        <li><strong>Delete your account</strong> any time from <a href="/account">Account</a> → Delete account.</li>
        <li><strong>Disconnect Google Drive</strong> at <a href="https://myaccount.google.com/connections">myaccount.google.com/connections</a>.</li>
        <li><strong>Get a copy of your data, correct it, or object to how we use it</strong> by emailing <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. We answer within 30 days. Depending on where you live (for example the EU, UK or California), you may also complain to your local data protection authority.</li>
      </ul>

      <h2>Children</h2>
      <p>Schwanki isn't meant for children under 13, or under 16 in the EU and UK. If you think a child has signed up, email us and we'll delete the account.</p>

      <h2>Security</h2>
      <p>Data travels over HTTPS, and every account can only read its own data. No system is perfectly secure; if a breach affects your data, we'll tell you.</p>

      <h2>Changes</h2>
      <p>If we change this policy in a way that matters, we'll update the date above and tell you in the app before the change applies.</p>
    </LegalPage>
  );
}
