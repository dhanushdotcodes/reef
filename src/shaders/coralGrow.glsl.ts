import * as THREE from 'three'
import { chainBeforeCompile } from './caustics.glsl'

export interface GrowUniform {
  value: number
}

/**
 * Bottom-to-top dissolve reveal with a glowing edge at the front, plus emissive tips (aTip attribute).
 * Each material owns its uniform: growth is only run on a throwaway clone while spawning,
 * then the mesh swaps back to the shared, fully-revealed material.
 */
export function applyCoralShader(material: THREE.MeshStandardMaterial, height: number): GrowUniform {
  const uGrow: GrowUniform = { value: 2 }
  material.userData.uGrow = uGrow
  chainBeforeCompile(material, (shader) => {
    shader.uniforms.uGrow = uGrow
    shader.uniforms.uGHeight = { value: height }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aTip; varying float vTip; varying float vGY;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTip = aTip; vGY = position.y;')
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying float vTip; varying float vGY; uniform float uGrow; uniform float uGHeight;',
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        float gFront = uGrow * uGHeight;
        if (vGY > gFront) discard;`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        totalEmissiveRadiance += diffuseColor.rgb * vTip * 1.1;
        if (uGrow < 1.5) totalEmissiveRadiance += vec3(1.0, 0.85, 0.6) * smoothstep(gFront - 0.16, gFront, vGY) * 2.2;`,
      )
  })
  material.customProgramCacheKey = () => 'coral'
  return uGrow
}
