import { LegalPage } from "@/components/LegalPage";
import { OPERATOR, SUPPORT_EMAIL } from "@/lib/legal";
import { PAGES } from "@/lib/seo";

export default function Terms() {
  return (
    <LegalPage page={PAGES.terms} heading="Terms of Service">
      <p>These terms are an agreement between you and {OPERATOR} ("we"), which runs Schwanki. By using Schwanki you agree to them. If you don't agree, please don't use it.</p>

      <h2>Your account</h2>
      <p>You sign in with a Google account and are responsible for what happens under it. You must be at least 13, or at least 16 in the EU and UK.</p>

      <h2>Your content</h2>
      <p>Your cards, notes, imports and recordings stay yours. You give us permission to store, process and display them only as needed to run Schwanki for you, including sending them to the providers named in our <a href="/privacy">Privacy Policy</a>. Only upload content you have the right to use. If you record a class, make sure everyone in it has agreed to be recorded.</p>

      <h2>AI-generated content</h2>
      <p>Suggested cards, readings, translations, sentences, pictures and audio are made by AI and can be wrong or odd. Check them before you rely on them. You can use what Schwanki generates for your cards however you like.</p>

      <h2>Credits and payments</h2>
      <ul>
        <li>Schwanki AI credits are prepaid and pay for AI generation on our keys. Prices are shown before you buy, and payment is processed by Stripe.</li>
        <li>Credits have no cash value and can't be transferred. Purchases are non-refundable except where the law requires otherwise, or if something went wrong on our side. Email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> and we'll sort it out.</li>
        <li>Free starter credits are a one-time gift per person. Creating extra accounts to collect them again isn't allowed.</li>
        <li>If you use your own AI provider keys, that provider bills you directly under its own terms.</li>
      </ul>

      <h2>Fair use</h2>
      <p>Don't misuse Schwanki. For example, don't try to get into other people's accounts or data, overload or probe the service, automate requests to drain AI resources, use it to make illegal or harmful content, or resell it. We may limit, suspend or close accounts that do.</p>

      <h2>The service</h2>
      <p>We're constantly improving Schwanki, so features may change or go away. We'll try to keep it running, but we can't promise it will always be available or error-free. Keep your own backups of anything important, such as your original Anki exports.</p>
      <p>Schwanki isn't affiliated with Anki, AnkiWeb, AnkiMobile, AnkiDroid, Preply or Google.</p>

      <h2>Ending things</h2>
      <p>You can stop at any time and delete your account from <a href="/account">Account</a>. We may suspend or close an account that breaks these terms, and will tell you why unless the law prevents it.</p>

      <h2>Disclaimers and liability</h2>
      <p>Schwanki is provided "as is", without warranties of any kind, to the extent the law allows. To the extent the law allows, we aren't liable for indirect or consequential losses, and our total liability for any claim is limited to the amount you paid us in the 12 months before it. Nothing here limits rights you have under consumer law that can't be waived.</p>

      <h2>Changes</h2>
      <p>If we change these terms in a way that matters, we'll update the date above and tell you in the app before the change applies. If you keep using Schwanki after that, you accept the new terms.</p>

      <h2>Contact</h2>
      <p>Questions about these terms: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</p>
    </LegalPage>
  );
}
