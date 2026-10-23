import { mkdir, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { createCanvas } from '@napi-rs/canvas';
import gifenc from 'gifenc';
import { createScene, DURATION, PREVIEW_TIME, PALETTES } from '../src/scene.js';

const { GIFEncoder, quantize, applyPalette } = gifenc;
const { values } = parseArgs({ options: {
  theme: { type: 'string', default: 'both' },
  width: { type: 'string', default: '600' },
  fps: { type: 'string', default: '20' }
} });
const width = Number(values.width);
const fps = Number(values.fps);
if (!Number.isInteger(width) || width < 320 || width > 1600 || !Number.isInteger(fps) || fps < 5 || fps > 50) {
  throw new Error('Use width 320–1600 and fps 5–50.');
}
if (!['both', 'dark', 'light'].includes(values.theme)) throw new Error('Theme: both, dark or light.');

const height = Math.round(width * 440 / 700);
const canvas = createCanvas(width, height);
const context = canvas.getContext('2d');
const scene = createScene();
const output = new URL('../assets/', import.meta.url);
await mkdir(output, { recursive: true });

for (const theme of values.theme === 'both' ? ['dark', 'light'] : [values.theme]) {
  const palette = PALETTES[theme];
  const samples = [];
  for (const seconds of [0, 5, 10, 15, PREVIEW_TIME, DURATION]) {
    scene.draw(context, width, height, seconds, palette);
    const rgba = context.getImageData(0, 0, width, height).data;
    for (let i = 0; i < rgba.length; i += 16) samples.push(...rgba.subarray(i, i + 4));
  }
  const colors = quantize(new Uint8Array(samples), 63);
  const gif = GIFEncoder();
  let previous;

  function frame(seconds, delay) {
    scene.draw(context, width, height, seconds, palette);
    const rgba = context.getImageData(0, 0, width, height).data;
    const current = applyPalette(rgba, colors).map(index => index + 1);
    const pixels = current.slice();
    // Unchanged pixels reuse the previous frame.
    if (previous) {
      for (let i = 0; i < pixels.length; i++) {
        if (pixels[i] === previous[i]) pixels[i] = 0;
      }
    }
    gif.writeFrame(pixels, width, height, {
      ...(!previous ? { palette: [[0, 0, 0], ...colors] } : {}),
      transparent: true, transparentIndex: 0, delay, repeat: 0, dispose: 1
    });
    previous = current;
  }

  frame(PREVIEW_TIME, 800);
  for (let i = 0; i <= DURATION * fps; i++) {
    const delay = (Math.round((i + 1) * 100 / fps) - Math.round(i * 100 / fps)) * 10;
    frame(i / fps, i === DURATION * fps ? 1600 : delay);
  }
  gif.finish();
  const bytes = gif.bytes();
  await writeFile(new URL(`preview-${theme}.gif`, output), bytes);
  console.log(`${theme}: ${(bytes.length / 1024 / 1024).toFixed(2)} MiB`);
}
