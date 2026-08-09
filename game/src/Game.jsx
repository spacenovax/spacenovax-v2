import React from 'react';

// The original V4.5 NOVA-X Genesis Defense experience is the canonical game.
// Keep every launch query parameter so the SpaceNovaX app can later pass a
// signed captain session to the upstream game without changing the URL shape.
const CANONICAL_GAME_URL = 'https://nova-x1-genesis-defense.kit372002.chatgpt.site/';

export default function Game() {
  const source = new URL(CANONICAL_GAME_URL);
  const incoming = new URLSearchParams(window.location.search);
  for (const [key, value] of incoming.entries()) source.searchParams.set(key, value);

  return (
    <main className="game-host" aria-label="NOVA-X Genesis Defense">
      <iframe
        title="NOVA-X Genesis Defense"
        src={source.toString()}
        allow="autoplay; fullscreen; gamepad; vibration"
        allowFullScreen
      />
    </main>
  );
}
