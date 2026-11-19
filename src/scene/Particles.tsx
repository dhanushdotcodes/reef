import { useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { PARTICLES } from '../config'
import { mulberry32 } from '../utils/random'
import { useQuality } from '../utils/quality'

const vert = /* glsl */ `
attribute float aSeed;
uniform float uTime; uniform float uSize; uniform float uViewH;
varying float vAlpha;
const vec3 BOX = vec3(36.0, 10.0, 36.0);
void main() {
  vec3 p = position;
  p.x += sin(uTime * 0.12 + aSeed * 40.0) * 0.8 + uTime * 0.05 * (aSeed - 0.5);
  p.z += cos(uTime * 0.1 + aSeed * 23.0) * 0.8;
  p.y += uTime * (0.05 + aSeed * 0.12);
  p = mod(p + BOX * 0.5, BOX) - BOX * 0.5 + vec3(0.0, BOX.y * 0.5, 0.0);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * (0.5 + aSeed) * uViewH / -mv.z;
  float twinkle = 0.65 + 0.35 * sin(uTime * (0.5 + aSeed * 1.5) + aSeed * 30.0);
  vAlpha = twinkle * smoothstep(40.0, 8.0, -mv.z);
}`
const frag = /* glsl */ `
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = smoothstep(1.0, 0.0, d);
  a *= a;
  gl_FragColor = vec4(0.8, 0.96, 1.0, a * vAlpha * 0.55);
}`

/** Slow-drifting marine snow. All motion happens in the vertex shader. */
export function Particles() {
  const tier = useQuality((s) => s.tier)
  const count = tier === 0 ? PARTICLES.countLow : PARTICLES.count
  const { geometry, material } = useMemo(() => {
    const r = mulberry32(5)
    const pos = new Float32Array(count * 3)
    const seed = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (r() - 0.5) * 36
      pos[i * 3 + 1] = r() * 10
      pos[i * 3 + 2] = (r() - 0.5) * 36
      seed[i] = r()
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
    const m = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: { uTime: { value: 0 }, uSize: { value: 0.07 }, uViewH: { value: 800 } },
      transparent: true,
      depthWrite: false,
      fog: false,
    })
    return { geometry: g, material: m }
  }, [count])

  useFrame(({ clock, gl, camera }) => {
    material.uniforms.uTime.value = clock.elapsedTime
    const fov = (camera as THREE.PerspectiveCamera).fov
    material.uniforms.uViewH.value = gl.domElement.height / (2 * Math.tan((fov * Math.PI) / 360))
  })

  return <points geometry={geometry} material={material} frustumCulled={false} renderOrder={5} />
}
