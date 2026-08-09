import React, { useEffect, useMemo, useRef } from 'react';

const CANONICAL_GAME_URL = 'https://nova-x1-genesis-defense.kit372002.chatgpt.site/';
const CANONICAL_GAME_ORIGIN = new URL(CANONICAL_GAME_URL).origin;
const TRUSTED_APP_ORIGINS = new Set([
  'https://app.spacenovax.com',
  'https://spacenovax-v2.onrender.com',
]);

function trustedAppOrigin(value) {
  try {
    const origin = new URL(value || '').origin;
    return TRUSTED_APP_ORIGINS.has(origin) ? origin : '';
  } catch {
    return '';
  }
}

// This page is a security boundary: it is the only component that may relay
// messages between the SpaceNovaX app and the canonical V4.5 game.
export default function Game() {
  const frameRef = useRef(null);
  const incoming = useMemo(() => new URLSearchParams(window.location.search), []);
  const appOrigin = useMemo(() => trustedAppOrigin(incoming.get('api')), [incoming]);
  const source = useMemo(() => {
    const url = new URL(CANONICAL_GAME_URL);
    for (const [key, value] of incoming.entries()) url.searchParams.set(key, value);
    url.searchParams.set('parentOrigin', window.location.origin);
    return url.toString();
  }, [incoming]);

  useEffect(() => {
    if (!appOrigin) return undefined;
    const relay = (event) => {
      const frame = frameRef.current?.contentWindow;
      if (!frame) return;
      if (event.origin === appOrigin && event.source === window.parent) {
        frame.postMessage(event.data, CANONICAL_GAME_ORIGIN);
        return;
      }
      if (event.origin === CANONICAL_GAME_ORIGIN && event.source === frame) {
        window.parent.postMessage(event.data, appOrigin);
      }
    };
    window.addEventListener('message', relay);
    return () => window.removeEventListener('message', relay);
  }, [appOrigin]);

  return (
    <main className="game-host" aria-label="NOVA-X Genesis Defense">
      <iframe
        ref={frameRef}
        title="NOVA-X Genesis Defense"
        src={source}
        allow="autoplay; fullscreen; gamepad; vibration"
        allowFullScreen
        onLoad={() => {
          if (appOrigin) window.parent.postMessage({ type: 'SPACENOVAX_GAME_BRIDGE_READY', version: 1 }, appOrigin);
        }}
      />
    </main>
  );
}
