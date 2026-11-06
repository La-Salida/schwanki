"""Turns a plan (plan.py) plus asset URLs into a Sume timeline_create payload.

Usage: python3 payload.py plan.json urls.json
urls.json: {"room": url, "endcard_audio": url, "endcard_video": url, "music": url,
            "tts": {"a1": url, ...}, "slices": {"s1": composed_clip_url, ...}}
"""
import json, sys

def build(plan, u):
    parts = []
    for kind, src, dur in plan['audio']:
        url = u['room'] if kind == 'room' else u['endcard_audio'] if kind == 'endcard' else u['tts'][kind[4:]]
        if dur <= 0.005:
            continue
        parts.append({'url': url, 'source_in': src, 'duration': dur})
    total = round(sum(p['duration'] for p in parts), 3)
    video = [{'source_url': u['slices'][name], 'start': start, 'duration': dur}
             for name, start, dur, _src in plan['slices']]
    video.append({'source_url': u['endcard_video'], 'start': plan['video_end'], 'duration': round(total - plan['video_end'], 3)})
    payload = {'audio': {'parts': parts, 'duration_seconds': total}, 'video': video,
               'output': {'width': 1080, 'height': 1920}}
    if u.get('music'):
        payload['soundtrack'] = {'url': u['music'], 'duck_db': 12, 'fade_out_seconds': 1.5}
    return payload

if __name__ == '__main__':
    print(json.dumps(build(json.load(open(sys.argv[1])), json.load(open(sys.argv[2])))))
