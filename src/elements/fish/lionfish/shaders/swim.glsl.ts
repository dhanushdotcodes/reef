import { PECTORAL } from '../params'

const f = (n: number) => n.toFixed(5)

/**
 * Shared vertex deformation for every lionfish material. Everything animates on
 * the GPU from per-instance attributes, so hundreds of fish cost 3 draw calls.
 *
 * Per-instance (InstancedBufferAttribute):
 *   iAnim  = (phase, flare 0..1, erect 0..1, swim effort 0..1)
 *   iAnim2 = (hue shift, threat side -1..1, threat ahead 0..1, mouth gape 0..1)
 *
 * Per-vertex: aPivot, aRig, aPaint (see geometry/builder.ts).
 *
 * Order: part rig (fold / flare / sway, rotating about aPivot) -> body swim
 * wave (lateral Z offset travelling head-to-tail, growing toward the tail).
 */
export const swimVertexHeader = /* glsl */ `
attribute vec3 aPivot;
attribute vec4 aRig;
attribute vec3 aPaint;
#ifdef USE_INSTANCING
attribute vec4 iAnim;
attribute vec4 iAnim2;
#endif
uniform float uTime;
uniform float uSwimSpeed;
uniform float uSwimAmp;
uniform float uBodyX0;
uniform float uBodyLen;
varying vec3 vPaint;
varying vec3 vRest;
varying float vHue;

mat3 lfRotX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
mat3 lfRotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
mat3 lfRotZ(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }

// Part rig. Returns a rotation about aPivot plus an extra offset.
void lionfishRig(vec3 p, vec4 A, vec4 B, out mat3 R, out vec3 ofs) {
  float t = uTime;
  float ph = A.x, flare = A.y, erect = A.z, swim = A.w;
  int type = int(aRig.x + 0.5);
  float s = aRig.y, w = aRig.z;
  float breath = sin(t * 1.9 + ph * 3.0);
  R = mat3(1.0);
  ofs = vec3(0.0);

  if (type == 0) {
    // BODY: gill covers pulse outward with each breath, just behind the head
    float g = exp(-pow((aPaint.y - 0.25) / 0.05, 2.0));
    ofs.z = p.z * 0.05 * g * (0.5 + 0.5 * breath);
  } else if (type == 1) {
    // DORSAL SPINES: fold back toward the tail as erect -> 0. Sway lags from the
    // front spine to the back one (secondary motion). In defence they lean
    // sideways/forward toward the threat.
    float fold = (1.0 - erect) * (0.85 + 0.55 * s);
    float sway = sin(t * 1.5 * uSwimSpeed + ph - s * 2.6) * (0.03 + 0.04 * swim);
    R = lfRotX(B.y * 0.42 * (0.5 + 0.5 * s)) * lfRotZ(fold + sway - B.z * 0.3);
  } else if (type == 2) {
    // PECTORALS: rest geometry is fully flared. Undo the rest yaw, rotate each
    // ray within the fan plane toward its folded angle, then yaw back out by the
    // current flare. A phase-shifted ripple runs across the rays.
    float side = sign(aPivot.z);
    float rip = sin(t * 2.0 + ph - s * 3.4) * (0.05 + 0.06 * (1.0 - 0.5 * flare));
    float yaw = mix(${f(PECTORAL.yawFolded)}, ${f(PECTORAL.yawFlared)}, flare) + rip;
    float rest = mix(${f(PECTORAL.restTop)}, ${f(PECTORAL.restBottom)}, s);
    float fold = mix(${f(PECTORAL.foldTop)}, ${f(PECTORAL.foldBottom)}, s);
    float dTheta = (fold - rest) * (1.0 - flare) + rip * 0.25;
    R = lfRotY(side * yaw) * lfRotZ(dTheta) * lfRotY(-side * ${f(PECTORAL.yawFlared)});
  } else if (type == 3) {
    // SOFT FINS (soft dorsal, anal, caudal, pelvic): a gentle travelling flutter
    ofs.z = sin(t * 2.4 * uSwimSpeed + ph * 1.3 + s * 3.0 - w * 9.0) * w * (0.08 + 0.1 * swim);
  } else if (type == 4) {
    // TENTACLES / TABS: soft, delayed, spring-like sway, growing toward the tip
    float a = t * 1.3 + ph * 2.0 + s * 1.7 - w * 2.2;
    ofs = vec3(-0.35 * sin(a * 0.7), 0.15 * sin(a * 1.3), sin(a)) * 0.07 * w * w;
  } else if (type == 5) {
    // LOWER JAW: opens a little with each breath, wider when gaping
    float open = 0.04 + 0.08 * (0.5 + 0.5 * breath) + B.w * 0.3;
    R = lfRotZ(-open);
  }
}

// Body swim wave: lateral offset at body coordinate x (lionfish are slow, ~0.6 Hz)
float lionfishBend(float x, vec4 A) {
  float xn = clamp((uBodyX0 - x) / uBodyLen, 0.0, 1.5);
  float env = 0.03 + smoothstep(0.15, 1.0, xn) * xn;
  return sin(6.2832 * (xn * 0.8 - uTime * 0.6 * uSwimSpeed) + A.x) * env * uSwimAmp * (0.02 + 0.06 * A.w) * uBodyLen;
}
`

/** Replaces <beginnormal_vertex>: compute the rig once, rotate the normal with it. */
export const swimBeginNormal = /* glsl */ `
#include <beginnormal_vertex>
#ifdef USE_INSTANCING
  vec4 lfA = iAnim;
  vec4 lfB = iAnim2;
#else
  vec4 lfA = vec4(0.0, 0.7, 0.8, 0.4);
  vec4 lfB = vec4(0.0);
#endif
mat3 lfR;
vec3 lfOfs;
lionfishRig(position, lfA, lfB, lfR, lfOfs);
objectNormal = lfR * objectNormal;
`

/** Replaces <begin_vertex>: apply the rig and the swim wave to the position. */
export const swimBeginVertex = /* glsl */ `
#include <begin_vertex>
transformed = aPivot + lfR * (transformed - aPivot) + lfOfs;
transformed.z += lionfishBend(mix(aPivot.x, position.x, aRig.w), lfA);
vPaint = aPaint;
vRest = position;
vHue = lfB.x;
`
