import { expect, it } from 'vitest';
import { exportRecordingManifest } from './export';
import { DEVELOPMENT_LIMITS, sha256, type Fragment, type RecordingManifest } from './manifest';

async function fragment(channel: Fragment['channel'], part: number, sequence: number, text: string): Promise<Fragment> {
  const blob = new Blob([text]);
  return { recordingId: 'class1', channel, part, sequence, blob, bytes: blob.size, checksum: await sha256(blob),
    startMs: part === 0 ? sequence * 2500 : 10000, durationMs: part === 0 ? 2500 : 5000, mimeType: 'audio/webm;codecs=opus', acknowledged: false };
}
function manifest(fragments: Fragment[], state: RecordingManifest['state'] = 'saved'): RecordingManifest {
  return { id: 'class1', createdAt: '2026-10-06T00:00:00Z', state, tabId: 123, durationMs: 15000,
    bytes: fragments.reduce((bytes, fragment) => bytes + fragment.bytes, 0), nextPart: 2,
    gaps: [{ startMs: 5000, endMs: 10000 }], limits: DEVELOPMENT_LIMITS, warning: null };
}

it('exports per-part checksums, ordered fragments and explicit pause gaps without audio or browser IDs', async () => {
  const fragments = [await fragment('tab', 0, 1, 'tail'), await fragment('microphone', 0, 0, 'mic'),
    await fragment('tab', 1, 0, 'new header'), await fragment('tab', 0, 0, 'header')];
  const exported = await exportRecordingManifest(manifest(fragments), fragments);
  expect(exported.recording.gaps).toEqual([{ startMs: 5000, endMs: 10000 }]);
  expect(exported.parts).toHaveLength(3);
  const first = exported.parts.find(part => part.channel === 'tab' && part.part === 0)!;
  expect(first.checksum).toBe(await sha256(new Blob(['header', 'tail'])));
  expect(first.fragments.map(fragment => fragment.sequence)).toEqual([0, 1]);
  expect(JSON.stringify(exported)).not.toContain('blob');
  expect(exported.recording).not.toHaveProperty('tabId');
});

it('rejects damaged audio even when its stored byte count is unchanged', async () => {
  const original = await fragment('tab', 0, 0, 'original');
  await expect(exportRecordingManifest(manifest([original]), [{ ...original, blob: new Blob(['modified']) }])).rejects.toThrow('checksum');
});

it('rejects incomplete or foreign recording fragments', async () => {
  const original = await fragment('tab', 0, 0, 'audio');
  await expect(exportRecordingManifest(manifest([original]), [{ ...original, recordingId: 'another' }])).rejects.toThrow('another recording');
  await expect(exportRecordingManifest(manifest([original]), [{ ...original, sequence: 1 }])).rejects.toThrow('Missing fragment');
});

it('rejects manifest byte mismatches and a recording that is still active', async () => {
  const original = await fragment('tab', 0, 0, 'audio');
  await expect(exportRecordingManifest({ ...manifest([original]), bytes: 100 }, [original])).rejects.toThrow('byte count');
  await expect(exportRecordingManifest(manifest([original], 'recording'), [original])).rejects.toThrow('Stop recording');
});
