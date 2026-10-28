// Pricing FAQ, shared by the page and its JSON-LD. No package imports: vite.config.ts loads this
// through seo.ts at build time, so the numbers are passed in and seo.test.ts keeps them honest.
export function pricingFaq(starterCredits: number): Array<[question: string, answer: string]> {
  return [
    ["Is Schwanki free?", `Yes. Decks, reviews, Anki imports and FSRS scheduling are free, with no card limit. Reading class notes into cards is free for 10 documents a day, and example sentences are free for 50 a day. Every new account also gets ${starterCredits} AI credits to try pictures and audio.`],
    ["Is this a subscription?", "No. Credit packs are one-time payments. Nothing renews and there's nothing to cancel."],
    ["Do credits expire?", "No expiry date. Credits stay on your account until you spend them."],
    ["What happens when I run out?", "Your decks and reviews keep working. You only need credits for pictures, audio, class pictures, AI suggestions, and imports or sentences past the free daily amount. The goose will suggest a refill. It's not asking."],
    ["Can I use my own AI keys instead?", "Yes. Add keys from OpenAI, Anthropic, OpenRouter, ElevenLabs, fal and others in Settings. Your provider bills you directly, Schwanki adds nothing, and no credits are used for what your keys cover."],
    ["How do payments and refunds work?", "Stripe handles checkout in USD, and every purchase comes with a receipt in Billing. Purchases are non-refundable unless the law says otherwise or something went wrong on our side. If it did, email us and we'll sort it out."],
  ];
}
