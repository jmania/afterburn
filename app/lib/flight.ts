/** Raw ADS-B fixes: elapsed seconds, longitude, latitude, EGM96 altitude in metres. */
export type Fix = [number, number, number, number];
export type Flight = {start: string; points: Fix[]};
export const CENTER = {lat: 37.845, lon: -122.337};
export const ALTITUDE_SCALE = 2;
export const MAX_GAP = 30;
const KM_PER_DEGREE = 111.1;
export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
export function world(lon: number, lat: number, metres = 0): [number, number, number] {
  return [(lon - CENTER.lon) * KM_PER_DEGREE * Math.cos(CENTER.lat * Math.PI / 180),
    metres / 1000 * ALTITUDE_SCALE, -(lat - CENTER.lat) * KM_PER_DEGREE];
}
// A separate render view; never sort, deduplicate or rewrite the source recording in place.
export function renderFixes(points: readonly Fix[]): Fix[] {
  return points.filter((p, i) => i === points.length - 1 || p[0] < points[i + 1][0]).map(p => [...p] as Fix);
}
function slope(points: readonly Fix[], i: number, axis: number) {
  const a = points[Math.max(0, i - 1)], b = points[i], c = points[Math.min(points.length - 1, i + 1)];
  const before = b[0] - a[0], after = c[0] - b[0];
  const left = before > 0 && before <= MAX_GAP ? (b[axis] - a[axis]) / before : 0;
  const right = after > 0 && after <= MAX_GAP ? (c[axis] - b[axis]) / after : 0;
  if (i === 0) return right;
  if (i === points.length - 1) return left;
  // Shape-preserving cubic: zero at reversals; harmonic mean bounds the tangent.
  if (left * right <= 0) return 0;
  const w1 = 2 * after + before, w2 = after + 2 * before;
  return (w1 + w2) / (w1 / left + w2 / right);
}
export function sample(points: readonly Fix[], time: number, smooth = false) {
  if (points.length < 2) throw new Error('At least two distinct fixes are required');
  const t = clamp(time, points[0][0], points.at(-1)![0]);
  let lo = 0, hi = points.length - 1;
  while (lo < hi) {const mid = (lo + hi + 1) >> 1; if (points[mid][0] <= t) lo = mid; else hi = mid - 1;}
  const i = Math.min(lo, points.length - 2), a = points[i], b = points[i + 1], dt = b[0] - a[0];
  const f = clamp((t - a[0]) / dt, 0, 1), gap = dt > MAX_GAP && t > a[0] && t < b[0];
  const p: Fix = [t, a[1], a[2], a[3]];
  for (let axis = 1; axis <= 3; axis++) {
    if (gap) continue; // Hold the last fix, explicitly marked as missing data.
    if (!smooth) p[axis] = a[axis] + (b[axis] - a[axis]) * f;
    else {
      const m0 = slope(points, i, axis), m1 = slope(points, i + 1, axis);
      p[axis] = (2*f**3 - 3*f**2 + 1)*a[axis] + (f**3 - 2*f**2 + f)*dt*m0
        + (-2*f**3 + 3*f**2)*b[axis] + (f**3 - f**2)*dt*m1;
    }
  }
  return {i, p, gap};
}
export function motion(points: readonly Fix[], t: number) {
  const current = sample(points, t, true);
  const a = points[current.i], b = points[current.i + 1];
  if (current.gap || b[0] - a[0] > MAX_GAP) return {velocity: [0, 0, 0] as [number, number, number], speed: 0, heading: 0, pitch: 0};
  const dt = b[0] - a[0], f = clamp((current.p[0] - a[0]) / dt, 0, 1);
  const derivative: number[] = [];
  for (let axis = 1; axis <= 3; axis++) {
    const m0 = slope(points, current.i, axis), m1 = slope(points, current.i + 1, axis);
    derivative.push(((6*f*f - 6*f)*a[axis] + (3*f*f - 4*f + 1)*dt*m0
      + (-6*f*f + 6*f)*b[axis] + (3*f*f - 2*f)*dt*m1) / dt);
  }
  const velocity = world(CENTER.lon + derivative[0], CENTER.lat + derivative[1], derivative[2]);
  const horizontal = Math.hypot(velocity[0], velocity[2]);
  return {velocity, speed: horizontal * 1000, heading: Math.atan2(-velocity[0], -velocity[2]),
    pitch: Math.atan2(velocity[1], horizontal)};
}
export function tileAt(lon: number, lat: number, z: number) {
  const n = 2**z;
  return {x: Math.floor((lon + 180) / 360 * n), y: Math.floor((1 - Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)/2*n)};
}
export function tileLon(x: number, z: number) {return x / 2**z * 360 - 180;}
export function tileLat(y: number, z: number) {return Math.atan(Math.sinh(Math.PI*(1 - 2*y/2**z))) * 180 / Math.PI;}
export function elevation(r: number, g: number, b: number) {return r*256 + g + b/256 - 32768;}

export function renderPosition(p: Fix) {return world(p[1],p[2],Math.max(6,p[3]));}
