import type * as THREE from 'three'
import type { LionfishParams } from '../params'
import { createBodyFrame, buildBody, type BodyFrame } from './body'
import { Bucket } from './builder'
import { buildAnal, buildCaudal, buildDorsalSpines, buildPectoral, buildPelvic, buildSoftDorsal } from './fins'
import { buildHead } from './head'
import { LODS } from './lod'

/**
 * One fish = three geometries, one per draw bucket:
 *   body       opaque, clearcoat: body loft, eyes, jaw, tentacles, tabs
 *   fins       opaque: dorsal spines and every fin ray
 *   membranes  translucent, double-sided, no depth write: all fin membranes
 * Each geometry keeps `userData.parts` (named index ranges) for GLB export.
 */
export interface LionfishGeometry {
  body: THREE.BufferGeometry
  fins: THREE.BufferGeometry
  membranes: THREE.BufferGeometry
  frame: BodyFrame
  triangles: number
}

export function buildLionfishGeometry(p: LionfishParams, lodLevel: number): LionfishGeometry {
  const lod = LODS[lodLevel]
  const frame = createBodyFrame(p)
  const body = new Bucket(), fins = new Bucket(), membranes = new Bucket()

  // 1. body loft (banding shader reads uv.u along it)
  buildBody(body, frame, lod.sections, lod.radial)
  // 2. spiny dorsal: free-standing spines + low notched membrane
  buildDorsalSpines(fins, membranes, frame, p, lod)
  // 3. pectoral fans
  buildPectoral(fins, membranes, frame, p, lod, 1)
  buildPectoral(fins, membranes, frame, p, lod, -1)
  // 4. remaining fins
  buildSoftDorsal(fins, membranes, frame, p, lod)
  buildAnal(fins, membranes, frame, p, lod)
  buildCaudal(fins, membranes, frame, p, lod)
  buildPelvic(fins, membranes, frame, p, lod, 1)
  buildPelvic(fins, membranes, frame, p, lod, -1)
  // 5. head details
  buildHead(body, frame, p, lod)

  const out = { body: body.toGeometry(), fins: fins.toGeometry(), membranes: membranes.toGeometry() }
  const triangles = Object.values(out).reduce((n, g) => n + g.index!.count / 3, 0)
  return { ...out, frame, triangles }
}
