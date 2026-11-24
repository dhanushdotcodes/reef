/**
 * Procedural lionfish colouring (fragment).
 *
 * Body: ~20 vertical bands from the body UV u (0 snout -> 1 tail). The u axis is
 * warped so bands crowd together (get thinner) toward the tail, and boundaries
 * wobble with low-frequency noise so they look hand-painted. Each period is a
 * broad red-brown band with a thin dark maroon pinstripe, then a cream band.
 * The belly is paler.
 *
 * Rays / spines / tentacles: alternating red and cream bands along their own
 * length (aPaint.y = distance along the ray, aPaint.z = bands per unit).
 */
export const bandingGLSL = /* glsl */ `
float lfHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float lfNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(lfHash(i), lfHash(i + vec2(1.0, 0.0)), f.x), mix(lfHash(i + vec2(0.0, 1.0)), lfHash(i + vec2(1.0, 1.0)), f.x), f.y);
}

// Rotate a colour's hue by h turns (per-fish variation).
vec3 lfHue(vec3 c, float h) {
  const vec3 k = vec3(0.57735);
  float ca = cos(h * 6.2832), sa = sin(h * 6.2832);
  return c * ca + cross(k, c) * sa + k * dot(k, c) * (1.0 - ca);
}

vec3 lfBodyBands(float u, vec3 p) {
  float x = u + 0.6 * u * u;                       // crowd bands toward the tail
  float wob = uBandWobble * ((lfNoise(vec2(p.y * 5.0, u * 9.0)) - 0.5) * 0.9 + sin(p.y * 7.0 + u * 11.0) * 0.25);
  float c = x * uBandCount / 1.6 + wob * 0.5;
  float f = fract(c);
  float aa = fwidth(c) * 1.2 + 1e-4;
  float d = abs(f - 0.5);                          // 0 at band centre, 0.5 at edges
  float white = 1.0 - smoothstep(0.12 - aa, 0.12 + aa, d);
  float pin = 1.0 - smoothstep(0.035 - aa, 0.035 + aa, 0.5 - d);
  vec3 red = mix(uBandRed, uBandRed * 0.5, pin * 0.85);
  vec3 col = mix(red, uBandWhite, white);
  col = mix(col, uBandWhite * 0.96, smoothstep(-0.12, -0.36, p.y) * 0.45); // pale belly
  col *= 1.0 - smoothstep(0.15, 0.45, p.y) * 0.15;                       // darker back
  return col;
}

vec3 lfRayBands(float dist, float perUnit) {
  float c = dist * perUnit;
  float aa = fwidth(c) + 1e-4;
  float f = fract(c);
  float white = smoothstep(0.5 - aa, 0.5 + aa, f) * (1.0 - smoothstep(1.0 - aa, 1.0, f));
  return mix(uBandRed * 1.05, uBandWhite, white);
}
`
