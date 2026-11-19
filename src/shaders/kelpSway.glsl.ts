import * as THREE from 'three'
import { chainBeforeCompile, sharedTime } from './caustics.glsl'
import type { GrowUniform } from './coralGrow.glsl'

/** Vertex sway (x += sin(uTime*1.2 + y*0.8 + seed) * y * 0.08), unroll-on-spawn, soft strip edges. */
export function applyKelpShader(material: THREE.MeshStandardMaterial): GrowUniform {
  const uKGrow: GrowUniform = { value: 1 }
  material.userData.uGrow = uKGrow
  chainBeforeCompile(material, (shader) => {
    shader.uniforms.uTime = sharedTime
    shader.uniforms.uKGrow = uKGrow
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nattribute float aSeed; uniform float uTime; uniform float uKGrow; varying vec2 vKUv;',
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          float h = transformed.y;
          transformed.x += sin(uTime * 1.2 + h * 0.8 + aSeed) * h * 0.08 * uKGrow;
          transformed.z += cos(uTime * 0.9 + h * 0.7 + aSeed * 1.7) * h * 0.05 * uKGrow;
          transformed.y *= uKGrow;
          vKUv = uv;
        }`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vKUv;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        diffuseColor.a *= 0.18 + 0.82 * smoothstep(0.0, 0.32, min(vKUv.x, 1.0 - vKUv.x));`,
      )
  })
  material.customProgramCacheKey = () => 'kelp'
  return uKGrow
}
