// Orbit Module — Earth Engine (Three.js).
// Textured day/night Earth (self-hosted satellite basemap) with
// terminator shading, atmosphere glow, drag-to-rotate, wheel/pinch zoom, auto-rotate,
// and screen-space projection for floating HTML marker labels.
import * as THREE from 'three';

const EARTH_RADIUS = 2;
const CAMERA_MIN_DISTANCE = 2.9;
const CAMERA_DEFAULT_DISTANCE = 8.3;
// Mobile needs a wider observatory framing: it keeps the whole Earth, satellite paths
// and storm markers inside the Telegram viewport instead of cropping the lower globe.
const CAMERA_MOBILE_DEFAULT_DISTANCE = 12.7;
const CAMERA_MAX_DISTANCE = 18; // twice the previous far-zoom limit (9)
const LABEL_REFERENCE_DISTANCE = 9;
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
  // A higher-resolution procedural cloud eye keeps named storm markers crisp on a
  // desktop 4K/8K view without downloading a per-storm image feed.
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cx = size / 2, cy = size / 2;
  const halo = ctx.createRadialGradient(cx, cy, size * 0.03, cx, cy, size * 0.5);
  halo.addColorStop(0, 'rgba(255,255,255,0.06)');
  halo.addColorStop(0.38, 'rgba(255,218,192,0.16)');
  halo.addColorStop(0.75, 'rgba(255,114,86,0.09)');
  halo.addColorStop(1, 'rgba(255,114,86,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, size, size);
  ctx.lineCap = 'round';
  for (let arm = 0; arm < 4; arm++) {
    ctx.beginPath();
    const armOffset = (arm / 4) * Math.PI * 2;
    for (let t = 0; t <= 1; t += 0.012) {
      const angle = armOffset + t * Math.PI * 3.45;
      const r = size * (0.045 + Math.pow(t, 0.82) * 0.42);
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      if (t === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    const armShade = ctx.createLinearGradient(cx, cy, cx + Math.cos(armOffset) * size * 0.48, cy + Math.sin(armOffset) * size * 0.48);
    armShade.addColorStop(0, 'rgba(255,255,255,0.94)');
    armShade.addColorStop(0.45, 'rgba(255,238,222,0.82)');
    armShade.addColorStop(1, 'rgba(255,145,112,0.22)');
    ctx.strokeStyle = armShade;
    ctx.lineWidth = 10 - arm * 1.2;
    ctx.globalAlpha = 0.82 - arm * 0.11;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // Clear, high-contrast eye at the center.
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.075, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = 'rgba(255,178,127,0.96)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.088, 0, Math.PI * 2);
  ctx.stroke();
  _swirlTextureCache = new THREE.CanvasTexture(canvas);
  _swirlTextureCache.colorSpace = THREE.SRGBColorSpace;
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
  constructor(container, { lowPower = false, onTextureQualityChange, onSatelliteLayerChange } = {}) {
    this.container = container;
    this.lowPower = lowPower;
    const coarsePointer = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
    this.isTouchDevice = coarsePointer || (typeof navigator !== 'undefined' && Number(navigator.maxTouchPoints || 0) > 0);
    this.defaultCameraDistance = this.isTouchDevice ? CAMERA_MOBILE_DEFAULT_DISTANCE : CAMERA_DEFAULT_DISTANCE;
    this.onTextureQualityChange = onTextureQualityChange;
    this.onSatelliteLayerChange = onSatelliteLayerChange;
    this.textureQuality = '4K';
    this._detailLoadStarted = false;
    this._satelliteRequestId = 0;
    this.satelliteLayer = { enabled: false, loading: false, texture: null, date: '' };
    this._disposed = false;
    this._gestureActive = false;
    this._gestureRestoreTimer = null;
    this._autoRotateResumeTimer = null;
    this._renderPixelRatio = 0;
    this._interactionHandlers = null;
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
    this.camera.position.set(0, 0, this.defaultCameraDistance);
    this.renderer = new THREE.WebGLRenderer({ antialias: !this.lowPower, alpha: true, powerPreference: this.lowPower ? 'default' : 'high-performance' });
    this._setRenderResolution();
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
    this._prepareTexture = prepareTexture;
    // Always establish a known-good 2K surface first. The previous 4K WebP was a
    // truncated file whose header advertised 4096px even though browsers could not
    // decode its pixels, leaving only the blue placeholder and night lights visible.
    // The validated 4K derivative is loaded only after this safety texture succeeds.
    loader.load('/orbit/earth-day-nasa.jpg', (fallback) => {
      this.fallbackDayTexture = prepareTexture(fallback, { srgb: true });
      if (!this.satelliteLayer.enabled) {
        this.earthMaterial.uniforms.dayMap.value = this.fallbackDayTexture;
        this._announceTextureQuality('2K · SAFE');
      }
      loader.load('/orbit/earth-day-4k.jpg', (tex) => {
        this.baseDayTexture = prepareTexture(tex, { srgb: true });
        if (!this.satelliteLayer.enabled) {
          this.earthMaterial.uniforms.dayMap.value = this.baseDayTexture;
          this._announceTextureQuality('4K');
          this._updateTextureLOD();
        }
      }, undefined, (err) => {
        this._announceTextureQuality('2K · SAFE');
        console.warn('Orbit: optional 4K Earth texture failed; staying on validated 2K.', err);
      });
    }, undefined, (err) => console.error('Orbit: safe 2K Earth texture failed.', err));
    loader.load('/orbit/earth-night.jpg', (tex) => {
      this.earthMaterial.uniforms.nightMap.value = prepareTexture(tex, { srgb: true });
    }, undefined, (err) => console.error('Orbit: validated night texture failed.', err));
    this.earth = new THREE.Mesh(earthGeo, this.earthMaterial);
    this.scene.add(this.earth);
    // Keep the satellite surface clean. The former latitude/longitude overlay read as a checkerboard at close zoom, so navigation coordinates stay in the HUD only.
    this.navigationGrid = null;

    // Orbit is a navigation map, not a cinematic space scene.  Do not add an
    // atmosphere shell: it can blue-wash coastlines and city lights on mobile OLEDs.

    // The validated NASA day maps already contain true-colour cloud cover. Keep the
    // optional shell disabled: the old cloud WebP is also truncated and double clouds
    // reduce coastline contrast.
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

  _desiredPixelRatio() {
    const deviceRatio = Math.min(window.devicePixelRatio || 1, 2);
    if (this.lowPower) return 1;
    // The map returns to full Retina quality after the gesture. During an active
    // touch gesture we draw fewer pixels, preventing Telegram WebView from falling
    // behind while it is receiving two streams of pointer events.
    if (this.isTouchDevice && this._gestureActive) return Math.min(deviceRatio, 1.35);
    return deviceRatio;
  }

  _setRenderResolution() {
    if (!this.renderer) return;
    const ratio = this._desiredPixelRatio();
    if (Math.abs(ratio - this._renderPixelRatio) < 0.01) return;
    this._renderPixelRatio = ratio;
    this.renderer.setPixelRatio(ratio);
    const { clientWidth: w, clientHeight: h } = this.container;
    if (w && h) this.renderer.setSize(w, h, false);
  }

  _setGestureActive(active) {
    if (this._gestureActive === active) return;
    this._gestureActive = active;
    this._setRenderResolution();
  }

  _resumeAutoRotateAfter(delay = 1800) {
    if (this._autoRotateResumeTimer) clearTimeout(this._autoRotateResumeTimer);
    this._autoRotateResumeTimer = setTimeout(() => {
      this._autoRotateResumeTimer = null;
      if (!this._flight) this.autoRotate = true;
    }, delay);
  }

  setPerformanceMode(lowPower) {
    const next = Boolean(lowPower);
    if (this.lowPower === next) return;
    this.lowPower = next;
    this._setRenderResolution();
  }

  _bindInteraction() {
    const el = this.renderer.domElement;
    const pointers = new Map();
    let dragPointerId = null;
    let last = { x: 0, y: 0 };
    let pinchDistance = null;
    let hadMultiTouch = false;
    let lastTapAt = 0;
    const pointerDistance = () => {
      const [a, b] = [...pointers.values()];
      return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : null;
    };
    const beginGesture = () => {
      this.autoRotate = false;
      this._flight = null;
      if (this._gestureRestoreTimer) clearTimeout(this._gestureRestoreTimer);
      this._gestureRestoreTimer = null;
      this._setGestureActive(true);
    };
    const finishGesture = () => {
      if (pointers.size) return;
      if (this._gestureRestoreTimer) clearTimeout(this._gestureRestoreTimer);
      this._gestureRestoreTimer = setTimeout(() => {
        this._gestureRestoreTimer = null;
        this._setGestureActive(false);
        // Manual rotation remains responsive, then the live globe returns to its
        // slow observatory rotation when the user releases the screen.
        this._resumeAutoRotateAfter();
      }, 120);
    };
    const onPointerDown = (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      event.preventDefault();
      try { el.setPointerCapture(event.pointerId); } catch { /* pointer capture is optional */ }
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, moved: false });
      beginGesture();
      if (pointers.size === 1) {
        dragPointerId = event.pointerId;
        last = { x: event.clientX, y: event.clientY };
        pinchDistance = null;
        hadMultiTouch = false;
      } else if (pointers.size === 2) {
        dragPointerId = null;
        hadMultiTouch = true;
        pinchDistance = pointerDistance();
      }
    };
    const onPointerMove = (event) => {
      const previous = pointers.get(event.pointerId);
      if (!previous) return;
      event.preventDefault();
      if (Math.hypot(event.clientX - previous.x, event.clientY - previous.y) > 3) previous.moved = true;
      previous.x = event.clientX;
      previous.y = event.clientY;
      if (pointers.size >= 2) {
        const distance = pointerDistance();
        if (distance != null && pinchDistance != null) this.zoomBy((pinchDistance - distance) * 0.0075);
        pinchDistance = distance;
        return;
      }
      if (dragPointerId !== event.pointerId) return;
      const dx = event.clientX - last.x;
      const dy = event.clientY - last.y;
      this.rotation.lon += dx * 0.3;
      this.rotation.lat = Math.max(-85, Math.min(85, this.rotation.lat - dy * 0.3));
      last = { x: event.clientX, y: event.clientY };
      this._applyRotation();
    };
    const endPointer = (event) => {
      const pointer = pointers.get(event.pointerId);
      if (!pointer) return;
      const wasTap = event.pointerType === 'touch' && pointers.size === 1 && !hadMultiTouch && !pointer.moved;
      pointers.delete(event.pointerId);
      try { el.releasePointerCapture(event.pointerId); } catch { /* capture may already be released */ }
      if (pointers.size === 1) {
        const [pointerId, remaining] = [...pointers.entries()][0];
        dragPointerId = pointerId;
        last = { x: remaining.x, y: remaining.y };
        pinchDistance = null;
      } else if (!pointers.size) {
        dragPointerId = null;
        pinchDistance = null;
        hadMultiTouch = false;
        finishGesture();
      }
      if (wasTap) {
        const now = performance.now();
        if (now - lastTapAt < 300) this.zoomBy(-1.1);
        lastTapAt = now;
      }
    };
    const onWheel = (event) => {
      event.preventDefault();
      this.autoRotate = false;
      this._flight = null;
      this.zoomBy(event.deltaY * 0.003);
      this._resumeAutoRotateAfter();
    };
    this._interactionHandlers = { el, onPointerDown, onPointerMove, endPointer, onWheel };
    el.addEventListener('pointerdown', onPointerDown, { passive: false });
    el.addEventListener('pointermove', onPointerMove, { passive: false });
    el.addEventListener('pointerup', endPointer);
    el.addEventListener('pointercancel', endPointer);
    el.addEventListener('lostpointercapture', endPointer);
    el.addEventListener('wheel', onWheel, { passive: false });

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
    this.camera.position.z = Math.max(CAMERA_MIN_DISTANCE, Math.min(CAMERA_MAX_DISTANCE, this.camera.position.z + delta));
    this._updateTextureLOD();
  }
  _announceTextureQuality(value) {
    if (this.textureQuality === value) return;
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
      this._announceTextureQuality(this.baseDayTexture ? '4K' : '2K · SAFE');
      console.warn('Orbit: optional 8K Earth texture failed; staying on 4K.', err);
    });
  }
  _updateTextureLOD() {
    if (!this.earthMaterial || !this.renderer) return;
    // NASA's near-real-time satellite scene deliberately replaces the bundled
    // basemap while it is enabled.  Do not let an asynchronous 4K/8K base-map
    // load overwrite the real observation a moment after the user turns it on.
    if (this.satelliteLayer?.enabled && this.satelliteLayer.texture) {
      this.earthMaterial.uniforms.dayMap.value = this.satelliteLayer.texture;
      this._announceTextureQuality('NASA · SATELLITE');
      return;
    }
    const wantsDetail = this.camera.position.z <= 4.6;
    const supports8K = this.renderer.capabilities.maxTextureSize >= 8192;
    if (wantsDetail && supports8K && !this.detailDayTexture) this._loadDetailTexture();
    if (wantsDetail && this.detailDayTexture) {
      this.earthMaterial.uniforms.dayMap.value = this.detailDayTexture;
      this._announceTextureQuality('8K · DETAIL');
    } else if (!wantsDetail && (this.baseDayTexture || this.fallbackDayTexture)) {
      this.earthMaterial.uniforms.dayMap.value = this.baseDayTexture || this.fallbackDayTexture;
      this._announceTextureQuality(this.baseDayTexture ? '4K' : '2K · SAFE');
    } else if (wantsDetail && !supports8K) {
      this._announceTextureQuality(this.baseDayTexture ? '4K · DEVICE LIMIT' : '2K · DEVICE LIMIT');
    }
  }

  // The NASA GIBS endpoint is relayed by our server so every mobile client uses
  // a same-origin, short-lived cache rather than hot-linking a public data service.
  // Its true-colour surface contains the latest available observed cloud cover;
  // it is a satellite-view mode, not a fabricated cloud animation.
  setSatelliteImagery(enabled, { date } = {}) {
    const observing = Boolean(enabled);
    const sourceDate = /^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))
      ? String(date)
      : new Date().toISOString().slice(0, 10);

    // A daily polar-orbit composite can contain incomplete swaths. Applying one
    // directly as an equirectangular globe texture creates black wedges on mobile
    // devices, so it must never replace the validated base Earth surface.
    ++this._satelliteRequestId;
    if (this.satelliteLayer.texture) {
      this.satelliteLayer.texture.dispose();
      this.satelliteLayer.texture = null;
    }
    this.satelliteLayer.enabled = false;
    this.satelliteLayer.loading = false;
    this.satelliteLayer.date = observing ? sourceDate : '';
    this._updateTextureLOD();
    this.onSatelliteLayerChange?.({
      enabled: observing,
      status: observing ? 'ready' : 'idle',
      date: observing ? sourceDate : '',
      safeBaseGlobe: true,
    });
  }
  recenter() {
    this.autoRotate = false;
    const from = { lon: this.rotation.lon, lat: this.rotation.lat };
    const target = { lon: 20, lat: 12 };
    let deltaLon = ((target.lon - from.lon + 540) % 360) - 180;
    this._flight = { t0: performance.now(), duration: 900, from, deltaLon, deltaLat: target.lat - from.lat, onArrive: () => { this.autoRotate = true; } };
    this.camera.position.z = this.defaultCameraDistance;
    this._updateTextureLOD();
  }
  setAutoRotate(value) { this.autoRotate = value; }
  toggleAutoRotate() { this.autoRotate = !this.autoRotate; return this.autoRotate; }

  // --- Camera State Machine (lite): idle -> flying -> arrived. No instant teleports —
  // every camera move to a location eases over `duration`ms. Cancels any move in flight.
  get cameraState() { return this._flight ? 'flying' : 'idle'; }

  flyTo(lat, lon, { duration = 900, onArrive } = {}) {
    // Never allow an invalid GPS value to poison the camera rotation. A NaN
    // rotation makes the WebGL canvas appear as a black screen in mobile webviews.
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
    this.autoRotate = false;
    const targetLon = -lon - 90; // convert target lon to the rotation.lon frame used by _applyRotation
    const targetLat = Math.max(-85, Math.min(85, lat));
    // Recover an already-corrupted camera state before calculating the flight.
    // Telegram WebView can otherwise retain NaN rotation values after a failed frame.
    const from = {
      lon: Number.isFinite(this.rotation.lon) ? this.rotation.lon : -90,
      lat: Number.isFinite(this.rotation.lat) ? this.rotation.lat : 0,
    };
    this.rotation.lon = from.lon;
    this.rotation.lat = from.lat;
    // shortest angular path for longitude
    let deltaLon = ((targetLon - from.lon + 540) % 360) - 180;
    this._flight = { t0: performance.now(), duration: Math.max(0, Number(duration) || 900), from, deltaLon, deltaLat: targetLat - from.lat, onArrive };
    return true;
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

  // Shared 3D model for every public satellite position.  Do not fall back to a tiny
  // billboard at far globe positions: the bus, solar wings, antenna mast and dish are
  // all geometry, so ISS, stations and satellite families keep the same design as the
  // Earth rotates.  The palette is mirrored by OrbitEarthView's HTML labels.
  _buildSatelliteModel(color) {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshBasicMaterial({ color: 0xeafaff });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.032, 0.052), bodyMat);
    group.add(body);
    const panelMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.96 });
    const panelGeo = new THREE.BoxGeometry(0.095, 0.024, 0.006);
    const panelL = new THREE.Mesh(panelGeo, panelMat);
    panelL.position.x = -0.066;
    panelL.rotation.y = 0.16;
    const panelR = new THREE.Mesh(panelGeo, panelMat);
    panelR.position.x = 0.066;
    panelR.rotation.y = -0.16;
    group.add(panelL, panelR);
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.004, 0.004, 0.035, 8),
      new THREE.MeshBasicMaterial({ color: 0x8ed9ef })
    );
    mast.rotation.x = Math.PI / 2;
    mast.position.z = 0.04;
    group.add(mast);
    const dish = new THREE.Mesh(
      new THREE.SphereGeometry(0.014, 12, 8),
      new THREE.MeshBasicMaterial({ color: 0x8df4ff })
    );
    dish.scale.set(1, 0.45, 1);
    dish.position.set(0, 0.018, 0.061);
    group.add(dish);
    group.userData.satellitePhase = Math.random() * Math.PI * 2;
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
        // A storm on the far side of Earth must be hidden by the globe.  Turning
        // depth testing off makes the sprite show through the sphere while it is
        // rotated, which reads like an orange afterimage on mobile.
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0.85, depthTest: true, depthWrite: false });
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
      const zoomProgress = (LABEL_REFERENCE_DISTANCE - this.camera.position.z) / (LABEL_REFERENCE_DISTANCE - CAMERA_MIN_DISTANCE);
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
    // A calm but clearly visible live observatory rotation (about 1.3× the former rate).
    else if (this.autoRotate) { this.rotation.lon += 0.016; this._applyRotation(); }
    if (this.clouds) {
      const delta = 0.00035;
      this.clouds.rotation.y += delta;
      this._cloudOffset = (this._cloudOffset || 0) + delta / (Math.PI * 2);
      this.earthMaterial.uniforms.cloudOffset.value = this._cloudOffset;
    }
    this.earthMaterial.uniforms.uTime.value = time * 0.001;
    this.markerLayers.forEach((layer) => {
      layer.sprites.forEach((marker) => {
        if (marker.isSprite && marker.userData.baseSize) {
          const pulse = 1 + Math.sin(time * 0.003 + marker.userData.pulseSeed) * 0.12;
          const markerSize = marker.userData.baseSize * pulse;
          marker.scale.set(markerSize, markerSize, 1);
        }
        // A restrained panel sweep makes each 3D satellite feel live without changing
        // its public orbital position or turning it into a distracting animation.
        if (marker.userData.satellitePhase != null) {
          marker.rotation.z = Math.sin(time * 0.00055 + marker.userData.satellitePhase) * 0.12;
        }
      });
    });
    this._stepRouteMarker(time);
    this._stepTyphoonSwirls(time);
    this.earthMaterial.uniforms.sunDirection.value.copy(this.sunDirection);
    this.renderer.render(this.scene, this.camera);
    this._projectLabels();
  }

  dispose() {
    this._disposed = true;
    this._satelliteRequestId += 1;
    window.removeEventListener('resize', this._resizeHandler);
    if (this._gestureRestoreTimer) clearTimeout(this._gestureRestoreTimer);
    if (this._autoRotateResumeTimer) clearTimeout(this._autoRotateResumeTimer);
    if (this._interactionHandlers) {
      const { el, onPointerDown, onPointerMove, endPointer, onWheel } = this._interactionHandlers;
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', endPointer);
      el.removeEventListener('pointercancel', endPointer);
      el.removeEventListener('lostpointercapture', endPointer);
      el.removeEventListener('wheel', onWheel);
      this._interactionHandlers = null;
    }
    this.renderer.dispose();
    this.fallbackDayTexture?.dispose();
    this.baseDayTexture?.dispose();
    this.detailDayTexture?.dispose();
    this.satelliteLayer?.texture?.dispose();
    if (this.renderer.domElement.parentNode) this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
  }
}
