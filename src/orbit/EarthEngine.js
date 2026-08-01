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
  // Physically plausible, soft day/night terminator.
  float day = smoothstep(-0.12, 0.18, light);
  float twilight = 1.0 - smoothstep(0.04, 0.28, abs(light));
  vec3 dayColor = texture2D(dayMap, vUv).rgb;
  // Restrained satellite-grade colour treatment: preserve deserts, forests, ice and
  // shallow-water detail without the neon/cartoon saturation of the old fallback.
  vec3 dayGray = vec3(dot(dayColor, vec3(0.299, 0.587, 0.114)));
  dayColor = dayGray + (dayColor - dayGray) * 1.12;
  dayColor = clamp((dayColor - 0.5) * 1.05 + 0.5, 0.0, 1.0);
  dayColor *= 0.42 + max(light, 0.0) * 0.72;
  vec3 nightColor = texture2D(nightMap, vUv).rgb;
  nightColor = pow(nightColor, vec3(0.82)) * 0.72;
  vec3 color = mix(nightColor, dayColor, day);
  color += vec3(0.85, 0.30, 0.08) * twilight * 0.10;

  // Cloud shadow: sample the cloud layer's own alpha at its (independently rotated) UV
  // and darken the surface slightly where clouds sit between it and the sun — cheap,
  // no extra render pass, just a second texture sample in the same shader.
  vec2 cloudUv = vec2(fract(vUv.x + cloudOffset), vUv.y);
  float cloudShadow = texture2D(cloudMap, cloudUv).r;
  color *= 1.0 - cloudShadow * 0.28 * day;

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
  constructor(container, { lowPower = false } = {}) {
    this.container = container;
    this.lowPower = lowPower;
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
    this.renderer.toneMappingExposure = 1.08;
    this.container.appendChild(this.renderer.domElement);

    this.sunDirection = new THREE.Vector3(1, 0.3, 0.4).normalize();

    // All globe assets are self-hosted under /public/orbit. The previous implementation
    // depended on third-party URLs; mobile WebViews frequently blocked those requests and
    // displayed the blue placeholder seen in production screenshots.
    const placeholder = (hex) => {
      const c = document.createElement('canvas'); c.width = 2; c.height = 1;
      const ctx = c.getContext('2d'); ctx.fillStyle = hex; ctx.fillRect(0, 0, 2, 1);
      return new THREE.CanvasTexture(c);
    };
    const dayPlaceholder = placeholder('#0a3d62');
    const nightPlaceholder = placeholder('#05070c');
    const earthGeo = new THREE.SphereGeometry(EARTH_RADIUS, this.lowPower ? 48 : 96, this.lowPower ? 32 : 64);
    this.earthMaterial = new THREE.ShaderMaterial({
      uniforms: { sunDirection: { value: this.sunDirection }, dayMap: { value: dayPlaceholder }, nightMap: { value: nightPlaceholder }, specularMap: { value: nightPlaceholder }, cloudMap: { value: nightPlaceholder }, cloudOffset: { value: 0 }, uTime: { value: 0 } },
      vertexShader: EARTH_VERTEX,
      fragmentShader: EARTH_FRAGMENT,
    });
    const prepareTexture = (tex, { srgb = false } = {}) => {
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
      if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
      return tex;
    };
    loader.load('/orbit/earth-day-real.webp', (tex) => {
      this.earthMaterial.uniforms.dayMap.value = prepareTexture(tex, { srgb: true });
    }, undefined, (err) => console.error('Orbit: bundled day texture failed.', err));
    loader.load('/orbit/earth-night-real.webp', (tex) => {
      this.earthMaterial.uniforms.nightMap.value = prepareTexture(tex, { srgb: true });
    }, undefined, (err) => console.error('Orbit: bundled night texture failed.', err));
    this.earth = new THREE.Mesh(earthGeo, this.earthMaterial);
    this.scene.add(this.earth);
    this.navigationGrid = buildGrid();
    this.earth.add(this.navigationGrid);

    const atmosphereGeo = new THREE.SphereGeometry(EARTH_RADIUS * 1.035, 48, 48);
    this.atmosphereMaterial = new THREE.ShaderMaterial({
      uniforms: { sunDirection: { value: this.sunDirection } },
      vertexShader: ATMOSPHERE_VERTEX,
      fragmentShader: ATMOSPHERE_FRAGMENT,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
    });
    const atmosphere = new THREE.Mesh(atmosphereGeo, this.atmosphereMaterial);
    this.scene.add(atmosphere);

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
    this.earth.add(this.clouds);
    loader.load(
      '/orbit/earth-clouds-real.webp',
      (tex) => {
        prepareTexture(tex, { srgb: true });
        this.cloudMaterial.map = tex;
        this.cloudMaterial.needsUpdate = true;
        this.earthMaterial.uniforms.cloudMap.value = tex;
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
    const pointerDown = (e) => onDown(e.clientX, e.clientY);
    const pointerMove = (e) => onMove(e.clientX, e.clientY);
    const wheel = (e) => {
      e.preventDefault();
      this.zoomBy(e.deltaY * 0.003);
    };
    const touchMove = (e) => {
      if (e.touches.length === 2) {
        const [a, b] = e.touches;
        const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        if (pinchDist != null) this.zoomBy((pinchDist - d) * 0.01);
        pinchDist = d;
      }
    };
    const touchEnd = () => { pinchDist = null; };

    // Double-tap to zoom in (mobile UX item — spec 8)
    let lastTapAt = 0;
    const doubleTap = (e) => {
      if (e.changed