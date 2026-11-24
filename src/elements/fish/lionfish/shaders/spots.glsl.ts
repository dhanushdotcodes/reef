/**
 * Membrane spots (fragment), a jittered cell pattern instead of textures.
 *
 * Coordinates: c.x = fractional ray index (cell centres fall between rays, on
 * the membrane), c.y = distance from the fin root. Cells are stacked in rows
 * along the rays, so spots line up in rows like the real fish.
 *   mode 3: large spots (pectoral fans, the "spotfin" pattern)
 *   mode 4: small dense spots (caudal, soft dorsal, anal, pelvic, dorsal web)
 * Returns colour and an alpha multiplier (spots are nearly opaque).
 */
export const spotsGLSL = /* glsl */ `
vec4 lfMembrane(int mode, vec2 c, vec3 base) {
  bool big = mode == 3;
  float rowStep = big ? 0.12 : 0.05;
  vec2 cell = vec2(big ? c.x : c.x * 2.0, c.y / rowStep);
  vec2 id = floor(cell);
  vec2 jit = (vec2(lfHash(id), lfHash(id + 17.0)) - 0.5) * 0.22;
  float rad = (big ? 0.3 : 0.26) * (0.75 + 0.5 * lfHash(id + 3.1));
  float keep = step(big ? 0.08 : 0.25, lfHash(id + 9.7));  // a few missing spots
  float d = length(fract(cell) - 0.5 - jit);
  float aa = fwidth(d) + 1e-4;
  float spot = (1.0 - smoothstep(rad - aa, rad + aa, d)) * keep * step(0.04, c.y);
  vec3 col = mix(base * uFinTint, uSpotColor, spot);
  return vec4(col, mix(1.0, 1.55, spot));
}
`
