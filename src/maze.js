const TAU = 2 * Math.PI;
const length = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function random(seed) {
  return () => {
    seed |= 0;
    seed = seed + 0x6d2b79f5 | 0;
    let value = Math.imul(seed ^ seed >>> 15, 1 | seed);
    value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value;
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function mazeEdges(count, edges, seed, loops) {
  const rng = random(seed);
  const adjacent = Array.from({ length: count }, () => []);
  edges.forEach((edge, i) => {
    adjacent[edge.a].push(i);
    adjacent[edge.b].push(i);
  });
  const seen = new Uint8Array(count), open = new Set(), stack = [0];
  seen[0] = 1;
  while (stack.length) {
    const node = stack.at(-1);
    const candidates = adjacent[node].filter(i => !seen[edges[i].a === node ? edges[i].b : edges[i].a]);
    if (!candidates.length) {
      stack.pop();
      continue;
    }
    const id = candidates[Math.floor(rng() * candidates.length)];
    const next = edges[id].a === node ? edges[id].b : edges[id].a;
    open.add(id);
    seen[next] = 1;
    stack.push(next);
  }
  const closed = edges.map((_, i) => i).filter(i => !open.has(i));
  for (let i = closed.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [closed[i], closed[j]] = [closed[j], closed[i]];
  }
  closed.slice(0, loops).forEach(i => open.add(i));
  return open;
}

function solve(data) {
  const n = data.points.length;
  const adjacency = Array.from({ length: n }, () => []);
  data.edges.forEach((edge, id) => {
    edge.weight ||= edge.line.slice(1).reduce((sum, point, i) => sum + length(point, edge.line[i]), 0);
    adjacency[edge.a].push([edge.b, id]);
    adjacency[edge.b].push([edge.a, id]);
  });
  const distance = [new Float64Array(n).fill(Infinity), new Float64Array(n).fill(Infinity)];
  const parent = [new Int16Array(n).fill(-1), new Int16Array(n).fill(-1)];
  const parentEdge = [new Int16Array(n).fill(-1), new Int16Array(n).fill(-1)];
  const settled = [new Uint8Array(n), new Uint8Array(n)];
  distance[0][data.source] = distance[1][data.target] = 0;
  let best = Infinity, bridge = null;
  const frames = [];

  function minimum(side) {
    let node = -1, key = Infinity;
    for (let i = 0; i < n; i++) if (!settled[side][i] && distance[side][i] < key) {
      node = i;
      key = distance[side][i];
    }
    return [node, key];
  }
  function recover() {
    if (!bridge) return [];
    const left = [], right = [];
    for (let u = bridge[0]; u >= 0; u = parent[0][u]) left.push(u);
    for (let u = bridge[1]; u >= 0; u = parent[1][u]) right.push(u);
    return left.reverse().concat(bridge[0] === bridge[1] ? right.slice(1) : right);
  }
  function record(side, active) {
    frames.push({
      settled: settled.map(s => s.slice()),
      parentEdge: parentEdge.map(p => p.slice()),
      side,
      active
    });
  }

  record(0, data.source);
  while (true) {
    const a = minimum(0), b = minimum(1);
    if (a[0] < 0 || b[0] < 0 || a[1] + b[1] >= best) break;
    const side = a[1] <= b[1] ? 0 : 1, u = side ? b[0] : a[0];
    settled[side][u] = 1;
    if (distance[0][u] + distance[1][u] < best) {
      best = distance[0][u] + distance[1][u];
      bridge = [u, u];
    }
    for (const [v, id] of adjacency[u]) {
      const cost = distance[side][u] + data.edges[id].weight;
      if (cost < distance[side][v]) {
        distance[side][v] = cost;
        parent[side][v] = u;
        parentEdge[side][v] = id;
      }
      if (cost + distance[1 - side][v] < best) {
        best = cost + distance[1 - side][v];
        bridge = side ? [v, u] : [u, v];
      }
    }
    record(side, u);
  }
  const route = recover();
  const routeEdges = route.slice(1).map((v, i) => adjacency[route[i]].find(e => e[0] === v)[1]);
  const polyline = [];
  routeEdges.forEach((id, i) => {
    const edge = data.edges[id];
    const line = edge.a === route[i] ? edge.line : edge.line.slice().reverse();
    polyline.push(...(i ? line.slice(1) : line));
  });
  return { ...data, frames, route, routeEdges, polyline, cost: best };
}

function polarPoint(r, angle) {
  return [r * Math.cos(angle), r * Math.sin(angle)];
}

function arcLine(r, a, b) {
  if (Math.abs(b - a) < 1e-12) return [polarPoint(r, a)];
  const count = Math.max(2, Math.ceil(Math.abs(b - a) / 0.035));
  return Array.from({ length: count + 1 }, (_, i) => polarPoint(r, a + (b - a) * i / count));
}

export function buildMaze() {
  const counts = [8, 16, 32, 32, 32, 32];
  const radii = [0.1, 0.24, 0.38, 0.53, 0.68, 0.84, 1];
  const points = [[0, 0]], cells = [{ inner: 0, outer: 0.1, a: 0, b: TAU }];
  const ids = [], candidates = [];
  for (let ring = 0; ring < counts.length; ring++) {
    ids[ring] = [];
    for (let j = 0; j < counts[ring]; j++) {
      const a = TAU * j / counts[ring], b = TAU * (j + 1) / counts[ring];
      ids[ring].push(points.length);
      points.push(polarPoint((radii[ring] + radii[ring + 1]) / 2, (a + b) / 2));
      cells.push({ inner: radii[ring], outer: radii[ring + 1], a, b });
    }
  }
  for (let ring = 0; ring < counts.length; ring++) {
    const count = counts[ring], r = (radii[ring] + radii[ring + 1]) / 2;
    for (let j = 0; j < count; j++) {
      const angle = TAU * (j + 0.5) / count, boundary = TAU * (j + 1) / count;
      candidates.push({
        a: ids[ring][j],
        b: ids[ring][(j + 1) % count],
        line: arcLine(r, angle, angle + TAU / count),
        weight: r * TAU / count,
        wall: {
          type: 'line',
          a: polarPoint(radii[ring], boundary),
          b: polarPoint(radii[ring + 1], boundary)
        }
      });
      if (ring === 0) {
        candidates.push({
          a: 0,
          b: ids[ring][j],
          line: [[0, 0], points[ids[ring][j]]],
          wall: { type: 'arc', r: radii[0], a: TAU * j / count, b: boundary }
        });
      } else {
        const previous = Math.floor(j * counts[ring - 1] / count), parent = ids[ring - 1][previous];
        const parentAngle = TAU * (previous + 0.5) / counts[ring - 1];
        const parentRadius = (radii[ring - 1] + radii[ring]) / 2;
        const line = arcLine(parentRadius, parentAngle, angle);
        line.push(points[ids[ring][j]]);
        candidates.push({
          a: parent,
          b: ids[ring][j],
          line,
          weight: parentRadius * Math.abs(parentAngle - angle) + r - parentRadius,
          wall: { type: 'arc', r: radii[ring], a: TAU * j / count, b: boundary }
        });
      }
    }
  }
  const open = mazeEdges(points.length, candidates, 32817, 12);
  const walls = candidates.filter((_, i) => !open.has(i)).map(e => e.wall);
  walls.push({ type: 'arc', r: 1, a: 0, b: TAU });
  return solve({
    points,
    cells,
    walls,
    edges: candidates.filter((_, i) => open.has(i)),
    source: ids[5][15],
    target: ids[5][31]
  });
}

