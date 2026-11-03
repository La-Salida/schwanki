import { strFromU8, unzipSync } from 'fflate';
import { XMLParser, XMLValidator } from 'fast-xml-parser';

export const MATERIAL_LIMIT = 10 * 1024 * 1024;
const SLIDE = /^ppt\/slides\/slide\d+\.xml$/;
type XmlNode = Record<string, unknown>;
function nodes(value: unknown, localName: string): XmlNode[] {
  if (Array.isArray(value)) return value.flatMap(v => nodes(v, localName));
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, child]) => {
    if (key.split(':').pop() === localName) return (Array.isArray(child) ? child : [child]) as XmlNode[];
    return nodes(child, localName);
  });
}
function textRuns(value: unknown): string {
  if (Array.isArray(value)) return value.map(textRuns).join('');
  if (!value || typeof value !== 'object') return '';
  return Object.entries(value).map(([key, child]) => {
    const local = key.split(':').pop();
    if (local === 't') return nodesText(child);
    if (local === 'br') return '\n';
    return textRuns(child);
  }).join('');
}
function nodesText(v: unknown): string {
  if (Array.isArray(v)) return v.map(nodesText).join('');
  if (v && typeof v === 'object') return Object.entries(v).filter(([key]) => key === '#text').map(([, child]) => String(child)).join('');
  return v == null ? '' : String(v);
}
function paragraphs(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(paragraphs);
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, child]) => key.split(':').pop() === 'p' ? [textRuns(child)] : paragraphs(child));
}

/** Hermes has no DOMParser. Read slide XML in presentation order, without media. */
export function powerpointText(bytes: Uint8Array): string {
  if (bytes.byteLength > 100 * 1024 * 1024) throw new Error('PowerPoint files must be under 100 MB.');
  let count = 0, xmlBytes = 0;
  const files = unzipSync(bytes, { filter: ({ name, originalSize }) => {
    if (++count > 10_000) throw new Error('This presentation contains too many files.');
    if (name !== 'ppt/presentation.xml' && name !== 'ppt/_rels/presentation.xml.rels' && !SLIDE.test(name)) return false;
    xmlBytes += originalSize;
    if (originalSize > 4 * 1024 * 1024 || xmlBytes > 32 * 1024 * 1024) throw new Error('This presentation contains too much slide text.');
    return true;
  } });
  function xml(path: string, ordered = false): unknown {
    if (!files[path]) throw new Error('A slide or its ordering information is missing.');
    const text = strFromU8(files[path]);
    if (/<!DOCTYPE|<!ENTITY/i.test(text) || XMLValidator.validate(text) !== true) throw new Error('The slide XML is damaged or unsupported.');
    return new XMLParser({ ignoreAttributes: false, preserveOrder: ordered, parseTagValue: false, trimValues: false, processEntities: true }).parse(text);
  }
  const relationships = new Map(nodes(xml('ppt/_rels/presentation.xml.rels'), 'Relationship')
    .filter(n => n['@_TargetMode'] !== 'External').map(n => [String(n['@_Id']), String(n['@_Target'])]));
  const slides = nodes(xml('ppt/presentation.xml'), 'sldId');
  if (!slides.length) throw new Error('The presentation has no slides.');
  const text = slides.map(slide => {
    const id = Object.entries(slide).find(([key]) => /^@_.+:id$/.test(key))?.[1];
    const target = relationships.get(String(id));
    if (!target) throw new Error('A slide relationship is missing.');
    const url = new URL(target, 'https://presentation.local/ppt/');
    const path = url.pathname.slice(1);
    if (url.origin !== 'https://presentation.local' || !SLIDE.test(path)) throw new Error('A slide relationship is invalid.');
    return paragraphs(xml(path, true)).map(s => s.trim()).filter(Boolean).join('\n');
  }).filter(Boolean).join('\n\n');
  if (!text.trim()) throw new Error('No readable slide text. Choose screenshots of these slides instead.');
  if (new TextEncoder().encode(text).byteLength > MATERIAL_LIMIT) throw new Error('Split this presentation into smaller files.');
  return text;
}
