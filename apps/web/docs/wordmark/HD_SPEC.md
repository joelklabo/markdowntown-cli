# Living City Wordmark HD Spec

## Objective
Deliver a higher-detail voxel wordmark at default voxel scale = 3, while preserving crisp pixel edges and stable silhouettes.

## Grid + Layout
- Base glyph grid: `CITY_WORDMARK_GLYPH_ROWS x CITY_WORDMARK_GLYPH_COLS` (see `src/components/wordmark/sim/glyphs.ts`).
- HD resolution multiplier: 3x (default `render.voxelScale = 3`).
- Scene width: `layout.sceneWidth = layout.width * render.bannerScale`.
- Top padding: 4 voxels (multiplied by resolution).
- Letter spacing: 1 voxel (multiplied by resolution).

## Silhouette + Shading Rules
- Wordmark silhouette should stay readable at 1x and 3x.
- Use 2-tone building fill:
  - primary building tone for glyph bodies
  - muted building tone for skyline/backdrop
- Avoid thin 1-voxel spikes at 3x that alias into noise.
- Shadows/inner cuts should be at least 2 voxels wide at 3x.

## Window Grid Density
- Window density scales with resolution (lower chance as resolution increases).
- Target 25-35% lit windows at night in dense areas.
- Keep window sizes at 1 voxel; treat lit windows as specular highlights.
- Avoid aligning windows directly on glyph edges to preserve outline legibility.

## Actors (Vehicles, People, Dogs, Lights, Ambulance)
- Render actors with 3x detail variants:
  - Car: 2-row body + 1-2 voxel roof + 1 voxel headlight
  - Truck: cab + trailer separation, 2-row body, headlight
  - Ambulance: siren lights (red/blue) 1 voxel each, preserve pulse cadence
  - Pedestrians: 2-3 voxel body + 1 voxel head
  - Dogs: 2 voxels body length minimum
  - Streetlights: 1 voxel bulb + 1-2 voxel post when resolution >= 3
- Keep actor heights within skyline baseline + 2 voxels.

## Celestial (Sun / Moon / Stars)
- Sun: 2x2 or 3x3 voxel core at 3x with 1-voxel rays.
- Moon: 2x2 core with 1-voxel cut-out for crescent.
- Stars: 1 voxel, sparse; scale placement with scene width.

## Contrast + Readability
- Ensure wordmark glyphs remain 3:1 contrast vs sky in both light/dark themes.
- Use window glow to increase readability at night without flattening the silhouette.
- Avoid palette pairs with near-equal luminance.

## Performance Constraints
- Avoid per-frame allocations that scale with full scene width.
- Keep total actor rect count < 500 at default density.
- Prefer precomputed rects for skyline + glyphs; animate actors only.

## Crisp Edge Requirements
- `shape-rendering: crispEdges` stays enabled for SVG.
- Voxels must align to integer grid; no subpixel transforms.
- Avoid fractional scaling in CSS on the SVG container.
