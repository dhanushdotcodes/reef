/** Mesh resolution per level of detail. LOD0 ≈ 14.8k triangles (budget 15k), LOD1 ≈ 4.2k. */
export interface LodSpec {
  sections: number
  radial: number
  eye: [number, number]
  spineRadial: number
  spineSegs: number
  rayRadial: number
  raySegs: number
  pecRays: number
  softRays: number
  caudalRays: number
  analRays: number
  pelvicRays: number
  memCols: number
  memRows: number
  tentRadial: number
  tentSegs: number
  tabs: boolean
}

export const LODS: LodSpec[] = [
  {
    sections: 34, radial: 28, eye: [14, 10], spineRadial: 6, spineSegs: 10, rayRadial: 4, raySegs: 7,
    pecRays: 14, softRays: 9, caudalRays: 13, analRays: 7, pelvicRays: 5, memCols: 4, memRows: 5,
    tentRadial: 6, tentSegs: 14, tabs: true,
  },
  {
    sections: 20, radial: 16, eye: [10, 7], spineRadial: 4, spineSegs: 4, rayRadial: 3, raySegs: 3,
    pecRays: 10, softRays: 6, caudalRays: 9, analRays: 5, pelvicRays: 3, memCols: 2, memRows: 3,
    tentRadial: 4, tentSegs: 7, tabs: false,
  },
]

/** Camera distance (scene units) beyond which a fish switches to LOD1. */
export const LOD1_DISTANCE = 10
