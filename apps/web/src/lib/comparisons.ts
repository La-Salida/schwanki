export interface Comparison {
  name: string;
  path: string;
  title: string;
  description: string;
  answer: string;
  rows: { topic: string; schwanki: string; other: string }[];
  example: { title: string; text: string };
  questions: { question: string; answer: string }[];
  sources: { title: string; url: string }[];
}

export const COMPARISON_DATE = "2026-11-04";

export const COMPARISONS: Comparison[] = [
  {
    name: "Preply",
    path: "/vs/preply",
    title: "Schwanki vs Preply for Reviewing Lesson Vocabulary",
    description: "Compare Preply’s built-in vocabulary review with Schwanki’s swipe feed. Learn how to turn a tutor’s Canva PDF, slides, or notes into flashcards.",
    answer: "Use Preply for live tutoring and the review tools built into its classroom. Use Schwanki alongside it when your tutor shares a Canva PDF, slides, or notes you want to turn into flashcards and study in a phone feed.",
    rows: [
      { topic: "Where words come from", schwanki: "Upload your tutor’s class PDF, PowerPoint, or screenshots, or connect Google Docs or Sheets.", other: "Preply’s classroom brings together lesson notes, shared files, and vocabulary." },
      { topic: "How you review", schwanki: "Approve suggested cards in your Inbox, then swipe through the cards due for spaced repetition.", other: "Preply offers built-in vocabulary flashcards. Its optional Lesson Insights summarize English lessons and suggest exercises." },
      { topic: "What you bring", schwanki: "Keep vocabulary from multiple teachers alongside your own decks, including imported Anki cards.", other: "Book and take lessons in Preply and use the learning materials in its classroom." },
    ],
    example: {
      title: "How do you turn a Preply lesson into flashcards?",
      text: "Ask your tutor for the PDF they used in class, or download their shared Canva design as a PDF. Upload it under class notes in Schwanki, then check the Inbox for vocabulary suggestions. Keep the cards you recognize from class and swipe through them as they come due.",
    },
    questions: [
      { question: "How does Schwanki get material from my Preply lesson?", answer: "Upload the class file yourself. You can also paste a Preply tutor profile link to fill in their details." },
      { question: "Does Preply already have vocabulary review?", answer: "Yes. Preply offers vocabulary flashcards in its classroom. Its optional Lesson Insights give feedback and exercise suggestions for English lessons." },
    ],
    sources: [
      { title: "Preply’s classroom guide for students", url: "https://help.preply.com/en/articles/4182666-preply-classroom-a-student-s-guide" },
      { title: "Preply’s Lesson Insights documentation", url: "https://help.preply.com/en/articles/10385861-lesson-insights" },
    ],
  },
  {
    name: "Migaku",
    path: "/vs/migaku",
    title: "Schwanki vs Migaku for Language Flashcards",
    description: "Compare Migaku’s Netflix and YouTube sentence mining with Schwanki’s lesson-note imports and mobile spaced-repetition feed.",
    answer: "Choose Migaku if you want to mine sentences while watching Netflix or YouTube. Choose Schwanki if you want to turn your tutor’s materials into flashcards and swipe through your due vocabulary on your phone.",
    rows: [
      { topic: "Where words come from", schwanki: "Tutor PDFs, Canva exports, slides, screenshots, Google Docs, Sheets, and existing Anki decks.", other: "Mine words and sentences from supported video sites and other native content." },
      { topic: "How you make a card", schwanki: "Check suggested vocabulary from a lesson in your Inbox. Edit and approve the cards you want.", other: "Pick a subtitle word and create a card with context such as a screenshot and a clip of the original audio." },
      { topic: "How you review", schwanki: "Swipe through cards due under FSRS. Import your Anki export with supported media and any included review history.", other: "Send the cards you make to Migaku Memory or Anki for review." },
    ],
    example: {
      title: "Which fits a learner who takes classes and watches shows?",
      text: "Use Migaku to save a line you heard in a show with its original audio. Use Schwanki to bring in the vocabulary from a tutor’s Canva PDF. If you sent your mined cards to Anki, you can export that deck and bring it into Schwanki too.",
    },
    questions: [
      { question: "Can Schwanki mine Netflix or YouTube subtitles?", answer: "Schwanki makes cards from class materials you supply and imports existing Anki decks. For creating cards from video subtitles as you watch, use Migaku’s browser extension." },
      { question: "Can I bring my Migaku cards into Schwanki?", answer: "If you sent the cards to Anki, export the deck as an .apkg file and upload it to Schwanki. Include scheduling information and media in the export to bring them along." },
    ],
    sources: [
      { title: "Migaku’s guide to making cards from video", url: "https://migaku.com/blog/youtube/card-creation-from-video-content-migaku-browser-extension" },
      { title: "Migaku’s feature overview", url: "https://migaku.com/faq/features" },
    ],
  },
  {
    name: "Lymi",
    path: "/vs/lymi",
    title: "Schwanki vs Lymi for Tutor Lesson Flashcards",
    description: "Compare Lymi and Schwanki for making flashcards from tutor notes, reviewing on your phone, and bringing an existing Anki deck.",
    answer: "Both Schwanki and Lymi turn tutor materials into flashcards, schedule reviews with FSRS, and import Anki history. Schwanki gives you a full-screen swipe feed for due cards. Lymi offers a tap-to-grade review screen and lets connected AI assistants add cards from lesson materials.",
    rows: [
      { topic: "Where words come from", schwanki: "Class PDFs, Canva PDF exports, PowerPoint, screenshots, Google Docs, and Google Sheets.", other: "Tutor materials you supply, including PDFs, copied chats, transcripts, and whiteboard photos." },
      { topic: "How you make a card", schwanki: "Review extracted vocabulary in the Inbox and edit or approve the suggestions you want to keep.", other: "Add cards through a connected AI assistant or select words with Smart add." },
      { topic: "How you review", schwanki: "Reveal and rate due cards in a full-screen phone feed. FSRS schedules the next review.", other: "Reveal and tap a grade for one card at a time. FSRS schedules the next review." },
    ],
    example: {
      title: "What happens when your tutor shares a Canva PDF?",
      text: "In Schwanki, upload the PDF, approve the vocabulary in your Inbox, and see the cards in your swipe feed as they come due. In Lymi, upload the PDF with Smart add, pick the words you want, and review them from its Today screen.",
    },
    questions: [
      { question: "Do both tools work with Preply lesson materials?", answer: "Yes. In both cases, bring the material yourself. For example, paste a copied lesson chat into Lymi or upload a Canva PDF from your tutor to Schwanki." },
      { question: "Does Schwanki require an Anki deck?", answer: "You can start with class notes alone. Anki import is available for learners who already have cards and want to carry over their progress." },
    ],
    sources: [
      { title: "Lymi’s guide to turning tutor lessons into flashcards", url: "https://lymi.app/tutor-lessons" },
      { title: "Lymi’s language learning and Anki import overview", url: "https://lymi.app/languages" },
    ],
  },
];
