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
