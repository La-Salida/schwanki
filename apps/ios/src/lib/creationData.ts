export const creationLanguages = [
  ['es', 'Spanish'], ['zh', 'Chinese'], ['th', 'Thai'], ['fr', 'French'],
  ['de', 'German'], ['ja', 'Japanese'], ['ko', 'Korean'], ['en', 'English'],
] as const;
export type CreationLanguage = typeof creationLanguages[number][0];
export interface WordPair { front: string; back: string; reading?: string }

// Small, bundled starter sets. These are real study cards, with no generation charge.
// Meanings are in English; the English set uses short English definitions.
const rows: Record<CreationLanguage, Array<[string, string, string?]>> = {
  es: [['hola', 'hello'], ['gracias', 'thank you'], ['por favor', 'please'], ['sí', 'yes'], ['no', 'no'], ['agua', 'water'], ['comida', 'food'], ['café', 'coffee'], ['hoy', 'today'], ['mañana', 'tomorrow']],
  zh: [['你好', 'hello', 'nǐ hǎo'], ['谢谢', 'thank you', 'xièxie'], ['请', 'please', 'qǐng'], ['水', 'water', 'shuǐ'], ['饭', 'rice; a meal', 'fàn'], ['咖啡', 'coffee', 'kāfēi'], ['今天', 'today', 'jīntiān'], ['明天', 'tomorrow', 'míngtiān'], ['朋友', 'friend', 'péngyou'], ['再见', 'goodbye', 'zàijiàn']],
  th: [['สวัสดี', 'hello', 'sà-wàt-dii'], ['ขอบคุณ', 'thank you', 'khàawp-khun'], ['น้ำ', 'water', 'náam'], ['ข้าว', 'rice; a meal', 'khâao'], ['กาแฟ', 'coffee', 'gaa-fae'], ['วันนี้', 'today', 'wan-níi'], ['พรุ่งนี้', 'tomorrow', 'phrûng-níi'], ['เพื่อน', 'friend', 'phûean'], ['อร่อย', 'delicious', 'à-ràwy'], ['เท่าไหร่', 'how much?', 'thâo-rài']],
  fr: [['bonjour', 'hello; good morning'], ['merci', 'thank you'], ['s’il vous plaît', 'please (polite)'], ['oui', 'yes'], ['non', 'no'], ['l’eau', 'water'], ['le repas', 'meal'], ['le café', 'coffee'], ['aujourd’hui', 'today'], ['demain', 'tomorrow']],
  de: [['hallo', 'hello'], ['danke', 'thank you'], ['bitte', 'please; you’re welcome'], ['ja', 'yes'], ['nein', 'no'], ['das Wasser', 'water'], ['das Essen', 'food; meal'], ['der Kaffee', 'coffee'], ['heute', 'today'], ['morgen', 'tomorrow']],
  ja: [['こんにちは', 'hello', 'konnichiwa'], ['ありがとう', 'thank you', 'arigatō'], ['お願いします', 'please (a request)', 'onegaishimasu'], ['はい', 'yes', 'hai'], ['いいえ', 'no', 'iie'], ['水', 'water', 'みず · mizu'], ['ご飯', 'rice; a meal', 'ごはん · gohan'], ['コーヒー', 'coffee', 'kōhī'], ['今日', 'today', 'きょう · kyō'], ['明日', 'tomorrow', 'あした · ashita']],
  ko: [['안녕하세요', 'hello (polite)', 'annyeonghaseyo'], ['감사합니다', 'thank you (polite)', 'gamsahamnida'], ['주세요', 'please give me', 'juseyo'], ['네', 'yes', 'ne'], ['아니요', 'no', 'aniyo'], ['물', 'water', 'mul'], ['밥', 'rice; a meal', 'bap'], ['커피', 'coffee', 'keopi'], ['오늘', 'today', 'oneul'], ['내일', 'tomorrow', 'naeil']],
  en: [['hello', 'a greeting'], ['thanks', 'an expression of gratitude'], ['please', 'a polite word used when asking'], ['water', 'a clear liquid you drink'], ['meal', 'food eaten at one time'], ['coffee', 'a drink made from roasted beans'], ['today', 'this day'], ['tomorrow', 'the day after today'], ['friend', 'a person you like and know well'], ['goodbye', 'said when leaving']],
};
export function starterWords(language: CreationLanguage): WordPair[] {
  return rows[language].map(([front, back, reading]) => ({ front, back, ...(reading ? { reading } : {}) }));
}

/** Only explicit pairs skip extraction. Never silently drop unstructured lines. */
export function explicitPairs(text: string): WordPair[] | null {
  const lines = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  if (!lines.length || lines.length > 200) return null;
  const words: WordPair[] = [];
  for (const line of lines) {
    const match = /^(.*?)\s*(?:\t|\s[—–-]\s|\s=\s)\s*(.+)$/.exec(line);
    if (!match?.[1]?.trim() || !match[2]?.trim()) return null;
    const front = match[1].trim(), back = match[2].trim();
    if (front.length > 200 || back.length > 1000) return null;
    words.push({ front, back });
  }
  return words;
}
