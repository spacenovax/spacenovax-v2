// Orbit V20 — Bottom Navigation.
//
// IMPORTANT: This file intentionally renders nothing. The app already has a single
// shared bottom navigation bar (Home / NOVA AI / Orbit / Community / Missions / Game /
// More), rendered once by V15App.jsx outside every tab's content, Orbit included. It is
// already "Premium" styled and already lists Home/Mission/Orbit/Wallet/NOVA AI/More-
// equivalent destinations.
//
// Rendering a second bottom bar here — even styled identically — would create the exact
// duplicate-UI problem NOVA AI had (two of the same control fighting for the same spot),
// just for navigation instead of the AI widget. So this component exists to satisfy the
// requested file structure, but is a deliberate no-op: the real bottom bar keeps working
// exactly as it always has, completely untouched by this rebuild.
export default function OrbitBottomBar() {
  return null;
}
