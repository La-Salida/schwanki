import { expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { powerpointText } from './materialText';

const slide = (text: string) => `<p:sld xmlns:p="p" xmlns:a="a"><p:cSld><a:p><a:r><a:t>${text}</a:t></a:r><a:r><a:t> &amp; more</a:t></a:r><a:br/><a:r><a:t>你好</a:t></a:r></a:p><a:p><a:r><a:t>Next paragraph</a:t></a:r></a:p></p:cSld></p:sld>`;
function presentation(overrides: Record<string, string> = {}) {
  return zipSync(Object.fromEntries(Object.entries({
    'ppt/presentation.xml': '<p:presentation xmlns:p="p" xmlns:r="r"><p:sldIdLst><p:sldId id="1" r:id="second"/><p:sldId id="2" r:id="first"/></p:sldIdLst></p:presentation>',
    'ppt/_rels/presentation.xml.rels': '<Relationships><Relationship Id="first" Target="slides/slide1.xml"/><Relationship Id="second" Target="slides/slide2.xml"/></Relationships>',
    'ppt/slides/slide1.xml': slide('One'), 'ppt/slides/slide2.xml': slide('Two'), ...overrides,
  }).map(([path, text]) => [path, strToU8(text)])));
}
it('reads actual slide order, preserves runs/paragraphs, decodes entities and Unicode', () => {
  expect(powerpointText(presentation())).toBe('Two & more\n你好\nNext paragraph\n\nOne & more\n你好\nNext paragraph');
});
it('rejects external, missing and traversal slide relationships', () => {
  for (const target of ['https://example.com/ppt/slides/slide2.xml', '../../secret.xml', 'slides/missing.xml']) {
    expect(() => powerpointText(presentation({ 'ppt/_rels/presentation.xml.rels': `<Relationships><Relationship Id="second" Target="${target}"/></Relationships>` }))).toThrow();
  }
});
it('rejects XML entities, corrupt XML and image-only slides with an actionable fallback', () => {
  expect(() => powerpointText(presentation({ 'ppt/slides/slide2.xml': '<!DOCTYPE p [<!ENTITY x "bad">]><p>&x;</p>' }))).toThrow('damaged');
  expect(() => powerpointText(presentation({ 'ppt/slides/slide2.xml': '<broken>' }))).toThrow('damaged');
  expect(() => powerpointText(presentation({ 'ppt/slides/slide1.xml': '<sld/>', 'ppt/slides/slide2.xml': '<sld/>' }))).toThrow('screenshots');
});
it('checks inflated XML size before decompressing a highly compressed file', () => {
  expect(() => powerpointText(presentation({ 'ppt/slides/slide2.xml': ' '.repeat(4 * 1024 * 1024 + 1) }))).toThrow('too much');
});
