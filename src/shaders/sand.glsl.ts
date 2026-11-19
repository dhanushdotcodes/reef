import * as THREE from 'three'
import { chainBeforeCompile } from './caustics.glsl'
import { COLORS, TERRAIN } from '../config'

/** Noise-patched sand colour + radial fade into fog so the world has no edge. */
export function applySand(material: THREE.MeshStandardMaterial) {
  chainBeforeCompile(material, (shader) => {
    shader.uniforms.uFadeStart = { value: TERRAIN.size * 0.28 }
    shader.uniforms.uFadeEnd = { value: TERRAIN.size * 0.5 }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSandPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSandPos = position;')
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vSandPos;
        uniform float uFadeStart; uniform float uFadeEnd;
        float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float vnoise(vec2 p){
          vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
          return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y);
        }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          vec2 sp = vSandPos.xz;
          float patches = vnoise(sp * 0.35) * 0.6 + vnoise(sp * 1.3) * 0.3 + vnoise(sp * 6.0) * 0.1;
          diffuseColor.rgb *= mix(0.62, 1.08, smoothstep(0.2, 0.85, patches));
          // fine grain
          diffuseColor.rgb *= 0.94 + 0.12 * h21(floor(sp * 40.0));
        }`,
      )
      .replace(
        '#include <fog_fragment>',
        `#include <fog_fragment>
        #ifdef USE_FOG
        {
          float edge = smoothstep(uFadeStart, uFadeEnd, length(vSandPos.xz));
          gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, edge);
        }
        #endif`,
      )
  })
}

export const sandColor = new THREE.Color(COLORS.sand)
