# AFTERBURN — Blue Angels 3D

Next.js + Three.js visualization of the **October 8, 2026** ADS-B Exchange KML recording of aircraft `~2B1518` over San Francisco Bay.

## Run and validate

Use Node.js 22.6 or newer (the tests use Node's built-in TypeScript stripping).

```bash
npm ci
npm run dev
npm test
npm run typecheck
npm run build
```

Open http://localhost:3000. No map key or environment variables are required. This branch does not deploy or change production.

## Controls

- **CINEMATIC** tracks the aircraft with a moving camera; **FREE EXPLORE** enables drag to orbit, right drag to pan, and scroll/pinch to zoom.
- Pause, scrub or restart the recording, change playback speed, and jump to three potential low-pass windows.
- A thin amber route persists behind the aircraft. A wider additive halo fades over **90 seconds of recording time**; pausing freezes the fade, and seeking reconstructs it deterministically. **Show entire route** adds a subdued preview of future segments without rebuilding the scene or downloading the map again.

## Imagery and geography

- Esri World Imagery loads progressively as separate **zoom 13** tiles (eight times the linear resolution of the previous zoom 10 map). Anisotropic filtering improves detail at oblique camera angles. It is opaque and sits above the fallback chart rather than beneath opaque land polygons.
- Satellite UVs and the route share geographic coordinates. Tiles are subdivided into 32 × 32 cells and draped over **zoom 12 Terrarium elevation** from Mapzen's AWS open terrain dataset. Coastal hills and islands have real relief; sea/bathymetric elevations are rendered at sea level.
- Golden Gate and the western Bay Bridge span have simplified, georeferenced decks, towers and cables. These are visual approximations, not engineering models. The fallback coastline is schematic.
- At most six tile jobs run concurrently. Requests time out, successful tiles remain after partial failures, status shows actual tile coverage, and unmount cancels pending work and disposes GPU resources. Offline imagery/elevation failures retain the fallback coastal chart. External network access is required for map data and Google Fonts.
- On-map attribution credits imagery and elevation providers. Sources: [Esri World Imagery](https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer), [AWS Terrain Tiles](https://registry.opendata.aws/terrain-tiles/), [Terrarium format](https://github.com/tilezen/joerd/blob/master/docs/formats.md).

## Recording fidelity and visual effects

- `public/flight.json` is unchanged, including all **674** recorded points, duplicate timestamps and negative altitude readings. The render view copies the 664 distinct timestamps without editing the recording. When timestamps coincide, the last fix at that timestamp wins in the render view.
- Shape-preserving cubic interpolation passes through every distinct recorded fix and avoids coordinate/altitude overshoot. Telemetry uses linear interpolation of source values; smoothing is confined to rendering.
- Intervals longer than **30 seconds** hold the last recorded position, hide the aircraft, show **DATA GAP**, and break both persistent and fading trails. No flight is invented across missing observations.
- The stylized F/A-18 has Blue Angels blue/gold paint, swept wings, a canopy, twin engines and canted twin fins. Its nose points along local **−Z**; heading and pitch follow the smoothed track tangent, and bank follows turns. Exhaust and wing vapor are illustrative effects based on derived horizontal ground speed, not playback rate or measured engine/atmospheric conditions.
- Aircraft size is enlarged for regional-map visibility. Flight and terrain heights use **×2 visual exaggeration**; negative flight heights are clamped above the water only in the rendered position. The source-altitude readout preserves negative values and displays EGM96 metres converted to feet. Erroneous altitude fixes can still intersect terrain; no source corrections are applied.
- Exactly **one aircraft** is included. This is not a formation replay. Candidate low passes are **unverified**, not confirmed sneak passes. The visualization is not for navigation.
