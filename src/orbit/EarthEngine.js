// Orbit Module — Earth Engine (Three.js).
// Textured day/night Earth (self-hosted satellite basemap) with
// terminator shading, atmosphere glow, drag-to-rotate, wheel/pinch zoom, auto-rotate,
// and screen-space projection for floating HTML marker labels.
import * as THREE from 'three';

const EARTH_RADIUS = 2;
const loader = new THREE.TextureLoader();

// Typhoon swirl texture — a stylized spiral drawn once on a canvas. This is decorative
// (NASA's EONET only gives storm center coordinates, not real cloud-band structure), so
// it's built to READ as a spinning storm system rather than reproduce actual satellite
// imagery of any specific typhoon.
let _swirlTextureCache = null;
let _markerTextureCache = null;

// Soft orbital marker used by weather/event layers. A texture-backed ring avoids the
// flat coloured squares produced by Three.js' default SpriteMaterial.
function createMarkerTexture() {
  if (_markerTextureCache) return _markerTextureCache;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  const center = size / 2;
  const glow = ctx.createRadialGradient(center, center, 0, center, center, center);
  glow.addColorStop(0, 'rgba(255,255,255,1)');
  glow.addColorStop(0.13, 'rgba(255,255,255,0.95)');
  glow.addColorStop(0.28, 'rgba(255,255,255,0.34)');
  glow.addColorStop(0.65, 'rgba(255,255,255,0.08)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(center, center, size * 0.25, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(center, center, size * 0.41, 0, Math.PI * 2);
  ctx.stroke();
  _markerTextureCache = new THREE.CanvasTexture(canvas);
  _markerTextureCache.colorSpace = THREE.SRGBColorSpace;
  return _markerTextureCache;
}
function createSwirlTexture() {
  if (_swirlTextureCache) return _swirlTextureCache;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cx = size / 2, cy = size / 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  for (let arm = 0; arm < 3; arm++) {
    ctx.beginPath();
    const armOffset = (arm / 3) * Math.PI * 2;
    for (let t = 0; t <= 1; t += 0.02) {
      const angle = armOffset + t * Math.PI * 3.2;
      const r = t * (size * 0.46);
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      if (t === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.lineWidth = 5 - arm * 0.8;
    ctx.globalAlpha = 0.85 - arm * 0.15;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // clear "eye" at the center
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.07, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = 'rgba(255,90,90,0.95)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.08, 0, Math.PI * 2);
  ctx.stroke();
  _swirlTextureCache = new THREE.CanvasTexture(canvas);
  return _swirlTextureCache;
}

function lonLatToVector3(lon, lat, radius = EARTH_RADIUS) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

function buildGrid() {
  const group = new THREE.Group();
  // Navigation reference only. Keep this deliberately subtle so the satellite imagery,
  // coastlines and weather layers remain the visual focus.
  const material = new THREE.LineBasicMaterial({ color: 0x71d8ff, transparent: true, opacity: 0.035 });
  for (let lat = -60; lat <= 60; lat += 30) {
    const pts = [];
    for (let lon = -180; lon <= 180; lon += 6) pts.push(lonLatToVector3(lon, lat, EARTH_RADIUS * 1.003));
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), material));
  }
  for (let lon = -180; lon < 180; lon += 30) {
    const pts = [];
    for (let lat = -90; lat <= 90; lat += 6) pts.push(lonLatToVector3(lon, lat, EARTH_RADIUS * 1.003));
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), material));
  }
  return group;
}

const EARTH_VERTEX = `
varying vec3 vWorldNormal;
varying vec3 vWorldPosition;
varying vec2 vUv;
void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const EARTH_FRAGMENT = `
uniform sampler2D dayMap;
uniform sampler2D nightMap;
uniform sampler2D specularMap;
uniform sampler2D cloudMap;
uniform vec3 sunDirection;
uniform float cloudOffset;
uniform float uTime;
varying vec3 vWorldNormal;
varying vec3 vWorldPosition;
varying vec2 vUv;
void main() {
  vec3 normal = normalize(vWorldNormal);
  vec3 sunDir = normalize(sunDirection);
  vec3 viewDir = normalize(cameraPosition - vWorldPosition);
  float light = dot(normal, sunDir);
  // Keep the night side readable on mobile WebViews.  A real globe should retain
  // an ocean/land silhouette even when the current view is facing away from the sun.
  float day = smoothstep(-0.18, 0.22, light);
  float twilight = 1.0 - smoothstep(0.04, 0.28, abs(light));
  vec3 surfaceColor = texture2D(dayMap, vUv).rgb;
  // Restrained satellite-grade colour treatment: preserve deserts, forests, ice and
  // shallow-water detail without the neon/cartoon saturation of the old fallback.
  vec3 dayGray = vec3(dot(surfaceColor, vec3(0.299, 0.587, 0.114)));
  surfaceColor = dayGray + (surfaceColor - dayGray) * 1.12;
  surfaceColor = clamp((surfaceColor - 0.5) * 1.10 + 0.53, 0.0, 1.0);
  vec3 dayColor = surfaceColor;
  dayColor *= 0.72 + max(light, 0.0) * 0.70;
  vec3 nightColor = texture2D(nightMap, vUv).rgb;
  nightColor = pow(max(nightColor, vec3(0.0)), vec3(0.82)) * 0.96;
  // Night-light maps can be very dark (and are sometimes not decoded by an embedded
  // browser).  Blend a low blue ambient version of the day map underneath them so the
  // globe never degrades into a featureless black disk on mobile.
  // Mobile OLED displays and Telegram's WebView crush low blue values.  This is a
  // deliberate night-side floor, based on the full satellite map (before sunlight
  // attenuation), so Earth remains recognisable rather than turning into a black disk.
  vec3 nightAmbient = max(surfaceColor * vec3(0.44, 0.76, 1.18), vec3(0.026, 0.082, 0.175) * 1.65);
  vec3 readableNight = max(nightColor * 1.48, nightAmbient);
  vec3 color = mix(readableNight, dayColor, day);
  color += vec3(0.85, 0.30, 0.08) * twilight * 0.10;

  // Cloud shadow: sample the cloud layer's own alpha at its (independently rotated) UV
  // and darken the surface slightly where clouds sit between it and the sun — cheap,
  // no extra render pass, just a second texture sample in the same shader.
  vec2 cloudUv = vec2(fract(vUv.x + cloudOffset), vUv.y);
  float cloudShadow = texture2D(cloudMap, cloudUv).r;
  color *= 1.0 - cloudShadow * 0.20 * day;

  // Ocean specular glint: soft, tight highlight (not mirror-like) masked to water only.
  // An earlier animated "sparkle" perturbation caused visible diagonal streak artifacts
  // at low sun angles and was removed.
  vec3 halfDir = normalize(sunDir + viewDir);
  float specAngle = max(dot(normal, halfDir), 0.0);
  float oceanMask = texture2D(specularMap, vUv).r;
  float specular = pow(specAngle, 92.0) * oceanMask * day;
  color += vec3(0.72, 0.88, 1.0) * specular * 0.48;

  // Aurora — faint animated green/blue glow near the poles, on the night side only.
  // Uses vUv.y (true latitude, pole-to-pole) rather than the view-space normal, so the
  // aurora band stays fixed at the actual poles regardless of how the globe is rotated.
  float latDist = abs(vUv.y - 0.5) * 2.0;
  float poleness = smoothstep(0.82, 0.97, latDist);
  float auroraFlicker = 0.6 + 0.4 * sin(uTime * 0.8 + vUv.x * 30.0);
  float aurora = poleness * (1.0 - day) * auroraFlicker * 0.10;
  vec3 auroraColor = mix(vec3(0.1, 0.95, 0.55), vec3(0.25, 0.55, 1.0), sin(uTime * 0.3) * 0.5 + 0.5);
  color += auroraColor * aurora;

  // Rim light: thin blue atmospheric edge glow (Fresnel), separate from the outer
  // atmosphere shell — reads as light scattering right at the horizon on the globe itself.
  float rim = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.6);
  float sunRim = 0.35 + 0.65 * smoothstep(-0.3, 0.45, light);
  color += vec3(0.12, 0.48, 0.92) * rim * 0.16 * sunRim;

  gl_FragColor = vec4(color, 1.0);
}`;

const ATMOSPHERE_VERTEX = `
varying vec3 vWorldNormal;
varying vec3 vWorldPosition;
void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const ATMOSPHERE_FRAGMENT = `
uniform vec3 sunDirection;
varying vec3 vWorldNormal;
varying vec3 vWorldPosition;
void main() {
  vec3 normal = normalize(vWorldNormal);
  vec3 viewDir = normalize(cameraPosition - vWorldPosition);
  float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.1);
  float sunlight = smoothstep(-0.35, 0.45, dot(normal, normalize(sunDirection)));
  vec3 atmosphere = mix(vec3(0.08, 0.22, 0.70), vec3(0.20, 0.72, 1.0), sunlight);
  gl_FragColor = vec4(atmosphere, fresnel * (0.17 + 0.24 * sunlight));
}`;

export default class EarthEngine {
  constructor(container, { lowPower = false, onTextureQualityChange } = {}) {
    this.container = container;
    this.lowPower = lowPower;
    this.onTextureQualityChange = onTextureQualityChange;
    this.textureQuality = '4K';
    this._detailLoadStarted = false;
    this.markerLayers = new Map();
    this._labelTargets = new Map(); // id -> { lat, lon, onUpdate }
    this._buildScene();
    this._bindInteraction();
    // Phase 2: rendering is driven externally by MasterRenderLoop via renderFrame() —
    // this class no longer schedules its own requestAnimationFrame.
  }

  _buildScene() {
    const { clientWidth: w, clientHeight: h } = this.container;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    this.camera.position.set(0, 0, 8.3); // ~35% smaller apparent globe size, more space visible around it
    this.renderer = new THREE.WebGLRenderer({ antialias: !this.lowPower, alpha: true });
    this.renderer.setPixelRatio(this.lowPower ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w, h);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    // A little extra exposure is essential on OLED phones where the night-side shader
    // otherwise gets crushed to black even though the texture decoded correctly.
    this.renderer.toneMappingExposure = this.lowPower ? 1.38 : 1.32;
    this.container.appendChild(this.renderer.domElement);

    this.sunDirection = new THREE.Vector3(1, 0.3, 0.4).normalize();

    // All globe assets are self-hosted under /public/orbit. The NASA Blue Marble
    // surface map is bundled locally so a real, sharp globe is available even inside
    // Telegram's restricted mobile WebView.
    const placeholder = (hex) => {
      const c = document.createElement('canvas'); c.width = 2; c.height = 1;
      const ctx = c.getContext('2d'); ctx.fillStyle = hex; ctx.fillRect(0, 0, 2, 1);
      return new THREE.CanvasTexture(c);
    };
    // These are intentionally visible fallbacks, not black.  Telegram and older mobile
    // WebViews can render a frame before a large WebP texture is decoded.
    const dayPlaceholder = placeholder('#2e94bd');
    const nightPlaceholder = placeholder('#1c5b92');
    const blackPlaceholder = placeholder('#000000');
    const earthGeo = new THREE.SphereGeometry(EARTH_RADIUS, this.lowPower ? 48 : 96, this.lowPower ? 32 : 64);
    this.earthMaterial = new THREE.ShaderMaterial({
      uniforms: { sunDirection: { value: this.sunDirection }, dayMap: { value: dayPlaceholder }, nightMap: { value: nightPlaceholder }, specularMap: { value: blackPlaceholder }, cloudMap: { value: blackPlaceholder }, cloudOffset: { value: 0 }, uTime: { value: 0 } },
      vertexShader: EARTH_VERTEX,
      fragmentShader: EARTH_FRAGMENT,
    });
    const prepareTexture = (tex, { srgb = false } = {}) => {
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.anisotropy = Math.min(16, this.renderer.capabilities.getMaxAnisotropy());
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
      return tex;
    };
    loader.load('/orbit/earth-day-real.webp', (tex) => {
      this.baseDayTexture = prepareTexture(tex, { srgb: true });
      this.earthMaterial.uniforms.dayMap.value = this.baseDayTexture;
      this._announceTextureQuality('4K');
    }, undefined, (err) => console.error('Orbit: 4K Earth texture failed.', err));
    loader.load('/orbit/earth-night.jpg', (tex) => {
      this.earthMaterial.uniforms.nightMap.value = prepareTexture(tex, { srgb: true });
    }, undefined, (err) => console.error('Orbit: validated night texture failed.', err));
    this.earth = new THREE.Mesh(earthGeo, this.earthMaterial);
    this.scene.add(this.earth);
    this.navigationGrid = buildGrid();
    this.earth.add(this.navigationGrid);

    // Orbit is a navigation map, not a cinematic space scene.  Do not add an
    // atmosphere shell: it can blue-wash coastlines and city lights on mobile OLEDs.

    // Cloud layer — a slightly larger sphere with a translucent cloud texture, rotating
    // independently and a bit faster than the surface (real clouds drift relative to
    // the ground). Adds real visual weight/realism beyond a flat land/ocean texture.
    const cloudGeo = new THREE.SphereGeometry(EARTH_RADIUS * 1.009, this.lowPower ? 40 : 72, this.lowPower ? 28 : 48);
    this.cloudMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: this.lowPower ? 0.22 : 0.31,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    this.clouds = new THREE.Mesh(cloudGeo, this.cloudMaterial);
    // Never put an untextured white shell over Earth. It becomes visible only after a
    // valid cloud texture is decoded successfully.
    this.clouds.visible = false;
    this.earth.add(this.clouds);
    loader.load(
      '/orbit/earth-clouds-real.webp',
      (tex) => {
        prepareTexture(tex, { srgb: true });
        this.cloudMaterial.map = tex;
        this.cloudMaterial.needsUpdate = true;
        this.earthMaterial.uniforms.cloudMap.value = tex;
        this.clouds.visible = true;
      },
      undefined,
      (err) => console.warn('Orbit: cloud texture failed to load — globe still renders without clouds.', err),
    );
    loader.load(
      '/orbit/earth-water-mask.webp',
      (tex) => { this.earthMaterial.uniforms.specularMap.value = prepareTexture(tex); },
      undefined,
      (err) => console.warn('Orbit: ocean specular map failed to load — globe still renders without water glint.', err),
    );

    const stars = new THREE.BufferGeometry();
    const starCount = this.lowPower ? 500 : 1400;
    const positions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const r = 30 + Math.random() * 20;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }
    stars.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.scene.add(new THREE.Points(stars, new THREE.PointsMaterial({ color: 0xffffff, size: 0.05, sizeAttenuation: true })));

    this.autoRotate = true;
    this.rotation = { lon: 20, lat: 12 };
    this._flight = null;
    this._applyRotation();
  }

  _applyRotation() {
    this.earth.rotation.y = (this.rotation.lon * Math.PI) / 180;
    this.earth.rotation.x = (this.rotation.lat * Math.PI) / 180;
  }

  _bindInteraction() {
    const el = this.renderer.domElement;
    let dragging = false;
    let last = { x: 0, y: 0 };
    let pinchDist = null;
    const onDown = (x, y) => { dragging = true; this.autoRotate = false; last = { x, y }; };
    const onMove = (x, y) => {
      if (!dragging) return;
      const dx = x - last.x; const dy = y - last.y;
      this.rotation.lon += dx * 0.3;
      this.rotation.lat = Math.max(-85, Math.min(85, this.rotation.lat - dy * 0.3));
      last = { x, y };
      this._applyRotation();
    };
    const onUp = () => { dragging = false; };
    el.addEventListener('pointerdown', (e) => onDown(e.clientX, e.clientY));
    window.addEventListener('pointermove', (e) => onMove(e.clientX, e.clientY));
    window.addEventListener('pointerup', onUp);
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.zoomBy(e.deltaY * 0.003);
    }, { passive: false });
    el.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2) {
        const [a, b] = e.touches;
        const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        if (pinchDist != null) this.zoomBy((pinchDist - d) * 0.01);
        pinchDist = d;
      }
    }, { passive: true });
    el.addEventListener('touchend', () => { pinchDist = null; });

    // Double-tap to zoom in (mobile UX item — spec 8)
    let lastTapAt = 0;
    el.addEventListener('touchend', (e) => {
      if (e.changedTouches?.length !== 1) return;
      const now = performance.now();
      if (now - lastTapAt < 300) this.zoomBy(-1.1);
      lastTapAt = now;
    });

    this._resizeHandler = () => {
      const { clientWidth: w, clientHeight: h } = this.container;
      if (!w || !h) return;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    };
    window.addEventListener('resize', this._resizeHandler);
  }

  zoomBy(delta) {
    this.camera.position.z = Math.max(2.9, Math.min(9, this.camera.position.z + delta));
    this._updateTextureLOD();
  }
  _announceTextureQuality(value) {
    this.textureQuality = value;
    this.onTextureQualityChange?.(value);
  }
  _loadDetailTexture() {
    if (this._detailLoadStarted || this.detailDayTexture) return;
    this._detailLoadStarted = true;
    this._announceTextureQuality('8K · LOADING');
    new THREE.TextureLoader().load('/orbit/earth-day-8k.jpg', (tex) => {
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.anisotropy = Math.min(16, this.renderer.capabilities.getMaxAnisotropy());
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
      this.detailDayTexture = tex;
      this._detailLoadStarted = false;
      this._updateTextureLOD();
    }, undefined, (err) => {
      this._detailLoadStarted = false;
      this._announceTextureQuality('4K');
      console.warn('Orbit: optional 8K Earth texture failed; staying on 4K.', err);
    });
  }
  _updateTextureLOD() {
    if (!this.earthMaterial || !this.renderer) return;
    const wantsDetail = this.camera.position.z <= 4.6;
    const supports8K = this.renderer.capabilities.maxTextureSize >= 8192;
    if (wantsDetail && supports8K && !this.detailDayTexture) this._loadDetailTexture();
    if (wantsDetail && this.detailDayTexture) {
      this.earthMaterial.uniforms.dayMap.value = this.detailDayTexture;
      this._announceTextureQuality('8K · DETAIL');
    } else if (!wantsDetail && this.baseDayTexture) {
      this.earthMaterial.uniforms.dayMap.value = this.baseDayTexture;
      this._announceTextureQuality('4K');
    } else if (wantsDetail && !supports8K) {
      this._announceTextureQuality('4K · DEVICE LIMIT');
    }
  }
  recenter() {
    this.autoRotate = false;
    const from = { lon: this.rotation.lon, lat: this.rotation.lat };
    const target = { lon: 20, lat: 12 };
    let deltaLon = ((target.lon - from.lon + 540) % 360) - 180;
    this._flight = { t0: performance.now(), duration: 900, from, deltaLon, deltaLat: target.lat - from.lat };
    this.camera.position.z = 8.3;
    this._updateTextureLOD();
  }
  setAutoRotate(value) { this.autoRotate = value; }
  toggleAutoRotate() { this.autoRotate = !this.autoRotate; return this.autoRotate; }

  // --- Camera State Machine (lite): idle -> flying -> arrived. No instant teleports —
  // every camera move to a location eases over `duration`ms. Cancels any move in flight.
  get cameraState() { return this._flight ? 'flying' : 'idle'; }

  flyTo(lat, lon, { duration = 900, onArrive } = {}) {
    this.autoRotate = false;
    const targetLon = -lon - 90; // convert target lon to the rotation.lon frame used by _applyRotation
    const targetLat = Math.max(-85, Math.min(85, lat));
    const from = { lon: this.rotation.lon, lat: this.rotation.lat };
    // shortest angular path for longitude
    let deltaLon = ((targetLon - from.lon + 540) % 360) - 180;
    this._flight = { t0: performance.now(), duration, from, deltaLon, deltaLat: targetLat - from.lat, onArrive };
  }

  _stepFlight(time) {
    if (!this._flight) return;
    const { t0, duration, from, deltaLon, deltaLat, onArrive } = this._flight;
    const p = Math.min(1, (time - t0) / duration);
    const eased = 1 - (1 - p) * (1 - p) * (1 - p); // ease-out cubic
    this.rotation.lon = from.lon + deltaLon * eased;
    this.rotation.lat = from.lat + deltaLat * eased;
    this._applyRotation();
    if (p >= 1) { this._flight = null; onArrive?.(); }
  }

  // --- Route arc: great-circle line between two lat/lon points, slightly raised above
  // the surface, plus a small pulsing marker that travels along it.
  setRoute(from, to) {
    this.clearRoute();
    if (!from || !to) return;
    const A = lonLatToVector3(from.lon, from.lat, EARTH_RADIUS).normalize();
    const B = lonLatToVector3(to.lon, to.lat, EARTH_RADIUS).normalize();
    const angle = A.angleTo(B);
    const steps = 64;
    const points = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const sinAngle = Math.sin(angle) || 1e-6;
      const w1 = Math.sin((1 - t) * angle) / sinAngle;
      const w2 = Math.sin(t * angle) / sinAngle;
      const p = A.clone().multiplyScalar(w1).add(B.clone().multiplyScalar(w2)).normalize();
      const lift = 1 + 0.09 * Math.sin(Math.PI * t); // arc bulge
      points.push(p.multiplyScalar(EARTH_RADIUS * lift));
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineDashedMaterial({ color: 0x53e7ff, dashSize: 0.06, gapSize: 0.04, transparent: true, opacity: 0.85 });
    const line = new THREE.Line(geometry, material);
    line.computeLineDistances();
    this._routeGroup = new THREE.Group();
    this._routeGroup.add(line);
    const markerGeo = new THREE.SphereGeometry(0.028, 12, 12);
    const marker = new THREE.Mesh(markerGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
    this._routeGroup.add(marker);
    this._routePoints = points;
    this._routeMarker = marker;
    this.earth.add(this._routeGroup);
  }

  setRoadRoute(routePoints) {
    this.clearRoute();
    if (!Array.isArray(routePoints) || routePoints.length < 2) return;
    const stride = Math.max(1, Math.ceil(routePoints.length / 220));
    const points = routePoints.filter((_, index) => index % stride === 0 || index === routePoints.length - 1).map((point) => lonLatToVector3(point.lon, point.lat, EARTH_RADIUS * 1.008));
    if (points.length < 2) return;
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: 0x5cecff, transparent: true, opacity: 0.94 }));
    this._routeGroup = new THREE.Group(); this._routeGroup.add(line);
    const marker = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 12), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    this._routeGroup.add(marker); this._routePoints = points; this._routeMarker = marker; this.earth.add(this._routeGroup);
  }

  clearRoute() {
    if (this._routeGroup) { this.earth.remove(this._routeGroup); this._routeGroup = null; this._routePoints = null; this._routeMarker = null; }
  }

  // Real storm/typhoon tracks — draws each event's actual recorded path (from NASA
  // EONET's per-observation geometry history) as a thin curved line above the surface,
  // with a small marker at its most recent known position. `tracks` is an array of
  // { id, color, points: [{lat, lon}, ...] } in chronological order.
  setEventTracks(tracks) {
    if (this._trackGroup) { this.earth.remove(this._trackGroup); this._trackGroup = null; }
    if (!tracks || !tracks.length) return;
    this._trackGroup = new THREE.Group();
    tracks.forEach((track) => {
      if (!track.points || track.points.length < 2) return;
      const pts = track.points.map((p) => lonLatToVector3(p.lon, p.lat, EARTH_RADIUS * 1.004));
      const geometry = new THREE.BufferGeometry().setFromPoints(pts);
      const material = new THREE.LineBasicMaterial({ color: track.color ?? 0xff6b6b, transparent: true, opacity: 0.75 });
      this._trackGroup.add(new THREE.Line(geometry, material));
      const headGeo = new THREE.SphereGeometry(0.022, 10, 10);
      const head = new THREE.Mesh(headGeo, new THREE.MeshBasicMaterial({ color: track.color ?? 0xff6b6b }));
      head.position.copy(pts[pts.length - 1]);
      this._trackGroup.add(head);
    });
    this.earth.add(this._trackGroup);
  }

  clearEventTracks() {
    if (this._trackGroup) { this.earth.remove(this._trackGroup); this._trackGroup = null; }
  }

  _stepRouteMarker(time) {
    if (!this._routePoints || !this._routeMarker) return;
    const t = (Math.sin(time * 0.0007) + 1) / 2; // ping-pong 0..1
    const idx = Math.min(this._routePoints.length - 1, Math.floor(t * (this._routePoints.length - 1)));
    this._routeMarker.position.copy(this._routePoints[idx]);
  }

  setSunFromDate(date = new Date()) {
    const hours = date.getUTCHours() + date.getUTCMinutes() / 60;
    const lon = 180 - hours * 15;
    const v = lonLatToVector3(lon, 10, 1);
    this.sunDirection.copy(v).normalize();
  }

  // Face the currently sunlit hemisphere on load, so the globe never opens on a dark,
  // hard-to-read view — the real day/night terminator still lights the sphere correctly
  // once rotated, this only picks a flattering starting angle.
  faceSunlitSide(date = new Date()) {
    const hours = date.getUTCHours() + date.getUTCMinutes() / 60;
    const subSolarLon = 180 - hours * 15;
    this.rotation.lon = -subSolarLon - 90;
    this.rotation.lat = 12;
    this._applyRotation();
  }

  setMarkerLayer(name, markers, { size = 0.045, color = 0x53e7ff } = {}) {
    let layer = this.markerLayers.get(name);
    if (!layer) {
      const group = new THREE.Group();
      this.earth.add(group);
      layer = { group, sprites: new Map() };
      this.markerLayers.set(name, layer);
    }
    const markerTexture = createMarkerTexture();
    const seen = new Set();
    markers.forEach((m) => {
      seen.add(m.id);
      let sprite = layer.sprites.get(m.id);
      if (!sprite) {
        const material = new THREE.SpriteMaterial({
          map: markerTexture,
          color: m.color || color,
          transparent: true,
          opacity: 0.92,
          depthTest: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        });
        sprite = new THREE.Sprite(material);
        const markerSize = m.size || size;
        sprite.userData.baseSize = markerSize;
        sprite.userData.pulseSeed = Math.random() * Math.PI * 2;
        sprite.scale.set(markerSize, markerSize, 1);
        layer.group.add(sprite);
        layer.sprites.set(m.id, sprite);
      }
      sprite.material.color.setHex(m.color || color);
      sprite.position.copy(lonLatToVector3(m.lon, m.lat, EARTH_RADIUS * 1.02));
    });
    [...layer.sprites.keys()].forEach((id) => {
      if (!seen.has(id)) { layer.group.remove(layer.sprites.get(id)); layer.sprites.delete(id); }
    });
  }

  clearMarkerLayer(name) {
    const layer = this.markerLayers.get(name);
    if (!layer) return;
    layer.sprites.forEach((s) => layer.group.remove(s));
    layer.sprites.clear();
  }

  // Lightweight 3D satellite model — a small box "bus" body with two thin solar-panel
  // wings, all built from primitive Three.js geometry (no external model file to load,
  // stays cheap). Reused/repositioned across updates the same way sprite markers are.
  _buildSatelliteModel(color) {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshBasicMaterial({ color: 0xdfe6ec });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.018, 0.028), bodyMat);
    group.add(body);
    const panelMat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.92 });
    const panelGeo = new THREE.PlaneGeometry(0.05, 0.016);
    const panelL = new THREE.Mesh(panelGeo, panelMat);
    panelL.position.x = -0.034;
    const panelR = new THREE.Mesh(panelGeo, panelMat);
    panelR.position.x = 0.034;
    group.add(panelL, panelR);
    return group;
  }

  setSatelliteLayer3D(markers, { color = 0x53e7ff } = {}) {
    const name = 'satellite3d';
    let layer = this.markerLayers.get(name);
    if (!layer) {
      const group = new THREE.Group();
      this.earth.add(group);
      layer = { group, sprites: new Map() };
      this.markerLayers.set(name, layer);
    }
    const seen = new Set();
    markers.forEach((m) => {
      seen.add(m.id);
      let model = layer.sprites.get(m.id);
      if (!model) {
        model = this._buildSatelliteModel(m.color || color);
        layer.group.add(model);
        layer.sprites.set(m.id, model);
      }
      const pos = lonLatToVector3(m.lon, m.lat, EARTH_RADIUS * 1.035);
      model.position.copy(pos);
      model.lookAt(pos.clone().multiplyScalar(2)); // orient body outward from the surface
    });
    [...layer.sprites.keys()].forEach((id) => {
      if (!seen.has(id)) { layer.group.remove(layer.sprites.get(id)); layer.sprites.delete(id); }
    });
  }

  // Typhoon "eye" swirl — decorative, animated spinning spiral at each typhoon's current
  // position (see createSwirlTexture note: not real storm-structure imagery).
  setTyphoonSwirls(points) {
    if (!this._swirlGroup) { this._swirlGroup = new THREE.Group(); this.earth.add(this._swirlGroup); this._swirlSprites = new Map(); }
    const seen = new Set();
    const texture = createSwirlTexture();
    points.forEach((p) => {
      seen.add(p.id);
      let sprite = this._swirlSprites.get(p.id);
      if (!sprite) {
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0.85, depthTest: false });
        sprite = new THREE.Sprite(material);
        sprite.scale.set(0.16, 0.16, 1);
        this._swirlGroup.add(sprite);
        this._swirlSprites.set(p.id, sprite);
      }
      sprite.position.copy(lonLatToVector3(p.lon, p.lat, EARTH_RADIUS * 1.025));
    });
    [...this._swirlSprites.keys()].forEach((id) => {
      if (!seen.has(id)) { this._swirlGroup.remove(this._swirlSprites.get(id)); this._swirlSprites.delete(id); }
    });
  }

  _stepTyphoonSwirls(time) {
    if (!this._swirlSprites) return;
    this._swirlSprites.forEach((sprite) => { sprite.material.rotation = time * 0.0006; });
  }

  // --- Floating HTML label projection ---
  // Register a set of {id, lat, lon} points; onFrame(id -> {x,y,visible}) is called every frame.
  setLabelTargets(points) { this._labelTargets = points; }
  setLabelCallback(cb) { this._labelCallback = cb; }

  _projectLabels() {
    if (!this._labelCallback || !this._labelTargets?.length) return;
    const { clientWidth: w, clientHeight: h } = this.container;
    if (!w || !h) return;
    const cameraWorldPos = this.camera.position.clone();
    const out = {};
    this._labelTargets.forEach((pt) => {
      const local = lonLatToVector3(pt.lon, pt.lat, EARTH_RADIUS * 1.02);
      const world = local.clone().applyMatrix4(this.earth.matrixWorld);
      const normal = world.clone().normalize();
      const toCamera = cameraWorldPos.clone().normalize();
      const visible = normal.dot(toCamera) > 0.08;
      const proj = world.clone().project(this.camera);
      const x = (proj.x * 0.5 + 0.5) * w;
      const y = (-proj.y * 0.5 + 0.5) * h;
      // HTML marker overlays use this value to scale their icon and switch between
      // compact and expanded labels. It is derived from the camera only, so marker
      // labels stay legible without changing navigation or Earth interaction logic.
      const zoomProgress = (9 - this.camera.position.z) / (9 - 2.9);
      out[pt.id] = {
        x,
        y,
        visible: visible && proj.z < 1,
        scale: 0.76 + Math.max(0, Math.min(1, zoomProgress)) * 0.58,
        expanded: zoomProgress > 0.31,
      };
    });
    this._labelCallback(out);
  }

  // Called once per frame by MasterRenderLoop (Phase 2: single shared render loop).
  renderFrame(time = performance.now()) {
    if (this._flight) this._stepFlight(time);
    else if (this.autoRotate) { this.rotation.lon += 0.04; this._applyRotation(); }
    if (this.clouds) {
      const delta = 0.00035;
      this.clouds.rotation.y += delta;
      this._cloudOffset = (this._cloudOffset || 0) + delta / (Math.PI * 2);
      this.earthMaterial.uniforms.cloudOffset.value = this._cloudOffset;
    }
    this.earthMaterial.uniforms.uTime.value = time * 0.001;
    this.markerLayers.forEach((layer) => {
      layer.sprites.forEach((marker) => {
        if (!marker.isSprite || !marker.userData.baseSize) return;
        const pulse = 1 + Math.sin(time * 0.003 + marker.userData.pulseSeed) * 0.12;
        const markerSize = marker.userData.baseSize * pulse;
        marker.scale.set(markerSize, markerSize, 1);
      });
    });
    this._stepRouteMarker(time);
    this._stepTyphoonSwirls(time);
    this.earthMaterial.uniforms.sunDirection.value.copy(this.sunDirection);
    this.renderer.render(this.scene, this.camera);
    this._projectLabels();
  }

  dispose() {
    window.removeEventListener('resize', this._resizeHandler);
    this.renderer.dispose();
    this.baseDayTexture?.dispose();
    this.detailDayTexture?.dispose();
    if (this.renderer.domElement.parentNode) this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
  }
}
