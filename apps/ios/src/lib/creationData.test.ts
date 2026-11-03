import { expect, it } from 'vitest';
import { creationLanguages, explicitPairs, starterWords } from './creationData';

it('provides ten nonempty, unique study cards for every offered language', () => {
  for (const [language] of creationLanguages) {
    const words = starterWords(language);
    expect(words).toHaveLength(10);
    expect(new Set(words.map(w => w.front)).size).toBe(10);
    expect(words.every(w => w.front.trim() && w.back.trim())).toBe(true);
    words[0]!.front = 'changed';
    expect(starterWords(language)[0]!.front).not.toBe('changed');
  }
});
it('keeps explicit Unicode word pairs free without splitting words on hyphens', () => {
  expect(explicitPairs('你好\thello\n\nสวัสดี — hello\nau-revoir - goodbye\nmerci = thank you')).toEqual([
    { front: '你好', back: 'hello' }, { front: 'สวัสดี', back: 'hello' },
    { front: 'au-revoir', back: 'goodbye' }, { front: 'merci', back: 'thank you' },
  ]);
});
it('never silently loses unpaired lines from pasted notes', () => {
  expect(explicitPairs('hola — hello\nnew words from class')).toBeNull();
  expect(explicitPairs('hola\n')).toBeNull();
  expect(explicitPairs('')).toBeNull();
  expect(explicitPairs('— hello')).toBeNull();
  expect(explicitPairs('a — b\n'.repeat(201))).toBeNull();
  expect(explicitPairs('Word\tMeaning\nhola\thello')).toBeNull();
  expect(explicitPairs('你好\tnǐ hǎo\thello')).toBeNull();
});
