// Structured data (JSON-LD) schemas for SEO pages
import { pricingFaq } from "./pricingFaq.ts";

const organization = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": "https://schwankiapp.com/#organization",
  "name": "Schwanki",
  "url": "https://schwankiapp.com/",
  "logo": "https://schwankiapp.com/icons/icon-512.png"
};

const website = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": "https://schwankiapp.com/#website",
  "name": "Schwanki",
  "url": "https://schwankiapp.com/",
  "publisher": { "@id": "https://schwankiapp.com/#organization" }
};

const softwareApp = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "@id": "https://schwankiapp.com/#app",
  "name": "Schwanki",
  "url": "https://schwankiapp.com/",
  "applicationCategory": "EducationalApplication",
  "applicationSubCategory": "Spaced repetition flashcards",
  "operatingSystem": "Web, iOS (PWA), Android (PWA)",
  "image": "https://schwankiapp.com/og/home.jpg",
  "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD", "description": "Free to use, with optional paid AI credits" },
  "publisher": { "@id": "https://schwankiapp.com/#organization" },
  "description": "A modern take on Anki: spaced repetition with the swipe-and-scroll feel of a social feed. Bring your Anki decks or build new ones from your notes.",
  "featureList": [
    "Import Anki .apkg and .colpkg files from Anki Desktop, AnkiMobile, and AnkiDroid",
    "Preserves cards, scheduling state, review history, suspended cards, pictures, and audio",
    "FSRS v5 spaced repetition scheduling",
    "Swipe-and-scroll review feed on mobile; classic flashcard layout on desktop",
    "Installable PWA with offline review of loaded due cards",
    "Free AI example sentences (50 a day); AI scene images and native-voice audio for stubborn words",
    "Vocabulary extraction from Google Docs, Google Sheets, PDFs, and PowerPoint into a review Inbox",
    "Preply tutor profile auto-fill"
  ]
};

export function homeStructuredData() {
  return {
    "@context": "https://schema.org",
    "@graph": [organization, website, softwareApp]
  };
}

export function ankiAlternativeStructuredData() {
  const faqPage = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "Can I import my Anki decks into Schwanki without losing my progress?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes. Export your deck as an .apkg file, or your whole collection as a .colpkg file, from Anki Desktop, AnkiMobile, or AnkiDroid with \"Include scheduling information\" and \"Include media\" checked. Schwanki brings over your cards, scheduling state, review history, suspended cards, pictures, and audio, then continues scheduling with FSRS v5 so your intervals pick up where Anki left off."
        }
      },
      {
        "@type": "Question",
        "name": "Does Schwanki need my AnkiWeb username and password?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "No. Schwanki deliberately does not log in to AnkiWeb. Instead, you export an .apkg or .colpkg file from Anki yourself and upload it. That way, you choose exactly which decks to share, and your AnkiWeb credentials never leave your hands. Schwanki shows step-by-step export instructions for Anki Desktop, AnkiMobile, and AnkiDroid."
        }
      },
      {
        "@type": "Question",
        "name": "What spaced repetition algorithm does Schwanki use?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Schwanki uses FSRS v5. For every card it tracks stability, difficulty, retrievability, number of reviews, due date, and last review time. Imported Anki cards keep their scheduling state, so reviews continue from where you were. New cards you haven't studied yet arrive at 20 per day by default, in the order Anki would have shown them, and you can change that limit."
        }
      },
      {
        "@type": "Question",
        "name": "How does Schwanki help with leech words that never stick?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Your imported cards work as-is, with no AI required. When a word keeps slipping, you can add an AI example sentence for free (up to 50 a day), then add a memorable, ridiculous scene image and native-voice pronunciation audio together for 1 Schwanki credit. If you add your own API keys in Settings, the picture and audio cost 0 credits."
        }
      },
      {
        "@type": "Question",
        "name": "Can Schwanki turn my Preply or iTalki tutor's notes into flashcards?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes. Schwanki extracts vocabulary from Google Docs, Google Sheets, class PDFs up to 10 MB (including Canva PDF exports), and PowerPoint files up to 100 MB. Paste a Preply tutor profile link to fill in your teacher's name, photo, and language. Extracted words land in your Inbox first, so you can keep, correct, or reject each one before it joins your reviews."
        }
      },
      {
        "@type": "Question",
        "name": "Does Schwanki work offline and on my phone?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes. Schwanki runs in your browser and can be installed to your home screen as a PWA. On a phone, reviews use a swipe-and-scroll feed; on desktop, you get a clean classic flashcard layout. Once your due cards have loaded, you can keep reviewing them offline. Importing decks, processing notes, and generating AI media need a connection."
        }
      }
    ]
  };

  const howTo = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    "name": "How to move your Anki decks to Schwanki with review history",
    "description": "Export an .apkg or .colpkg file from Anki Desktop, AnkiMobile, or AnkiDroid with scheduling and media included, then import it into Schwanki.",
    "tool": [{ "@type": "HowToTool", "name": "Anki Desktop, AnkiMobile, or AnkiDroid" }],
    "step": [
      {
        "@type": "HowToStep",
        "position": 1,
        "name": "Open the export menu in Anki",
        "text": "In Anki Desktop, AnkiMobile, or AnkiDroid, open the Export option for a deck or your whole collection."
      },
      {
        "@type": "HowToStep",
        "position": 2,
        "name": "Choose .apkg or .colpkg",
        "text": "Pick Anki Deck Package (.apkg) for selected decks or Anki Collection Package (.colpkg) for everything."
      },
      {
        "@type": "HowToStep",
        "position": 3,
        "name": "Include scheduling and media",
        "text": "Check Include scheduling information and Include media so review history, pictures, and audio come across."
      },
      {
        "@type": "HowToStep",
        "position": 4,
        "name": "Upload to Schwanki",
        "text": "Open Schwanki, choose Import, and upload the exported file. No AnkiWeb password is needed."
      },
      {
        "@type": "HowToStep",
        "position": 5,
        "name": "Set your new-card pace and review",
        "text": "Keep the default of 20 new cards per day or change it, then start reviewing with FSRS v5."
      }
    ]
  };

  const article = {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": "https://schwankiapp.com/anki-alternative#article",
    "headline": "The Anki Alternative Built for Language Learners: Keep Your Decks, Lose the Grind",
    "description": "Switch from Anki without starting over. Import .apkg/.colpkg with review history and FSRS v5 scheduling, then review in a swipeable mobile feed.",
    "datePublished": "2026-10-27",
    "dateModified": "2026-10-27",
    "author": { "@type": "Organization", "name": "Schwanki", "url": "https://schwankiapp.com/" },
    "publisher": { "@type": "Organization", "name": "Schwanki", "url": "https://schwankiapp.com/" },
    "mainEntityOfPage": "https://schwankiapp.com/anki-alternative",
    "about": { "@id": "https://schwankiapp.com/#app" }
  };

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Schwanki", "item": "https://schwankiapp.com/" },
      { "@type": "ListItem", "position": 2, "name": "Anki Alternative", "item": "https://schwankiapp.com/anki-alternative" }
    ]
  };

  return {
    "@context": "https://schema.org",
    "@graph": [softwareApp, faqPage, howTo, article, breadcrumb]
  };
}

export function exportGuideStructuredData() {
  const howTo = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    "name": "How to export Anki decks with scheduling and import them without losing progress",
    "description": "Step-by-step guide to exporting Anki decks from Anki Desktop, AnkiMobile, and AnkiDroid with scheduling information and media intact.",
    "tool": [{ "@type": "HowToTool", "name": "Anki 26.09.3 (Desktop) / AnkiMobile / AnkiDroid" }],
    "step": [
      {
        "@type": "HowToStep",
        "position": 1,
        "name": "Sync with AnkiWeb",
        "text": "Sync Anki on all your devices to ensure you have the latest reviews."
      },
      {
        "@type": "HowToStep",
        "position": 2,
        "name": "Open export menu",
        "text": "Go to File → Export in Anki Desktop."
      },
      {
        "@type": "HowToStep",
        "position": 3,
        "name": "Choose export format",
        "text": "Export format: Anki Deck Package (.apkg) or Anki Collection Package (.colpkg)."
      },
      {
        "@type": "HowToStep",
        "position": 4,
        "name": "Tick Include scheduling information and Include media",
        "text": "Check both boxes to ensure review history, pictures, and audio are included."
      },
      {
        "@type": "HowToStep",
        "position": 5,
        "name": "Save and import",
        "text": "Save the file, then select it in Schwanki's importer."
      }
    ]
  };

  const faqPage = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "Why did my Anki review history reset after importing an .apkg file?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "The file was most likely exported without \"Include scheduling information\" ticked. According to the Anki manual, when that option is off, Anki assumes you're sharing the deck and removes all scheduling information, including review history and marked and leech tags. The receiving app can only import what's in the file. Re-export from Anki with the box ticked, then import again."
        }
      },
      {
        "@type": "Question",
        "name": "Should I export .apkg or .colpkg to keep my progress?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Both can keep progress. An .apkg exports one deck and its subdecks, and only includes scheduling if you tick \"Include scheduling information.\" A .colpkg exports your whole collection and always includes scheduling. Tick \"Include media\" for either. Note that importing a .colpkg into Anki replaces your collection, while Schwanki lets you preview and choose decks from either file type."
        }
      },
      {
        "@type": "Question",
        "name": "What does \"Support older Anki versions\" do when exporting?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "It writes the package in the older, larger, slower legacy format instead of the newer compressed format current Anki uses. It doesn't change which data is included. Leave it unticked by default. If another app says it can't open or read your file, re-export with this option ticked and try again."
        }
      },
      {
        "@type": "Question",
        "name": "Will my FSRS stability and difficulty transfer to Schwanki?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes, if the file was exported with scheduling. Schwanki keeps each card's FSRS v5 scheduling state (stability, difficulty, retrievability, reps, due date, and last review), plus review history and suspended status. Before you import, Schwanki shows the decks in the file with studied and suspended card counts so you can confirm your progress is there."
        }
      },
      {
        "@type": "Question",
        "name": "Can I import my decks into Schwanki by logging into AnkiWeb?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "No. Schwanki doesn't ask for your AnkiWeb password, and direct AnkiWeb login isn't supported. Instead, sync AnkiWeb to Anki Desktop, AnkiMobile, or AnkiDroid, export an .apkg or .colpkg file with scheduling and media included, and select that file in Schwanki."
        }
      },
      {
        "@type": "Question",
        "name": "Why are my images and audio missing after importing an Anki deck?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "The deck was probably exported without \"Include media\" ticked, so the images and audio files weren't packed into it. Your review history can still be fine, since media and scheduling are separate options. Re-export from Anki with both \"Include media\" and \"Include scheduling information\" ticked, then import the new file."
        }
      }
    ]
  };

  const article = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    "@id": "https://schwankiapp.com/guides/export-anki-with-scheduling#article",
    "headline": "How to Export Anki Decks Without Losing Your Progress (Include Scheduling Information, Explained)",
    "description": "Progress reset after an .apkg import? Tick \"Include scheduling information\" in Anki's export. Step-by-step for Desktop, AnkiMobile & AnkiDroid.",
    "datePublished": "2026-10-27",
    "dateModified": "2026-10-27",
    "author": { "@type": "Organization", "name": "Schwanki", "url": "https://schwankiapp.com/" },
    "publisher": { "@type": "Organization", "name": "Schwanki", "url": "https://schwankiapp.com/" },
    "mainEntityOfPage": "https://schwankiapp.com/guides/export-anki-with-scheduling"
  };

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Schwanki", "item": "https://schwankiapp.com/" },
      { "@type": "ListItem", "position": 2, "name": "Guides", "item": "https://schwankiapp.com/anki-alternative" },
      { "@type": "ListItem", "position": 3, "name": "Export Anki With Scheduling", "item": "https://schwankiapp.com/guides/export-anki-with-scheduling" }
    ]
  };

  return {
    "@context": "https://schema.org",
    "@graph": [howTo, faqPage, article, breadcrumb]
  };
}

export function ankiMobileComparisonStructuredData() {
  const faqPage = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "Is AnkiMobile worth $24.99 in 2026?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "It depends on how you study. AnkiMobile costs $24.99 once on the US App Store, supports Family Sharing, syncs free through AnkiWeb and uses the same SM-2 and FSRS scheduling as desktop Anki. That makes it worth it if you build decks on a computer and want them unchanged on your iPhone. If you mostly review on your phone and want a swipe-style feed, compare a phone-first app like Schwanki first."
        }
      },
      {
        "@type": "Question",
        "name": "Is AnkiMobile dead?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "No. AnkiMobile is still in active development. Version 26.10, which has a redesigned interface, has been in TestFlight beta since September 22, 2026, and on October 27 the developer said final QA had started. The current public App Store version, 25.09, was released in September 2025. That long gap is why some users have asked whether the app was abandoned."
        }
      },
      {
        "@type": "Question",
        "name": "Can I use AnkiMobile and Schwanki at the same time?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes. Exporting a deck from Anki leaves your original collection untouched, so you can keep reviewing in AnkiMobile and try Schwanki side by side. Export an .apkg or .colpkg file with \"Include scheduling information\" and \"Include media\" ticked, then import it into Schwanki. Schwanki never asks for your AnkiWeb password, and you can start with a single deck."
        }
      },
      {
        "@type": "Question",
        "name": "Will my AnkiMobile review history transfer to Schwanki?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes, if you export with scheduling. Schwanki imports .apkg and .colpkg files from AnkiMobile, Anki Desktop and AnkiDroid. It keeps cards, scheduling state, review history, suspended status, pictures and audio when \"Include scheduling information\" and \"Include media\" are ticked, then schedules with FSRS v5. A file exported without scheduling arrives as new cards, because no app can restore history that isn't in the file."
        }
      },
      {
        "@type": "Question",
        "name": "Is Schwanki a native iPhone app?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "No. Schwanki runs in your browser and installs to your iPhone home screen as a progressive web app (PWA). It isn't in the App Store. On a phone it shows your due cards as a swipe-and-scroll feed, and the queue ends when your due cards are done. You can review loaded due cards offline. Imports, note processing and AI features need a connection."
        }
      },
      {
        "@type": "Question",
        "name": "When should I stay with Anki and AnkiMobile instead of switching?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Stay with Anki if you rely on add-ons or AnkiConnect, study math- or LaTeX-heavy material, use complex custom note types, or want a native app with full manual control over the scheduler. AnkiMobile doesn't run add-ons, and note types must be changed on the computer, but it reviews the decks you build there with the same scheduling as desktop Anki."
        }
      }
    ]
  };

  const article = {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": "https://schwankiapp.com/vs/ankimobile#article",
    "headline": "Schwanki vs AnkiMobile (2026): Is AnkiMobile Still Worth $24.99?",
    "description": "Is AnkiMobile worth $24.99 in 2026? A fair look at the 26.10 beta, and when Schwanki's swipe-feed review fits phone-first language learners better.",
    "datePublished": "2026-10-29",
    "dateModified": "2026-10-29",
    "author": { "@type": "Organization", "name": "Schwanki", "url": "https://schwankiapp.com/" },
    "publisher": { "@type": "Organization", "name": "Schwanki", "url": "https://schwankiapp.com/" },
    "mainEntityOfPage": "https://schwankiapp.com/vs/ankimobile",
    "about": [
      { "@type": "Thing", "name": "AnkiMobile" },
      { "@type": "Thing", "name": "Schwanki" }
    ]
  };

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Schwanki", "item": "https://schwankiapp.com/" },
      { "@type": "ListItem", "position": 2, "name": "Schwanki vs AnkiMobile", "item": "https://schwankiapp.com/vs/ankimobile" }
    ]
  };

  return {
    "@context": "https://schema.org",
    "@graph": [faqPage, article, breadcrumb]
  };
}

/** Mirrors CREDIT_PACKS and STARTER_CREDITS in @schwanki/mnemonic; seo.test.ts fails if they drift. */
export const SEO_CREDIT_PACKS = [
  { name: "Mini", credits: 20, price: "1" },
  { name: "Starter", credits: 100, price: "5" },
  { name: "Plus", credits: 500, price: "20" },
  { name: "Pro", credits: 1500, price: "50" },
];
export const SEO_STARTER_CREDITS = 10;

export function pricingStructuredData() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": "https://schwankiapp.com/pricing#webpage",
        "url": "https://schwankiapp.com/pricing",
        "name": "Schwanki pricing",
        "isPartOf": { "@id": "https://schwankiapp.com/#website" },
        "about": { "@id": "https://schwankiapp.com/#app" }
      },
      {
        "@type": "Product",
        "name": "Schwanki AI credits",
        "description": "Prepaid credits for AI pictures and pronunciation audio on flashcards. One credit covers a card's picture and audio. One-time payment, no subscription.",
        "brand": { "@id": "https://schwankiapp.com/#organization" },
        "offers": SEO_CREDIT_PACKS.map((pack) => ({
          "@type": "Offer",
          "name": `${pack.name}: ${pack.credits} credits`,
          "price": pack.price,
          "priceCurrency": "USD",
          "url": "https://schwankiapp.com/pricing#packs",
          "availability": "https://schema.org/InStock"
        }))
      },
      {
        "@type": "FAQPage",
        "mainEntity": pricingFaq(SEO_STARTER_CREDITS).map(([name, text]) => ({
          "@type": "Question",
          name,
          "acceptedAnswer": { "@type": "Answer", text }
        }))
      }
    ]
  };
}
