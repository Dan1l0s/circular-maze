import { createScene, DURATION, PREVIEW_TIME, PALETTES } from './src/scene.js';

const canvas = document.getElementById('canvas');
const play = document.getElementById('play');
const restart = document.getElementById('restart');
const theme = document.getElementById('theme');
const timeline = document.getElementById('timeline');
const time = document.getElementById('time');
const status = document.getElementById('status');
const darkMode = matchMedia('(prefers-color-scheme: dark)');
const scene = createScene();
let seconds = PREVIEW_TIME, poster = true, playing = false;
let origin = 0, frame = 0, lastDraw = 0;

function draw() {
  const rect = canvas.getBoundingClientRect();
  const ratio = Math.min(devicePixelRatio || 1, 2);
  const width = Math.round(rect.width * ratio), height = Math.round(rect.height * ratio);
  if (!width || !height) return;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const dark = theme.value === 'dark' || theme.value === 'system' && darkMode.matches;
  scene.draw(canvas.getContext('2d'), width, height, seconds, PALETTES[dark ? 'dark' : 'light']);
  timeline.value = seconds;
  timeline.setAttribute('aria-valuetext', `${seconds.toFixed(1)} seconds of ${DURATION}`);
  time.textContent = `${seconds.toFixed(1)} / ${DURATION} s`;
  status.textContent = scene.describe(seconds);
}

function pause() {
  if (playing) seconds = Math.min(DURATION, (performance.now() - origin) / 1000);
  playing = false;
  cancelAnimationFrame(frame);
  play.textContent = seconds >= DURATION ? 'Replay' : 'Play';
  play.setAttribute('aria-pressed', 'false');
}

function tick(now) {
  if (!playing) return;
  seconds = Math.min(DURATION, (now - origin) / 1000);
  if (now - lastDraw >= 1000 / 30 || seconds === DURATION) {
    draw();
    lastDraw = now;
  }
  if (seconds === DURATION) pause();
  else frame = requestAnimationFrame(tick);
}

play.addEventListener('click', () => {
  if (playing) {
    pause();
    draw();
    return;
  }
  if (poster || seconds >= DURATION) seconds = 0;
  poster = false;
  playing = true;
  origin = performance.now() - seconds * 1000;
  play.textContent = 'Pause';
  play.setAttribute('aria-pressed', 'true');
  frame = requestAnimationFrame(tick);
});

restart.addEventListener('click', () => {
  pause();
  poster = false;
  seconds = 0;
  play.textContent = 'Play';
  draw();
});

timeline.addEventListener('input', () => {
  pause();
  poster = false;
  seconds = Number(timeline.value);
  play.textContent = seconds >= DURATION ? 'Replay' : 'Play';
  draw();
});

theme.addEventListener('change', () => {
  document.documentElement.style.colorScheme = theme.value === 'system' ? 'light dark' : theme.value;
  draw();
});
darkMode.addEventListener('change', draw);
const resize = new ResizeObserver(draw);
resize.observe(canvas);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pause();
});
window.addEventListener('pagehide', pause);
window.addEventListener('pageshow', draw);
draw();
