import type { FishKind } from '../../game/species.ts'
import { createClownfish } from './clownfish.tsx'
import { createFighter } from './fighter.tsx'
import { createPomfret } from './pomfret.tsx'
import type { Species } from './types.ts'

export const FISH_FACTORIES: Record<FishKind, () => Species> = {
  clownfish: createClownfish,
  pomfret: createPomfret,
  fighter: createFighter,
}
