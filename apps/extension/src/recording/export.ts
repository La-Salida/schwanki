import { orderedParts, sha256, type Fragment, type RecordingManifest } from './manifest';

/** Local recovery metadata. Audio is downloaded separately; no session or tab URL is included. */
export async function exportRecordingManifest(manifest: RecordingManifest, fragments: Fragment[]) {
  if (!['saved', 'interrupted'].includes(manifest.state)) throw new Error('Stop recording before exporting');
  if (fragments.some(fragment => fragment.recordingId !== manifest.id)) throw new Error('Audio belongs to another recording');
  const groups = orderedParts(fragments);
  const parts = [];
  let bytes = 0;
  for (const group of groups) {
    const first = group[0]!;
    for (const fragment of group) {
      if (fragment.bytes !== fragment.blob.size || await sha256(fragment.blob) !== fragment.checksum) {
        throw new Error('Saved audio failed its checksum check. Keep the local copy for recovery.');
      }
    }
    const audio = new Blob(group.map(fragment => fragment.blob), { type: first.mimeType });
    bytes += audio.size;
    parts.push({
      filename: `${manifest.id}-${first.channel}-${first.part}.webm`,
      channel: first.channel, part: first.part, mimeType: first.mimeType,
      bytes: audio.size, checksum: await sha256(audio),
      fragments: group.map(({ sequence, startMs, durationMs, bytes, checksum }) => ({ sequence, startMs, durationMs, bytes, checksum })),
    });
  }
  if (bytes !== manifest.bytes) throw new Error('Saved audio byte count does not match the manifest. Keep the local copy for recovery.');
  const { tabId: _tabId, ...recording } = manifest;
  return { version: 1, recording, parts };
}
