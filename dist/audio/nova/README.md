# NOVA local voice cues

This folder is intentionally local-only and contains no API key or remote audio
generation. Add licensed MP3 or WAV clips with these names to enable immediate
event playback before the browser Speech Synthesis fallback:

- `welcome-captain.mp3`
- `mining-started.mp3`, `mining-completed.mp3`
- `wallet-connected.mp3`, `mission-complete.mp3`
- `navigation-ready.mp3`, `connection-lost.mp3`
- `game-started.mp3`, `enemy-detected.mp3`, `shield-activated.mp3`

If a clip is not present, NOVA uses the free built-in browser voice. Gemini is
never used to create or play voice audio.
