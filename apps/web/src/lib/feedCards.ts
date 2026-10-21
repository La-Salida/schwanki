export interface FeedCard {
  id: string;
  language: string;
  lang: string;
  word: string;
  reading: string;
  partOfSpeech: string;
  meaning: string;
  /** Example sentence split around the target form so it can be highlighted. */
  sentence: [string, string, string];
  romanized?: [string, string, string];
  translation: [string, string, string];
  clip: string;
  poster: string;
  /** Native-language recording of sentence.join(""). */
  audio: string;
  /** CSS object-position that keeps the goose in frame when a wide clip fills the phone. */
  focus?: string;
}

// Each clip was generated with Fal from the goose mascot, acting out its sentence.
// Sentence recordings use ElevenLabs native-language voices and match sentence.join("").
export const FEED_CARDS: FeedCard[] = [
  {
    id: "zh", language: "Chinese", lang: "zh", word: "偷", reading: "tōu", partOfSpeech: "verb", meaning: "to steal",
    sentence: ["那只鹅", "偷", "了我的作业。"],
    romanized: ["Nà zhī é ", "tōu", " le wǒ de zuòyè."],
    translation: ["That goose ", "stole", " my homework."],
    clip: "/demo/goose-steals-homework.mp4", poster: "/demo/goose-steals-homework.jpg", focus: "62% center",
    audio: "/demo/sentence-zh.mp3",
  },
  {
    id: "ja", language: "Japanese", lang: "ja", word: "逃げる", reading: "にげる · nigeru", partOfSpeech: "verb", meaning: "to run away",
    sentence: ["ガチョウが私のおにぎりを持って", "逃げた", "。"],
    romanized: ["Gachō ga watashi no onigiri o motte ", "nigeta", "."],
    translation: ["The goose ", "ran off", " with my onigiri."],
    clip: "/demo/feed-ja.mp4", poster: "/demo/feed-ja.jpg",
    audio: "/demo/sentence-ja.mp3",
  },
  {
    id: "es", language: "Spanish (Mexico)", lang: "es-MX", word: "la chamba", reading: "CHAHM-bah", partOfSpeech: "noun · Mexican slang", meaning: "work, a job",
    sentence: ["El ganso no quiere ir a la ", "chamba", " hoy."],
    translation: ["The goose doesn't want to go to ", "work", " today."],
    clip: "/demo/feed-es.mp4", poster: "/demo/feed-es.jpg",
    audio: "/demo/sentence-es.mp3",
  },
  {
    id: "ru", language: "Russian", lang: "ru", word: "съесть", reading: "s’yest’", partOfSpeech: "verb · perfective", meaning: "to eat up",
    sentence: ["Гусь ", "съел", " мой бутерброд."],
    romanized: ["Gus’ ", "s’yel", " moy buterbrod."],
    translation: ["The goose ", "ate", " my sandwich."],
    clip: "/demo/feed-ru.mp4", poster: "/demo/feed-ru.jpg",
    audio: "/demo/sentence-ru.mp3",
  },
];
