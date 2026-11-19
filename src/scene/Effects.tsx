import { EffectComposer, Bloom, Vignette, ToneMapping, ChromaticAberration } from '@react-three/postprocessing'
import { BlendFunction, ToneMappingMode } from 'postprocessing'
import { Vector2 } from 'three'
import { EFFECTS } from '../config'
import { useQuality } from '../utils/quality'

const caOffset = new Vector2(EFFECTS.chromatic, EFFECTS.chromatic)

export function Effects() {
  const tier = useQuality((s) => s.tier)
  return (
    <EffectComposer multisampling={tier === 2 ? 4 : 0} enableNormalPass={false}>
      {tier >= 1 ? (
        <Bloom
          mipmapBlur
          luminanceThreshold={EFFECTS.bloomThreshold}
          luminanceSmoothing={0.2}
          intensity={EFFECTS.bloomIntensity}
          resolutionScale={tier === 2 ? 1 : 0.5}
        />
      ) : (
        <></>
      )}
      {tier === 2 ? (
        <ChromaticAberration offset={caOffset} radialModulation={false} modulationOffset={0} blendFunction={BlendFunction.NORMAL} />
      ) : (
        <></>
      )}
      <Vignette eskil={false} offset={0.2} darkness={EFFECTS.vignetteDarkness} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  )
}
