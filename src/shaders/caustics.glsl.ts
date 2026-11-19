import * as THREE from 'three'
import { CAUSTICS, COLORS } from '../config'

/** Shared time uniform: one write per frame drives every patched material. */
export const sharedTime = { value: 0 }

export const causticsGLSL = /* glsl */ `
float caustic(vec2 uv, float t) {
  vec2 p = mod(uv * 6.2831, 6.2831) - 250.0;
  vec2 i = p; float c = 1.0; float inten = .005;
  for (int n = 0; n < 4; n++) {
    float tt = t * (1.0 - (3.5 / float(n + 1)));
    i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
    c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / inten), p.y / (cos(i.y + tt) / inten)));
  }
  c /= 4.0; c = 1.17 - pow(c, 1.4);
  return pow(abs(c), 8.0);
}
float causticsAt(vec3 wp) {
  vec2 uv = wp.xz * uCScale;
  float a = caustic(uv, uTime * 0.55);
  float b = caustic(uv * 1.43 + vec2(3.1, 7.7), uTime * 0.38 + 10.0);
  return min(a, b) * 2.2 + (a + b) * 0.12;
}
`

type Hook = (shader: THREE.WebGLProgramParametersWithUniforms, renderer: THREE.WebGLRenderer) => void

/** Compose onto whatever onBeforeCompile the material already has. */
export function chainBeforeCompile(material: THREE.Material, fn: Hook) {
  const prev = material.onBeforeCompile as Hook
  material.onBeforeCompile = (shader, renderer) => {
    prev?.call(material, shader, renderer)
    fn(shader, renderer)
  }
}

/** Inject animated caustics into a Standard/Physical material (works with instancing). */
export function applyCaustics(
  material: THREE.MeshStandardMaterial,
  opts: { intensity?: number; upBias?: number } = {},
) {
  const intensity = opts.intensity ?? CAUSTICS.intensity
  chainBeforeCompile(material, (shader) => {
    shader.uniforms.uTime = sharedTime
    shader.uniforms.uCScale = { value: CAUSTICS.scale }
    shader.uniforms.uCIntensity = { value: intensity }
    shader.uniforms.uCTint = { value: new THREE.Color(COLORS.causticTint) }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCWorld;')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        {
          vec4 cw = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            cw = instanceMatrix * cw;
          #endif
          vCWorld = (modelMatrix * cw).xyz;
        }`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vCWorld;
        uniform float uTime; uniform float uCScale; uniform float uCIntensity; uniform vec3 uCTint;
        ${causticsGLSL}`,
      )
      .replace(
        '#include <opaque_fragment>',
        `{
          vec3 wn = inverseTransformDirection(normal, viewMatrix);
          float facing = clamp(wn.y * 0.65 + 0.35, 0.0, 1.0);
          float depthFade = clamp(1.0 - (vCWorld.y - 1.0) * 0.12, 0.25, 1.0);
          outgoingLight += uCTint * causticsAt(vCWorld) * uCIntensity * facing * depthFade;
        }
        #include <opaque_fragment>`,
      )
  })
  const key = material.customProgramCacheKey.bind(material)
  material.customProgramCacheKey = () => key() + '|caustics' + intensity
}
