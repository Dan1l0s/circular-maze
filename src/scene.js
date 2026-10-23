import { buildMaze } from './maze.js';

export const DURATION = 24;
export const PREVIEW_TIME = 21.8;
export const PALETTES = {
  dark: { bg: '#0d1117', fg: '#e6edf3', muted: '#8b949e', accent: '#7bc9e8' },
  light: { bg: '#ffffff', fg: '#1f2328', muted: '#68727e', accent: '#267da4' }
};

const TAU = 2 * Math.PI;
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const length = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const polarPoint = (r, angle) => [r * Math.cos(angle), r * Math.sin(angle)];
let maze;

function line(ctx, points, project) {
  ctx.moveTo(...project(points[0]));
  for (let i = 1; i < points.length; i++) ctx.lineTo(...project(points[i]));
}

function cell(ctx, shape, project, scale) {
  const origin = project([0, 0]);
  ctx.beginPath();
  ctx.arc(...origin, shape.outer * scale, shape.a, shape.b);
  if (shape.inner) ctx.arc(...origin, shape.inner * scale, shape.b, shape.a, true);
  else ctx.lineTo(...origin);
  ctx.closePath();
  ctx.fill();
}

export function createScene() {
  const data = maze || (maze = buildMaze());
  const total = data.polyline.slice(1).reduce((sum, p, i) => sum + length(p, data.polyline[i]), 0);
  const frameAt = t => data.frames[Math.floor(clamp((t - .45) / 16.7) * (data.frames.length - 1))];

  return {
    describe(seconds) {
      const frame = frameAt(seconds);
      if (seconds < 17.15) {
        const visited = frame.settled.reduce((sum, side) => sum + side.reduce((a, b) => a + b, 0), 0);
        return `Bidirectional Dijkstra · ${visited} / ${data.points.length} cells`;
      }
      return `Shortest route · ${data.route.length - 1} steps`;
    },
    draw(ctx, width, height, seconds, palette) {
      const t = clamp(seconds, 0, DURATION), frame = frameAt(t), final = t >= 17.15;
      const unit = Math.max(.65, Math.min(width / 700, height / 440));
      const scale = Math.min(width * .45, height * .45);
      const project = p => [width / 2 + p[0] * scale, height / 2 + p[1] * scale];
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.fillStyle = palette.bg;
      ctx.fillRect(0, 0, width, height);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.setLineDash([]);

      for (let side = 0; side < 2; side++) {
        ctx.fillStyle = side ? palette.accent : palette.fg;
        ctx.globalAlpha = side ? .095 : .055;
        for (let i = 0; i < data.points.length; i++) {
          if (frame.settled[side][i]) cell(ctx, data.cells[i], project, scale);
        }
      }
      ctx.strokeStyle = palette.fg;
      ctx.globalAlpha = .48;
      ctx.lineWidth = Math.max(.7, 1.05 * unit);
      ctx.beginPath();
      for (const wall of data.walls) {
        if (wall.type === 'arc') {
          const center = project([0, 0]);
          ctx.moveTo(...project(polarPoint(wall.r, wall.a)));
          ctx.arc(...center, wall.r * scale, wall.a, wall.b);
        } else {
          ctx.moveTo(...project(wall.a));
          ctx.lineTo(...project(wall.b));
        }
      }
      ctx.stroke();

      for (let side = 0; side < 2; side++) {
        ctx.strokeStyle = side ? palette.accent : palette.fg;
        ctx.globalAlpha = final ? .35 : .60;
        ctx.lineWidth = 1.25 * unit;
        ctx.beginPath();
        for (let i = 0; i < data.points.length; i++) {
          const edge = frame.parentEdge[side][i];
          if (frame.settled[side][i] && edge >= 0) line(ctx, data.edges[edge].line, project);
        }
        ctx.stroke();
      }

      if (final) {
        ctx.strokeStyle = palette.accent;
        ctx.globalAlpha = .25;
        ctx.lineWidth = 2.1 * unit;
        ctx.beginPath();
        line(ctx, data.polyline, project);
        ctx.stroke();
        const progress = clamp((t - 17.15) / 5.4) * total;
        let covered = 0, head = data.polyline[0];
        ctx.globalAlpha = 1;
        ctx.lineWidth = 2.6 * unit;
        ctx.beginPath();
        ctx.moveTo(...project(head));
        for (let i = 1; i < data.polyline.length; i++) {
          const a = data.polyline[i - 1], b = data.polyline[i], d = length(a, b);
          if (covered + d >= progress) {
            const q = clamp((progress - covered) / d);
            head = a.map((v, k) => v + q * (b[k] - v));
            ctx.lineTo(...project(head));
            break;
          }
          ctx.lineTo(...project(b));
          covered += d;
          head = b;
        }
        ctx.stroke();
        ctx.fillStyle = palette.accent;
        ctx.beginPath();
        ctx.arc(...project(head), 3.0 * unit, 0, TAU);
        ctx.fill();
      } else {
        ctx.fillStyle = frame.side ? palette.accent : palette.fg;
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.arc(...project(data.points[frame.active]), 3.0 * unit, 0, TAU);
        ctx.fill();
      }
      for (const [id, target] of [[data.source, false], [data.target, true]]) {
        const p = project(data.points[id]);
        ctx.globalAlpha = 1;
        ctx.fillStyle = target ? palette.bg : palette.fg;
        ctx.strokeStyle = target ? palette.accent : palette.fg;
        ctx.lineWidth = 1.4 * unit;
        ctx.beginPath();
        ctx.arc(...p, 4.6 * unit, 0, TAU);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }
  };
}
