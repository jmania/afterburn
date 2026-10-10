# AFTERBURN — Blue Angels 3D

Next.js + Three.js cinematic 3D visualization of the **October 8, 2026** ADS-B Exchange KML recording of aircraft `~2B1518`.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000. Publish to Vercel by importing this repository, or run `npm run build` and deploy on any Next.js-capable host.

## Controls

- **CINEMATIC** — automatically tracks the aircraft and animates orbit, pitch, pan, and zoom.
- **FREE EXPLORE** — left drag rotates; right drag pans; scroll/pinch zooms.
- Scrub the 65-minute timeline, pause, change playback speed, jump to three potential low-pass windows, and toggle the full route.
- Satellite imagery is attempted with ArcGIS World Imagery on first load. If unavailable, the 3D stylized coastal chart and aircraft path still render. Online access required for both imagery and Google Fonts.

## Notes

- Exactly **one aircraft** is included; this is not a full Blue Angels formation replay.
- Identified low-pass windows are **candidates, not confirmed sneak passes**.
- Altitude is from KML EGM96 and is **visually exaggerated** relative to horizontal distance, intentionally; the reported altitude number is unmodified geometric altitude.
- There may be erroneous or missing altitude fixes in the source. The route may jump across data gaps.
- Stylized coastline is schematic (for orientation, not precision navigation). Satellite background, if available, is a geographic overlay.
