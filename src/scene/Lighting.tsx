import { COLORS } from '../config'
import { useQuality, isLowPower } from '../utils/quality'

export function Lighting() {
  const tier = useQuality((s) => s.tier)
  const shadows = !isLowPower && tier === 2
  return (
    <>
      <hemisphereLight args={[COLORS.hemiSky, COLORS.hemiGround, 0.6]} />
      <directionalLight
        color={COLORS.sun}
        intensity={1.2}
        position={[6, 18, 4]}
        castShadow={shadows}
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0006}
        shadow-camera-left={-16}
        shadow-camera-right={16}
        shadow-camera-top={16}
        shadow-camera-bottom={-16}
        shadow-camera-near={1}
        shadow-camera-far={50}
      />
    </>
  )
}
