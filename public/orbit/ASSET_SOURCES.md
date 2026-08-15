# Earth visual asset notice

The optimized Earth textures used by Orbit Control are self-hosted derivatives of the
EarthJS example globe assets (`earthjs@0.7.143`, MIT license):

- `earth-day-nasa.jpg` — NASA Earth Observatory Blue Marble, 2048px true-colour global composite
- `earth-day-8k.jpg` — 8192 × 4096 NASA Blue Marble composite, JPEG-optimized for zoom-only detail loading. Public-domain NASA imagery; redistributed from the Wikimedia Commons preservation copy: <https://commons.wikimedia.org/wiki/File:Land_ocean_ice_cloud_hires.jpg>
- `earth-day-4k.jpg` — validated 4096 × 2048 Lanczos derivative of the same NASA source, used as the normal Orbit surface after the safe 2K first paint.

- `earth-day-real.webp` — legacy asset retained for package compatibility; not loaded because the archived copy is truncated
- `earth-night-real.webp` — optimized from `world_night_3.jpg`
- `earth-clouds-real.webp` — legacy asset retained for package compatibility; not loaded because the archived copy is truncated
- `earth-water-mask.webp` — optimized from `earth_water.png`

Source repository: <https://github.com/earthjs/earthjs>

NASA source: <https://earthobservatory.nasa.gov/features/BlueMarble/BlueMarble_2002.php>

The files are bundled locally so the Telegram WebView and mobile browsers do not depend
on third-party cross-origin texture requests at runtime.

## On-demand NASA satellite view

When the Captain selects `SATELLITE`, Orbit requests the latest available
`MODIS_Terra_CorrectedReflectance_TrueColor` global scene from NASA Global Imagery
Browse Services (GIBS). The app relays and caches a 2048 × 1024 WMS image for ten
minutes, and the UI credits `NASA GIBS · MODIS Terra` with the resolved UTC date.
This is an observed true-colour satellite scene with cloud cover, not an invented
storm texture. It is intended for situational viewing only; road navigation and
safety decisions must not rely on it as an official weather-warning service.

GIBS / Worldview source: <https://earthdata.nasa.gov/eosdis/science-system-description/eosdis-components/gibs>
