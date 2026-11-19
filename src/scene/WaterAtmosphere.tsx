import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { COLORS, WATER } from '../config'
import { mulberry32 } from '../utils/random'
import { useQuality } from '../utils/quality'

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
void main() {
  float y = normalize(vDir).y;
  vec3 col = y < 0.0 ? mix(cMid, cBottom, smoothstep(0.0, -0.55, y))
                     : mix(cMid, cTop, smoothstep(0.0, 0.7, y));
  // faint sun glow high above
  col += vec3(0.25, 0.5, 0.55) * pow(max(0.0, y), 6.0) * 0.5;
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
      <sphereGeometry args={[150, 24, 16]} />
    </mesh>
  )
}

const rayVert = /* glsl */ `
varying vec2 vUv; varying vec3 vN; varying vec3 vV;
void main() {
  vUv = uv;
  vN = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vV = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}`
const rayFrag = /* glsl */ `
varying vec2 vUv; varying vec3 vN; varying vec3 vV;
uniform float uTime; uniform float uPhase; uniform vec3 uColor; uniform float uStrength;
void main() {
  float edge = pow(abs(dot(normalize(vN), normalize(vV))), 1.6);
  float vert = pow(clamp(vUv.y, 0.0, 1.0), 1.3) * smoothstep(0.0, 0.12, 1.0 - vUv.y);
  float flick = 0.75 + 0.25 * sin(uTime * 0.7 + uPhase) * sin(uTime * 0.31 + uPhase * 2.3);
  float a = edge * vert * flick * uStrength;
  gl_FragColor = vec4(uColor, a);
}`

function GodRays() {
  const tier = useQuality((s) => s.tier)
  const count = tier === 0 ? 4 : WATER.rays
  const rays = useMemo(() => {
    const r = mulberry32(77)
    return Array.from({ length: count }, (_, i) => ({
      x: (r() - 0.5) * 30,
      z: -14 + r() * 20,
      tilt: 0.18 + r() * 0.1,
      yaw: r() * Math.PI * 2,
      radius: 0.8 + r() * 1.0,
      phase: r() * 10 + i,
      strength: 0.16 + r() * 0.14,
    }))
  }, [count])
  const group = useRef<THREE.Group>(null)
  const mats = useMemo(
    () =>
      rays.map(
        (ray) =>
          new THREE.ShaderMaterial({
            vertexShader: rayVert,
            fragmentShader: rayFrag,
            uniforms: {
              uTime: { value: 0 },
              uPhase: { value: ray.phase },
              uColor: { value: new THREE.Color('#bff6ff') },
              uStrength: { value: ray.strength },
            },
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
            fog: false,
          }),
      ),
    [rays],
  )
  useFrame((s) => {
    const t = s.clock.elapsedTime
    mats.forEach((m) => (m.uniforms.uTime.value = t))
    group.current?.children.forEach((c, i) => {
      c.rotation.z = rays[i].tilt + Math.sin(t * 0.25 + rays[i].phase) * 0.04
      c.rotation.x = Math.cos(t * 0.2 + rays[i].phase) * 0.03
    })
  })
  return (
    <group ref={group}>
      {rays.map((ray, i) => (
        <mesh key={i} position={[ray.x, 9, ray.z]} rotation={[0, ray.yaw, ray.tilt]} material={mats[i]} frustumCulled={false} renderOrder={-10}>
          <cylinderGeometry args={[0.18, ray.radius, 24, 14, 1, true]} />
        </mesh>
      ))}
    </group>
  )
}

export function WaterAtmosphere() {
  return (
    <>
      <fogExp2 attach="fog" args={[COLORS.fog, WATER.fogDensity]} />
      <Backdrop />
      <GodRays />
    </>
  )
}
