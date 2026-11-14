import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

const WATER = '#08485a'

type Swimmer = {
  group: THREE.Group
  tail: THREE.Object3D
  radius: number
  phase: number
  height: number
  speed: number
}

type Bubble = {
  mesh: THREE.Mesh
  speed: number
  drift: number
  baseX: number
  baseZ: number
}

export type ReefApp = {
  dispose: () => void
}

export function createReef(canvas: HTMLCanvasElement): ReefApp {
  const geometries: THREE.BufferGeometry[] = []
  const materials: THREE.Material[] = []

  const geo = <T extends THREE.BufferGeometry>(geometry: T): T => {
    geometries.push(geometry)
    return geometry
  }

  const mat = <T extends THREE.Material>(material: T): T => {
    materials.push(material)
    return material
  }

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(WATER)
  scene.fog = new THREE.FogExp2(WATER, 0.055)

  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 80)
  camera.position.set(7.2, 3.4, 8.4)

  const controls = new OrbitControls(camera, canvas)
  controls.enableDamping = true
  controls.target.set(0, 0.8, 0)
  controls.maxPolarAngle = Math.PI * 0.48
  controls.minDistance = 3.5
  controls.maxDistance = 18

  scene.add(new THREE.HemisphereLight('#b7e4ff', '#c6a36a', 1.5))

  const sun = new THREE.DirectionalLight('#fff4dc', 2.6)
  sun.position.set(6, 10, 3)
  sun.castShadow = true
  sun.shadow.mapSize.set(1024, 1024)
  sun.shadow.camera.near = 1
  sun.shadow.camera.far = 24
  sun.shadow.camera.left = -10
  sun.shadow.camera.right = 10
  sun.shadow.camera.top = 10
  sun.shadow.camera.bottom = -10
  scene.add(sun)

  const caustic = new THREE.PointLight('#7ef0d4', 18, 14, 2)
  caustic.position.set(0, 3.5, 0)
  scene.add(caustic)

  const sand = new THREE.Mesh(
    geo(new THREE.CircleGeometry(16, 72)),
    mat(new THREE.MeshStandardMaterial({ color: '#e4cf9f', roughness: 1 })),
  )
  sand.rotation.x = -Math.PI / 2
  sand.receiveShadow = true
  scene.add(sand)

  addCoral(scene, geo, mat)
  const swimmers = addFish(scene, geo, mat)
  const bubbles = addBubbles(scene, geo, mat)

  const resize = () => {
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    if (width === 0 || height === 0) return
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    renderer.setSize(width, height, false)
  }

  const onResize = () => resize()
  window.addEventListener('resize', onResize)
  resize()

  let frame = 0
  let previous = performance.now()
  const tick = (time: number) => {
    const t = time * 0.001
    const dt = Math.min((time - previous) / 1000, 0.05)
    previous = time

    for (const fish of swimmers) {
      const angle = t * fish.speed + fish.phase
      fish.group.position.set(
        Math.cos(angle) * fish.radius,
        fish.height + Math.sin(t * 1.7 + fish.phase) * 0.16,
        Math.sin(angle) * fish.radius,
      )
      fish.group.rotation.y = angle + Math.PI / 2
      fish.tail.rotation.y = Math.sin(t * 8 + fish.phase) * 0.45
    }

    for (const bubble of bubbles) {
      bubble.mesh.position.y += bubble.speed * dt
      bubble.mesh.position.x =
        bubble.baseX + Math.sin(t * 1.4 + bubble.drift) * 0.15
      if (bubble.mesh.position.y > 6.5) bubble.mesh.position.y = 0.15
    }

    caustic.position.x = Math.sin(t * 0.6) * 2.4
    caustic.position.z = Math.cos(t * 0.45) * 2.4

    controls.update()
    renderer.render(scene, camera)
    frame = requestAnimationFrame(tick)
  }
  frame = requestAnimationFrame(tick)

  return {
    dispose() {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', onResize)
      controls.dispose()
      for (const geometry of geometries) geometry.dispose()
      for (const material of materials) material.dispose()
      renderer.dispose()
    },
  }
}

function addCoral(
  scene: THREE.Scene,
  geo: <T extends THREE.BufferGeometry>(geometry: T) => T,
  mat: <T extends THREE.Material>(material: T) => T,
) {
  const colors = ['#ff6b6b', '#ff8c5a', '#f25ca2', '#f4a259', '#ef6c8a']
  const clusters: Array<[number, number]> = [
    [-2.2, -1.1],
    [1.6, -2.2],
    [2.8, 1.1],
    [-3.4, 1.8],
    [0.2, 2.4],
    [-0.8, -2.8],
  ]

  for (const [x, z] of clusters) {
    const group = new THREE.Group()
    const stalks = 4 + Math.floor(Math.random() * 4)
    for (let i = 0; i < stalks; i++) {
      const height = 0.55 + Math.random() * 1.35
      const coral = new THREE.Mesh(
        geo(new THREE.ConeGeometry(0.1 + Math.random() * 0.16, height, 6)),
        mat(
          new THREE.MeshStandardMaterial({
            color: colors[i % colors.length],
            roughness: 0.72,
          }),
        ),
      )
      coral.position.set(
        (Math.random() - 0.5) * 0.7,
        height / 2,
        (Math.random() - 0.5) * 0.7,
      )
      coral.rotation.z = (Math.random() - 0.5) * 0.35
      coral.rotation.x = (Math.random() - 0.5) * 0.35
      coral.castShadow = true
      group.add(coral)
    }

    const brain = new THREE.Mesh(
      geo(new THREE.IcosahedronGeometry(0.28 + Math.random() * 0.18, 1)),
      mat(
        new THREE.MeshStandardMaterial({
          color: colors[Math.floor(Math.random() * colors.length)],
          roughness: 0.55,
        }),
      ),
    )
    brain.position.y = 0.22
    brain.scale.y = 0.65
    brain.castShadow = true
    group.add(brain)

    group.position.set(x, 0, z)
    scene.add(group)
  }

  const rockMaterial = mat(
    new THREE.MeshStandardMaterial({ color: '#6d5a48', roughness: 0.95 }),
  )
  const rockGeometry = geo(new THREE.DodecahedronGeometry(0.45, 0))
  for (const [x, z] of [
    [3.6, -0.4],
    [-4.2, -0.6],
    [0.9, 3.5],
  ] as const) {
    const rock = new THREE.Mesh(rockGeometry, rockMaterial)
    rock.position.set(x, 0.22, z)
    rock.scale.y = 0.55
    rock.castShadow = true
    rock.receiveShadow = true
    scene.add(rock)
  }
}

function addFish(
  scene: THREE.Scene,
  geo: <T extends THREE.BufferGeometry>(geometry: T) => T,
  mat: <T extends THREE.Material>(material: T) => T,
): Swimmer[] {
  const colors = ['#ffd166', '#7bdff2', '#f15bb5', '#9bf6a4', '#ffe8a3']
  const bodyGeometry = geo(new THREE.SphereGeometry(0.18, 20, 14))
  const tailGeometry = geo(new THREE.ConeGeometry(0.11, 0.26, 4))
  const swimmers: Swimmer[] = []

  colors.forEach((color, index) => {
    const bodyMaterial = mat(
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.35,
        metalness: 0.08,
      }),
    )
    const group = new THREE.Group()
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial)
    body.scale.set(1.85, 0.68, 0.52)
    body.castShadow = true

    const tailPivot = new THREE.Group()
    tailPivot.position.x = -0.28
    const tail = new THREE.Mesh(tailGeometry, bodyMaterial)
    tail.rotation.z = Math.PI / 2
    tail.position.x = -0.12
    tailPivot.add(tail)

    group.add(body, tailPivot)
    scene.add(group)
    swimmers.push({
      group,
      tail: tailPivot,
      radius: 2.1 + (index % 3) * 0.55,
      phase: index * 1.15,
      height: 0.85 + index * 0.22,
      speed: 0.38 + index * 0.04,
    })
  })

  return swimmers
}

function addBubbles(
  scene: THREE.Scene,
  geo: <T extends THREE.BufferGeometry>(geometry: T) => T,
  mat: <T extends THREE.Material>(material: T) => T,
): Bubble[] {
  const geometry = geo(new THREE.SphereGeometry(1, 12, 10))
  const material = mat(
    new THREE.MeshStandardMaterial({
      color: '#d7f7ff',
      transparent: true,
      opacity: 0.35,
      roughness: 0.05,
      metalness: 0.1,
    }),
  )
  const bubbles: Bubble[] = []

  for (let i = 0; i < 18; i++) {
    const mesh = new THREE.Mesh(geometry, material)
    const size = 0.035 + Math.random() * 0.05
    mesh.scale.setScalar(size)
    const baseX = (Math.random() - 0.5) * 6
    const baseZ = (Math.random() - 0.5) * 6
    mesh.position.set(baseX, Math.random() * 6, baseZ)
    scene.add(mesh)
    bubbles.push({
      mesh,
      speed: 0.45 + Math.random() * 0.7,
      drift: Math.random() * Math.PI * 2,
      baseX,
      baseZ,
    })
  }

  return bubbles
}
