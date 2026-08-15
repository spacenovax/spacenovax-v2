// Small, dependency-free PWA bridge for the public NOVA Guided Navigation Lite
// experience.  It intentionally keeps installation separate from Telegram
// mining: browser installation is available only to the public web route.
let initialized = false;
let installPrompt = null;
let installed = false;
const listeners = new Set();

function isStandalone() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)')?.matches
    || window.navigator?.standalone === true;
}

function isIos() {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent || '');
}

function snapshot() {
  return {
    available: Boolean(installPrompt),
    installed,
    ios: isIos(),
  };
}

function publish() {
  const state = snapshot();
  listeners.forEach((listener) => listener(state));
}

export function initializePwa() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;
  installed = isStandalone();

  window.addEventListener('beforeinstallprompt', (event) => {
    // Keep the prompt user-triggered.  Automatic browser prompts are disruptive
    // when someone simply opens a route or uses a low-end phone.
    event.preventDefault();
    installPrompt = event;
    publish();
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    installPrompt = null;
    publish();
  });

  if ('serviceWorker' in navigator && window.isSecureContext) {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      // Navigation remains usable online when a host does not expose service
      // workers (for example an embedded preview URL).
    });
  }
}

export function getPwaInstallState() {
  return snapshot();
}

export function subscribePwaInstall(listener) {
  listeners.add(listener);
  listener(snapshot());
  return () => listeners.delete(listener);
}

export async function requestPwaInstall() {
  if (installed) return { outcome: 'installed' };
  if (!installPrompt) return { outcome: 'manual', ios: isIos() };

  const prompt = installPrompt;
  installPrompt = null;
  publish();
  try {
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice?.outcome === 'accepted') {
      return { outcome: 'accepted' };
    }
    return { outcome: 'dismissed' };
  } catch {
    return { outcome: 'manual', ios: isIos() };
  }
}
