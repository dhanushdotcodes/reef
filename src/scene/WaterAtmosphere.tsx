import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { COLORS, SURFACE, WATER } from '../config'
import { sharedTime } from '../shaders/caustics.glsl'

const bgVert = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * p;
}`
const bgFrag = /* glsl */ `
varying vec3 vDir;
uniform vec3 cBottom; uniform vec3 cMid; uniform vec3 cTop;
uniform float uTime; uniform float uEdge; uniform float uFull; uniform float uHeight;

// cheap rippling surface brightness: warped sine interference
float ripples(vec2 p, float t) {
  vec2 q = p * 0.35;
  q += 0.6 * vec2(sin(q.y * 1.7 + t * 0.4), cos(q.x * 1.3 - t * 0.35));
  float a = sin(q.x * 2.1 + t * 0.6) * sin(q.y * 2.4 - t * 0.5);
  float b = sin((q.x + q.y) * 3.3 - t * 0.8) * sin((q.x - q.y) * 2.7 + t * 0.7);
  float v = 0.5 + 0.5 * (a * 0.6 + b * 0.4);
  return pow(v, 5.0);
}

void main() {
  vec3 d = normalize(vDir);
  float y = d.y;
  vec3 col = y < 0.0 ? mix(cMid, cBottom, smoothstep(0.0, -0.55, y))
                     : mix(cMid, cTop, smoothstep(0.0, 0.5, y));

  if (y > 0.02) {
    // where this view ray meets the surface
    vec2 sp = d.xz / y * uHeight;
    float window = smoothstep(uEdge, uFull, y);
    // outside the window the surface mirrors the dark depths (total internal reflection)
    col = mix(col, cBottom * 1.4, smoothstep(uEdge + 0.04, uEdge - 0.08, y) * smoothstep(0.05, 0.25, y) * 0.5);
    // inside: bright sky with shimmering ripples and the sun's glow
    vec3 sky = mix(vec3(0.18, 0.55, 0.62), vec3(0.6, 0.9, 0.85), smoothstep(uFull, 1.0, y));
    float r = ripples(sp, uTime) + 0.6 * ripples(sp * 1.9 + 7.0, uTime * 1.3);
    vec3 lit = sky * (0.55 + 0.25 * smoothstep(uFull, 1.0, y)) + vec3(1.0, 0.93, 0.62) * r * 0.45;
    col = mix(col, lit, window);
    // bright rim at the window's edge
    col += vec3(0.3, 0.55, 0.55) * exp(-pow((y - uEdge) * 18.0, 2.0)) * 0.35;
  }
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`

function Backdrop() {
  const ref = useRef<THREE.Mesh>(null)
  const camera = useThree((s) => s.camera)
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: bgVert,
        fragmentShader: bgFrag,
        uniforms: {
          cBottom: { value: new THREE.Color(COLORS.bgBottom) },
          cMid: { value: new THREE.Color(COLORS.bgMid) },
          cTop: { value: new THREE.Color(COLORS.bgTop) },
          uTime: sharedTime,
          uEdge: { value: SURFACE.windowEdge },
          uFull: { value: SURFACE.windowFull },
          uHeight: { value: SURFACE.height },
        },
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        toneMapped: false,
      }),
    [],
  )
  useFrame(() => ref.current?.position.copy(camera.position))
  return (
    <mesh ref={ref} material={material} renderOrder={-1000} frustumCulled={false}>
      <sphereGeometry args={[150, 48, 32]} />
    </mesh>
  )
}

export function WaterAtmosphere() {
  return (
    <>
      <fogExp2 attach="fog" args={[COLORS.fog, WATER.fogDensity]} />
      <Backdrop />
    </>
  )
}
