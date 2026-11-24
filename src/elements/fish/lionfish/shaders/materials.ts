import * as THREE from 'three'
import { applyCaustics, chainBeforeCompile } from '../../../../shaders/caustics.glsl'
import { BODY_FRACTION, DEFAULT_COLORS, DEFAULT_PARAMS, type LionfishColors, type LionfishParams } from '../params'
import { bandingGLSL } from './banding.glsl'
import { spotsGLSL } from './spots.glsl'
import { swimBeginNormal, swimBeginVertex, swimVertexHeader } from './swim.glsl'

/** Uniforms shared by the three lionfish materials. Mutate `.value` to tune live. */
export interface LionfishUniforms {
  uTime: { value: number }
  uSwimSpeed: { value: number }
  uSwimAmp: { value: number }
  uBodyX0: { value: number }
  uBodyLen: { value: number }
  uBandCount: { value: number }
  uBandWobble: { value: number }
  uBandRed: { value: THREE.Color }
  uBandWhite: { value: THREE.Color }
  uSpotColor: { value: THREE.Color }
  uFinTint: { value: THREE.Color }
  uGlow: { value: number }
}

export function createLionfishUniforms(
  p: LionfishParams = DEFAULT_PARAMS,
  colors: LionfishColors = DEFAULT_COLORS,
  time: { value: number } = { value: 0 },
): LionfishUniforms {
  const u: LionfishUniforms = {
    uTime: time,
    uSwimSpeed: { value: p.swimSpeed },
    uSwimAmp: { value: p.swimAmplitude },
    uBodyX0: { value: 0 },
    uBodyLen: { value: 1 },
    uBandCount: { value: p.bandCount },
    uBandWobble: { value: p.bandWobble },
    uBandRed: { value: new THREE.Color(colors.bandRed) },
    uBandWhite: { value: new THREE.Color(colors.bandWhite) },
    uSpotColor: { value: new THREE.Color(colors.spotColor) },
    uFinTint: { value: new THREE.Color(colors.finTint) },
    uGlow: { value: 0.28 },
  }
  syncUniforms(u, p)
  return u
}

/** Push non-colour params into the uniforms (call after editing params). */
export function syncUniforms(u: LionfishUniforms, p: LionfishParams) {
  u.uSwimSpeed.value = p.swimSpeed
  u.uSwimAmp.value = p.swimAmplitude
  u.uBandCount.value = p.bandCount
  u.uBandWobble.value = p.bandWobble
  u.uBodyX0.value = p.length / 2
  u.uBodyLen.value = p.length * BODY_FRACTION
}

const fragmentHeader = /* glsl */ `
uniform vec3 uBandRed;
uniform vec3 uBandWhite;
uniform vec3 uSpotColor;
uniform vec3 uFinTint;
uniform float uBandCount;
uniform float uBandWobble;
uniform float uGlow;
varying vec3 vPaint;
varying vec3 vRest;
varying float vHue;
${bandingGLSL}
${spotsGLSL}
`

/** Paint by aPaint.x: 0 body bands, 1 ray bands, 2 vertex colour, 3/4 membrane spots. */
const fragmentPaint = /* glsl */ `
#include <color_fragment>
{
  int lfMode = int(vPaint.x + 0.5);
  if (lfMode == 0) diffuseColor.rgb = lfHue(lfBodyBands(vPaint.y, vRest), vHue);
  else if (lfMode == 1) diffuseColor.rgb = lfHue(lfRayBands(vPaint.y, vPaint.z), vHue);
  else if (lfMode >= 3) {
    vec4 m = lfMembrane(lfMode, vPaint.yz, diffuseColor.rgb);
    diffuseColor.rgb = lfHue(m.rgb, vHue * 0.5);
    diffuseColor.a = min(1.0, diffuseColor.a * m.a);
  }
  // a little self-illumination keeps the reds saturated under the scene's cyan
  // underwater light (a hero creature should pop in a video clip)
  totalEmissiveRadiance += diffuseColor.rgb * uGlow;
}
`

function patch(material: THREE.MeshStandardMaterial, uniforms: LionfishUniforms, key: string) {
  chainBeforeCompile(material, (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${swimVertexHeader}`)
      .replace('#include <beginnormal_vertex>', swimBeginNormal)
      .replace('#include <begin_vertex>', swimBeginVertex)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${fragmentHeader}`)
      .replace('#include <color_fragment>', fragmentPaint)
  })
  const prev = material.customProgramCacheKey.bind(material)
  material.customProgramCacheKey = () => prev() + '|lionfish-' + key
}

export interface LionfishMaterials {
  body: THREE.MeshPhysicalMaterial
  fins: THREE.MeshStandardMaterial
  membranes: THREE.MeshStandardMaterial
  dispose(): void
}

/**
 * body      - MeshPhysical with clearcoat + sheen for a wet look (eyes get the gloss too)
 * fins      - opaque spines and rays
 * membranes - translucent, double-sided, no depth write, drawn after opaque parts
 */
export function createLionfishMaterials(uniforms: LionfishUniforms): LionfishMaterials {
  const body = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    roughness: 0.48,
    metalness: 0,
    clearcoat: 0.7,
    clearcoatRoughness: 0.28,
    sheen: 0.35,
    sheenRoughness: 0.6,
    sheenColor: new THREE.Color('#ffd9c4'),
    side: THREE.DoubleSide,
  })
  // caustics first, so our uniforms (incl. uTime) win when both hooks run
  applyCaustics(body, { intensity: 0.25 })
  patch(body, uniforms, 'body')

  const fins = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0, side: THREE.DoubleSide })
  patch(fins, uniforms, 'fins')

  const membranes = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.7,
    metalness: 0,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.6,
    depthWrite: false,
  })
  patch(membranes, uniforms, 'membranes')

  return {
    body,
    fins,
    membranes,
    dispose() {
      body.dispose()
      fins.dispose()
      membranes.dispose()
    },
  }
}
