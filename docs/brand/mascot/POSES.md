# Goose poses to generate

The web app poses the single cutout with motion (`apps/web/src/components/Goose.tsx`: celebrate, judge, sleep). Real drawn poses would replace it one for one: drop PNGs with transparent backgrounds into `apps/web/public/` as `goose-celebrate.png`, `goose-judge.png`, `goose-sleep.png` and point the component at them.

Reference image: `chaos-goose-cutout-1024.png`. Use an image-to-image model that keeps characters consistent (Nano Banana 2.1 or GPT Image 2.5 edit), 1:1, then remove the background.

Shared prefix for every prompt:

> Redraw this exact cartoon goose mascot (white goose, black leather jacket with yellow smiley pin, orange beak and feet, bold sticker style with thick white outline) in a new pose. Keep identical art style, colors, proportions and line weight. Plain pure white background, full body visible, nothing cropped, no text or letters anywhere.

- **Celebrate** (finish card, milestone card): Both wings thrown up high, eyes squeezed shut with joy, wide open-beak grin, the purple VOCAB notebook flying up out of one wing, a few blank flashcards tumbling in the air.
- **Judge** (Forgot): Standing with wings folded like crossed arms, one eyebrow raised, flat deadpan half-lidded eyes, beak in a tight smug line, head tilted slightly, the purple VOCAB notebook tucked under one wing. Smug and judging, not angry.
- **Sleep** (caught up, nothing due): Curled up sitting on a small pile of blank white flashcards, eyes closed in peaceful arcs, head resting on the closed purple VOCAB notebook like a pillow, three small blue puffs floating above drawn as shapes, not letters.
