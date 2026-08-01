// Orbit Module — Performance Manager. Watches real FPS and flips a low-power mode
// (fewer stars, lower geometry detail, capped pixel ratio) for weaker devices.
// Phase 2: also exposes memory/battery diagnostics and drives MasterRenderLoop's
// animation throttle, instead of running its own requestAnimationFrame loop.
export default class PerformanceManager {
  constructor({ onModeChange, targetFps = 60, sampleMs = 2000 } = {}) {
    this.onModeChange = onModeChange;
    this.targetFps = targetFps;
    this.sampleMs = sampleMs;
    this.lowPower = this._detectInitialLowPower();
    this.frames = 0;
    this.windowStart = performance.now();
    this.lastFps = targetFps;
    this.battery = null;
    this.disposed = false;
    this._batteryUpdate = null;
    if (navigator.getBattery) {
      navigator.getBattery().then((b) => {
        if (this.disposed) return;
        this.battery = b;
        const update = () => { if (b.level < 0.15 && !b.charging && !this.lowPower) { this.lowPower = true; this.onModeChange?.(true); } };
        this._batteryUpdate = update;
        b.addEventListener('levelchange', update);
        b.addEventListener('chargingchange', update);
        update();
      }).catch(() => {});
    }
  }

  _detectInitialLowPower() {
    const cores = navigator.hardwareConcurrency || 4;
    const mem = navigator.deviceMemory || 4;
    const saveData = navigator.connection?.saveData;
    return cores <= 4 || mem <= 4 || Boolean(saveData);
  }

  // Read-only diagnostics; performance.memory is Chrome-only and may be undefined.
  memoryStats() {
    const m = performance.memory;
    if (!m) return null;
    return { usedMb: Math.round(m.usedJSHeapSize / 1048576), limitMb: Math.round(m.jsHeapSizeLimit / 1048576) };
  }

  tick() {
    if (this.disposed) return;
    this.frames += 1;
    const elapsed = performance.now() - this.windowStart;
    if (elapsed >= this.sampleMs) {
      const fps = (this.frames * 1000) / elapsed;
      this.lastFps = fps;
      this.frames = 0;
      this.windowStart = performance.now();
      const shouldBeLow = fps < this.targetFps * 0.55;
      if (shouldBeLow !== this.lowPower) {
        this.lowPower = shouldBeLow;
        this.onModeChange?.(this.lowPower);
      }
    }
  }

  dispose() {
    this.disposed = true;
    if (this.battery && this._batteryUpdate) {
      this.battery.removeEventListener('levelchange', this._batteryUpdate);
      this.battery.removeEventListener('chargingchange', this._batteryUpdate);
    }
    this._batteryUpdate = null;
    this.battery = null;
    this.onModeChange = null;
  }
}
