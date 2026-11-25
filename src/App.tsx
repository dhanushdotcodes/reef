import { Canvas } from '@react-three/fiber'
import { PerformanceMonitor } from '@react-three/drei'
import { CAMERA, COLORS } from './config'
import { isLowPower, useQuality } from './utils/quality'
import { Seabed } from './scene/Seabed'
import { WaterAtmosphere } from './scene/WaterAtmosphere'
import { Lighting } from './scene/Lighting'
import { CameraRig } from './scene/CameraRig'
import { TimeDriver } from './scene/TimeDriver'
import { Particles } from './scene/Particles'
import { ElementsLayer } from './elements/ElementsLayer'
import { PlacementController } from './scene/PlacementController'
import { Toolbar } from './ui/Toolbar'
import { TopBar } from './ui/TopBar'
import { FxLayer } from './fx/FxLayer'
import { FishLayer } from './elements/fish/FishLayer'
import { EditController } from './scene/EditController'
import { SelectionHUD } from './ui/SelectionHUD'
import { Effects } from './scene/Effects'
import { ScreenshotController } from './scene/ScreenshotController'

export function App() {
  const tier = useQuality((s) => s.tier)
  const setTier = useQuality((s) => s.setTier)
  return (
    <>
      <Canvas
        flat
        shadows={!isLowPower}
        dpr={isLowPower ? [1, 1.5] : [1, 2]}
        camera={{ fov: CAMERA.fov, position: [...CAMERA.start], near: 0.1, far: 300 }}
        gl={{ antialias: false, powerPreference: 'high-performance' }}
        style={{ position: 'fixed', inset: 0, touchAction: 'none', background: COLORS.bgBottom }}
      >
        <PerformanceMonitor
          flipflops={3}
          onDecline={() => setTier(Math.max(0, tier - 1) as 0 | 1 | 2)}
          onFallback={() => setTier(0)}
        />
        <TimeDriver />
        <WaterAtmosphere />
        <Lighting />
        <Seabed />
        <Particles />
        <ElementsLayer />
        <FishLayer />
        <PlacementController />
        <EditController />
        <SelectionHUD />
        <FxLayer />
        <CameraRig />
        <Effects />
        <ScreenshotController />
      </Canvas>
      <TopBar />
      <Toolbar />
    </>
  )
}
