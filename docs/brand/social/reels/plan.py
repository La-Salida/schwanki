"""Timing planner for a vocab reel.

Usage: python3 plan.py specs/<id>.json durations.json > plan.json

durations.json maps "<tts>.<line>" to [file_seconds, speech_start, speech_end]
(measured with decodeAudioData; speech_* found with a 0.02 RMS gate).
Prints sticker slices [name, out_start, dur, clip_source_in], the audio parts and the video slots
for timeline_create. URLs are filled in later from assets.json.
"""
import json, sys

LEAD = 0.45        # room tone before the first line; hook is on screen from frame 0
MIN_SUB = 1.25     # each subtitle stays up at least this long
GAP = 0.40         # minimum pause after a line
PAD_IN, PAD_OUT = 0.05, 0.10
PAYOFF_MIN = 2.6   # payoff card hold
ENDCARD = 3.125
ROOM_LEN = 10.14   # shared room-tone wav (detached from a near-silent clip)

def plan(spec, durs, clip_len):
    p = spec['plan']; key = p['tts']
    t = LEAD
    audio = [('room', 0.0, LEAD)]
    slices = []   # (sticker, start, dur)
    names = list(spec['stickers'])
    for i, line in enumerate(p['lines']):
        _, s0, s1 = durs[f'{key}.{line}']
        src = max(0.0, s0 - PAD_IN); d = (s1 + PAD_OUT) - src
        if p['kind'] == 'word':
            slot = d + (0.5 if i == 0 else 0.3)
        else:
            slot = max(d + GAP, MIN_SUB)
        audio.append(('tts:' + line, round(src, 3), round(d, 3)))
        audio.append(('room', round(t + d, 3), round(slot - d, 3)))
        slices.append([names[i + (1 if p['kind'] == 'word' else 0)], round(t, 3), round(slot, 3)])
        t += slot
    if p['kind'] == 'word':
        slices.insert(0, [names[0], 0.0, LEAD])
        # merge: hook-only covers the lead; definition card holds to the end
        end = max(clip_len, t + 1.2)
        slices[-1][2] = round(end - slices[-1][1], 3)
    else:
        slices[0][2] = round(slices[0][1] + slices[0][2], 3); slices[0][1] = 0.0
        end = max(clip_len, t + PAYOFF_MIN)
        slices.append([names[-1], round(t, 3), round(end - t, 3)])
    # Each slice reads the clip at its own time, except a slice that would run past the clip:
    # it starts earlier in the clip instead (a jump cut on the payoff reads fine; a freeze does not).
    for sl in slices:
        sl.append(sl[1] if sl[1] + sl[2] <= clip_len else round(max(0.0, clip_len - sl[2] - 0.02), 3))
    tail = round(end - t, 3)
    if tail > 0:
        audio.append(('room', round(max(0.0, min(t, ROOM_LEN - tail - 0.05)), 3), tail))
    audio.append(('endcard', 0.0, ENDCARD))
    total = round(sum(a[2] for a in audio), 3)
    return {'id': spec['id'], 'clip_len': clip_len, 'video_end': round(end, 3), 'total': total,
            'slices': slices, 'audio': audio}

if __name__ == '__main__':
    spec = json.load(open(sys.argv[1])); durs = json.load(open(sys.argv[2]))
    clip_len = float(sys.argv[3]) if len(sys.argv) > 3 else 10.12
    print(json.dumps(plan(spec, durs, clip_len), ensure_ascii=False))
