// Orbit Module — Master Render Loop (Phase 2).
// A single requestAnimationFrame driver shared by everything that needs to render
// or tick every frame inside Orbit (Earth Engine, Performance Manager, label
// projection, future layers). Nothing else should call requestAnimationFrame
// directly inside the Orbit module — register a task here instead.
//
// Also owns "Hidden Tab Pause": the loop stops entirely while the tab/app is in
// the background, and resumes on return, so no GPU/CPU work happens off-screen.
class MasterRenderLoop {
  constructor() {
    this.tasks = new Map(); // id -> fn(timeMs)
    this._raf = null;
    this._frameSkip = 1;
    this._frameCount = 0;
    this._paused = false;
    this._tick = this._tick.bind(this);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') this._pause();
        else this._resume();
      });
    }
  }

  add(id, fn) {
    this.tasks.set(id, fn);
    this._ensureRunning();
  }

  remove(id) {
    this.tasks.delete(id);
    if (!this.tasks.size) this._stop();
  }

  // Animation Throttle: 1 = every frame (60fps target), 2 = every other frame, etc.
  setFrameSkip(n) {
    this._frameSkip = Math.max(1, Math.round(n));
  }

  _ensureRunning() {
    if (this._raf != null || this._paused) return;
    this._raf = requestAnimationFrame(this._tick);
  }

  _pause() {
    this._paused = true;
    if (this._raf != null) { cancelAnimationFrame(this._raf); this._raf = null; }
  }

  _resume() {
    this._paused = false;
    if (this.tasks.size) this._ensureRunning();
  }

  _stop() {
    if (this._raf != null) cancelAnimationFrame(this._raf);
    this._raf = null;
  }

  _tick(time) {
    this._raf = requestAnimationFrame(this._tick);
    this._frameCount += 1;
    if (this._frameCount % this._frameSkip !== 0) return;
    this.tasks.forEach((fn) => {
      try { fn(time); } catch (error) { console.error('MasterRenderLoop task error:', error); }
    });
  }
}

// Module singleton: one loop for the whole Orbit module.
export default new MasterRenderLoop();
