export default function Ship() {
  return (
    <div className="ship-wrap" aria-hidden="true">
      <svg viewBox="0 0 720 420" className="ship-svg">
        <defs>
          <linearGradient id="metal" x1="10%" y1="0%" x2="90%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="25%" stopColor="#d9f4ff" />
            <stop offset="55%" stopColor="#52678c" />
            <stop offset="100%" stopColor="#070b16" />
          </linearGradient>
          <linearGradient id="wing" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#20365e" />
            <stop offset="45%" stopColor="#eaf8ff" />
            <stop offset="100%" stopColor="#2f6fff" />
          </linearGradient>
          <radialGradient id="cockpit" cx="42%" cy="30%" r="72%">
            <stop offset="0%" stopColor="#36dfff" />
            <stop offset="35%" stopColor="#071228" />
            <stop offset="100%" stopColor="#02040b" />
          </radialGradient>
          <radialGradient id="engine" cx="50%" cy="50%" r="62%">
            <stop offset="0%" stopColor="#fff" />
            <stop offset="35%" stopColor="#42f9ff" />
            <stop offset="70%" stopColor="#b64cff" />
            <stop offset="100%" stopColor="#040611" />
          </radialGradient>
        </defs>

        <g className="ship-core">
          <path d="M360 28 C450 98 500 195 480 302 C438 356 282 356 240 302 C220 195 270 98 360 28 Z" fill="url(#metal)" stroke="#e9fbff" strokeWidth="3" />
          <path d="M360 86 C398 137 414 205 394 247 C374 265 346 265 326 247 C306 205 322 137 360 86 Z" fill="url(#cockpit)" stroke="#88fbff" strokeWidth="3" />
          <path d="M286 200 L58 292 L296 324 L348 265 Z" fill="url(#wing)" stroke="#89faff" strokeWidth="3" />
          <path d="M434 200 L662 292 L424 324 L372 265 Z" fill="url(#wing)" stroke="#89faff" strokeWidth="3" />
          <path d="M124 284 L288 260" stroke="#44f8ff" strokeWidth="2" opacity=".5" />
          <path d="M596 284 L432 260" stroke="#44f8ff" strokeWidth="2" opacity=".5" />
          <ellipse cx="316" cy="332" rx="36" ry="26" fill="#050813" stroke="#8dfcff" strokeWidth="4" />
          <ellipse cx="404" cy="332" rx="36" ry="26" fill="#050813" stroke="#8dfcff" strokeWidth="4" />
          <circle cx="316" cy="332" r="17" fill="url(#engine)" />
          <circle cx="404" cy="332" r="17" fill="url(#engine)" />
          <text x="464" y="283" fill="#26fff1" stroke="#061126" strokeWidth="1.2" fontSize="24" fontWeight="900" transform="rotate(13 464 283)">SPNX</text>
        </g>
      </svg>
    </div>
  );
}
