import type { DueCard } from '@schwanki/core';
export const DEMO_CARDS = [
  { id: 'demo-es', language: 'es', front: 'siesta', back: 'An afternoon nap.', exampleSentence: 'La siesta me salvó el día.', translation: 'The nap saved my day.', image: require('../../assets/demo/siesta.png'), audio: null },
  { id: 'demo-zh', language: 'zh', front: '偷', reading: 'tōu', back: 'To steal.', exampleSentence: '那只鹅偷了我的作业。', translation: 'That goose stole my homework.', image: require('../../assets/demo/goose-steals-homework.jpg'), audio: require('../../assets/demo/sentence-zh.mp3') },
  { id: 'demo-ja', language: 'ja', front: '逃げる', reading: 'にげる · nigeru', back: 'To run away.', exampleSentence: 'ガチョウが私のおにぎりを持って逃げた。', translation: 'The goose ran off with my onigiri.', image: require('../../assets/demo/feed-ja.jpg'), audio: require('../../assets/demo/sentence-ja.mp3') },
];
export const demoDue: DueCard[] = DEMO_CARDS.map(c => ({ card: { id: c.id, userId: 'sample', sourceId: null, language: c.language, front: c.front, back: c.back, exampleSentence: c.exampleSentence, ...('reading' in c ? { reading: c.reading } : {}), createdAt: '2026-10-29T00:00:00Z' }, state: null }));
