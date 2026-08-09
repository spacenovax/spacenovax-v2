import React, { useEffect, useMemo, useRef, useState } from 'react';

const W = 540;
const H = 960;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const params = new URLSearchParams(window.location.search);
const session = params.get('session') || '';
const apiBase = (params.get('api') || import.meta.env.VITE_APP_API_URL || '').replace(/\/$/, '');

async function claimReward(rewardType, reward, score) {
  if (!session || !apiBase) return { practice: true, message: 'Practice mode — open this game from the SpaceNovaX app to record rewards.' };
  const response = await fetch(`${apiBase}/api/game/reward`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session, eventId: crypto.randomUUID(), rewardType, reward, score }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok === false) throw new Error(payload.message || 'Reward verification failed.');
  return payload;
}

export default function Game() {
  const canvasRef = useRef(null);
  const stateRef = useRef(null);
  const [mode, setMode] = useState('ready');
  const [run, setRun] = useState(0);
  const [hud, setHud] = useState({ score: 0, hp: 100, stage: 1, diamonds: 0, boss: 0 });
  const [notice, setNotice] = useState(session ? 'Captain link secured. Rewards will be verified by SpaceNovaX.' : 'Practice mode — no account reward link.');
  const rewardText = useMemo(() => session ? '300 diamonds +10 ×2 · first boss +5 · daily max 30' : 'Launch from the SpaceNovaX app to activate points.', []);

  const reward = async (type, amount, score) => {
    try {
      setNotice('Verifying reward with SpaceNovaX…');
      const result = await claimReward(type, amount, score);
      setNotice(result.practice ? result.message : result.reward > 0 ? `SERVER VERIFIED · +${result.reward} SPNX` : (result.message || 'Daily reward limit reached.'));
    } catch (error) {
      setNotice(error.message);
    }
  };

  useEffect(() => {
    if (mode !== 'playing') return undefined;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let raf = 0, stopped = false, last = performance.now(), spawn = 0, bossClock = 0, hudClock = 0, dragging = false;
    const keys = new Set();
    const s = {
      score: 0, hp: 100, stage: 1, diamonds: 0, lastDiamondReward: 0, bossAwarded: false,
      ship: { x: W / 2, y: H - 110, target: W / 2, shield: 0, power: 1, tilt: 0 },
      bullets: [], enemies: [], enemyBullets: [], drops: [], particles: [], stars: [], boss: null, lastShot: 0, dead: false,
    };
    stateRef.current = s;
    for (let i = 0; i < 155; i += 1) s.stars.push({ x: Math.random() * W, y: Math.random() * H, v: 35 + Math.random() * 130, z: .5 + Math.random() * 2, a: .25 + Math.random() * .75 });
    const burst = (x, y, color = '#ff5f79', count = 18) => { for (let i = 0; i < count; i += 1) { const angle = Math.random() * Math.PI * 2, speed = 35 + Math.random() * 300; s.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: .35 + Math.random() * .8, color, r: 2 + Math.random() * 4 }); } };
    const collision = (a, b, radius) => Math.hypot(a.x - b.x, a.y - b.y) < radius;
    const spawnFormation = () => { const count = 5 + Math.min(4, s.stage); for (let i = 0; i < count; i += 1) { const elite = i % 4 === 0 && s.stage > 1, x = 68 + i * ((W - 136) / Math.max(1, count - 1)); s.enemies.push({ x, base: x, y: -65 - Math.abs(i - (count - 1) / 2) * 28, hp: elite ? 5 : 2, r: elite ? 30 : 23, v: 88 + s.stage * 13 + Math.random() * 32, phase: Math.random() * 6.28, elite, shot: .8 + Math.random() * 2 }); } };
    const spawnBoss = () => { s.boss = { x: W / 2, y: -140, target: 170, hp: 170 + s.stage * 40, max: 170 + s.stage * 40, phase: 0, shot: .7 }; setNotice('WARNING · ENEMY FLAGSHIP DETECTED'); navigator.vibrate?.([110, 50, 120]); };
    const addDrop = (x, y) => { const roll = Math.random(); s.drops.push({ x, y, type: roll < .72 ? 'diamond' : roll < .84 ? 'power' : roll < .93 ? 'shield' : 'heal', v: 115, rot: 0 }); };
    const fire = () => { const time = performance.now(), delay = s.ship.power > 1 ? 95 : 145; if (time - s.lastShot < delay) return; s.lastShot = time; (s.ship.power > 2 ? [-20, 0, 20] : s.ship.power === 2 ? [-13, 13] : [0]).forEach((dx) => s.bullets.push({ x: s.ship.x + dx, y: s.ship.y - 48, vx: dx * .7, vy: -740, damage: s.ship.power > 2 ? 2 : 1 })); };
    const finish = () => { if (s.dead) return; s.dead = true; burst(s.ship.x, s.ship.y, '#ff4e73', 90); navigator.vibrate?.([160, 70, 220]); setTimeout(() => { if (!stopped) setMode('gameover'); }, 650); };
    const update = (dt) => {
      s.stage = 1 + Math.floor(s.score / 1200); s.ship.shield = Math.max(0, s.ship.shield - dt); let direction = 0; if (keys.has('ArrowLeft') || keys.has('KeyA')) direction -= 1; if (keys.has('ArrowRight') || keys.has('KeyD')) direction += 1; s.ship.target = clamp(s.ship.target + direction * 360 * dt, 42, W - 42); s.ship.x += (s.ship.target - s.ship.x) * Math.min(1, dt * 13); s.ship.tilt += (direction * .22 - s.ship.tilt) * Math.min(1, dt * 9); fire();
      s.stars.forEach((star) => { star.y += star.v * dt; if (star.y > H) { star.y = -5; star.x = Math.random() * W; } }); s.bullets.forEach((bullet) => { bullet.x += bullet.vx * dt; bullet.y += bullet.vy * dt; }); s.bullets = s.bullets.filter((bullet) => bullet.y > -60);
      spawn -= dt; if (!s.boss && spawn <= 0) { spawnFormation(); spawn = Math.max(1, 2.25 - s.stage * .1); } bossClock += dt; if (!s.boss && bossClock > 34) { spawnBoss(); bossClock = 0; }
      s.enemies.forEach((enemy) => { enemy.y += enemy.v * dt; enemy.x = enemy.base + Math.sin(enemy.y * .013 + enemy.phase) * 55; enemy.shot -= dt; if (enemy.shot <= 0 && enemy.y > 60 && enemy.y < 620) { const angle = Math.atan2(s.ship.y - enemy.y, s.ship.x - enemy.x); s.enemyBullets.push({ x: enemy.x, y: enemy.y, vx: Math.cos(angle) * 190, vy: Math.sin(angle) * 190, r: 5 }); enemy.shot = 1.5 + Math.random() * 1.8; } });
      if (s.boss) { const boss = s.boss; boss.phase += dt; if (boss.y < boss.target) boss.y += 100 * dt; else boss.x = W / 2 + Math.sin(boss.phase * .8) * 150; boss.shot -= dt; if (boss.shot <= 0) { for (let i = -2; i <= 2; i += 1) s.enemyBullets.push({ x: boss.x, y: boss.y + 55, vx: Math.cos(Math.PI / 2 + i * .18) * 220, vy: Math.sin(Math.PI / 2 + i * .18) * 220, r: 6 }); boss.shot = .75; } }
      for (let bi = s.bullets.length - 1; bi >= 0; bi -= 1) { const bullet = s.bullets[bi]; let used = false; for (let ei = s.enemies.length - 1; ei >= 0; ei -= 1) { const enemy = s.enemies[ei]; if (collision(bullet, enemy, enemy.r + 7)) { enemy.hp -= bullet.damage; s.bullets.splice(bi, 1); used = true; if (enemy.hp <= 0) { s.score += enemy.elite ? 30 : 10; burst(enemy.x, enemy.y, enemy.elite ? '#ff5ad8' : '#52eaff', enemy.elite ? 30 : 18); if (Math.random() < .58) addDrop(enemy.x, enemy.y); s.enemies.splice(ei, 1); } break; } } if (!used && s.boss && collision(bullet, s.boss, 74)) { s.boss.hp -= bullet.damage; s.bullets.splice(bi, 1); if (s.boss.hp <= 0) { const defeated = s.boss; s.score += 500; burst(defeated.x, defeated.y, '#ffd76b', 120); s.boss = null; if (!s.bossAwarded) { s.bossAwarded = true; reward('boss', 5, s.score); } navigator.vibrate?.([100, 40, 100, 40, 180]); } } }
      for (let i = s.enemies.length - 1; i >= 0; i -= 1) { const enemy = s.enemies[i]; if (collision(s.ship, enemy, enemy.r + 28)) { s.enemies.splice(i, 1); burst(enemy.x, enemy.y); if (s.ship.shield > 0) s.ship.shield = 0; else s.hp -= enemy.elite ? 28 : 18; } else if (enemy.y > H + 60) s.enemies.splice(i, 1); }
      for (let i = s.enemyBullets.length - 1; i >= 0; i -= 1) { const bullet = s.enemyBullets[i]; bullet.x += bullet.vx * dt; bullet.y += bullet.vy * dt; if (collision(s.ship, bullet, 25)) { s.enemyBullets.splice(i, 1); if (s.ship.shield > 0) s.ship.shield = 0; else s.hp -= 8; } else if (bullet.y > H + 30 || bullet.x < -30 || bullet.x > W + 30) s.enemyBullets.splice(i, 1); }
      for (let i = s.drops.length - 1; i >= 0; i -= 1) { const drop = s.drops[i]; drop.y += drop.v * dt; drop.rot += dt * 3; if (collision(s.ship, drop, 34)) { if (drop.type === 'diamond') { s.diamonds += 1; if (s.diamonds - s.lastDiamondReward >= 300) { s.lastDiamondReward += 300; reward('diamonds', 10, s.score); } } else if (drop.type === 'power') s.ship.power = Math.min(3, s.ship.power + 1); else if (drop.type === 'shield') s.ship.shield = 12; else s.hp = Math.min(100, s.hp + 25); burst(drop.x, drop.y, drop.type === 'diamond' ? '#4ceeff' : '#ffd86b', 16); s.drops.splice(i, 1); } else if (drop.y > H + 30) s.drops.splice(i, 1); }
      s.particles.forEach((particle) => { particle.x += particle.vx * dt; particle.y += particle.vy * dt; particle.vx *= .985; particle.vy *= .985; particle.life -= dt; }); s.particles = s.particles.filter((particle) => particle.life > 0); hudClock += dt; if (hudClock > .12) { setHud({ score: Math.floor(s.score), hp: Math.max(0, Math.floor(s.hp)), stage: s.stage, diamonds: s.diamonds, boss: s.boss ? Math.max(0, s.boss.hp / s.boss.max * 100) : 0 }); hudClock = 0; } if (s.hp <= 0) finish();
    };
    const drawShip = () => { const ship = s.ship; ctx.save(); ctx.translate(ship.x, ship.y); ctx.rotate(ship.tilt); if (ship.shield > 0) { ctx.strokeStyle = '#4cf1ff'; ctx.lineWidth = 4; ctx.shadowColor = '#4cf1ff'; ctx.shadowBlur = 20; ctx.beginPath(); ctx.ellipse(0, 0, 53, 67, 0, 0, Math.PI * 2); ctx.stroke(); } const gradient = ctx.createLinearGradient(-40, -60, 40, 50); gradient.addColorStop(0, '#fff'); gradient.addColorStop(.35, '#8edcff'); gradient.addColorStop(.7, '#304d84'); gradient.addColorStop(1, '#dffaff'); ctx.fillStyle = gradient; ctx.shadowColor = '#52e8ff'; ctx.shadowBlur = 22; ctx.beginPath(); ctx.moveTo(0, -64); ctx.lineTo(24, -25); ctx.lineTo(58, 24); ctx.lineTo(21, 13); ctx.lineTo(12, 51); ctx.lineTo(0, 34); ctx.lineTo(-12, 51); ctx.lineTo(-21, 13); ctx.lineTo(-58, 24); ctx.lineTo(-24, -25); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#07142d'; ctx.beginPath(); ctx.ellipse(0, -20, 11, 24, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#52efff'; ctx.beginPath(); ctx.arc(0, 9, 7, 0, Math.PI * 2); ctx.fill(); ctx.restore(); };
    const draw = () => { const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#111a4f'); bg.addColorStop(.45, '#050a24'); bg.addColorStop(1, '#01030d'); ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H); s.stars.forEach((star) => { ctx.globalAlpha = star.a; ctx.fillStyle = '#dff9ff'; ctx.fillRect(star.x, star.y, star.z, star.z * 2); }); ctx.globalAlpha = 1; s.drops.forEach((drop) => { ctx.save(); ctx.translate(drop.x, drop.y); ctx.rotate(drop.rot); ctx.fillStyle = drop.type === 'diamond' ? '#50eaff' : drop.type === 'shield' ? '#71f7ff' : drop.type === 'heal' ? '#68ff9a' : '#ffd76b'; ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 18; ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }); s.bullets.forEach((bullet) => { ctx.fillStyle = '#d8ffff'; ctx.shadowColor = '#52eaff'; ctx.shadowBlur = 12; ctx.fillRect(bullet.x - 2, bullet.y - 14, 4, 20); }); s.enemyBullets.forEach((bullet) => { ctx.fillStyle = '#ff739e'; ctx.beginPath(); ctx.arc(bullet.x, bullet.y, bullet.r, 0, Math.PI * 2); ctx.fill(); }); s.enemies.forEach((enemy) => { ctx.save(); ctx.translate(enemy.x, enemy.y); ctx.fillStyle = enemy.elite ? '#a82a9a' : '#922447'; ctx.shadowColor = enemy.elite ? '#ff55d7' : '#ff506f'; ctx.shadowBlur = 18; ctx.beginPath(); ctx.moveTo(0, 31); ctx.lineTo(34, -22); ctx.lineTo(12, -13); ctx.lineTo(0, -34); ctx.lineTo(-12, -13); ctx.lineTo(-34, -22); ctx.closePath(); ctx.fill(); ctx.restore(); }); if (s.boss) { const boss = s.boss; ctx.save(); ctx.translate(boss.x, boss.y); ctx.fillStyle = '#6d164e'; ctx.shadowColor = '#ff5d8f'; ctx.shadowBlur = 30; ctx.beginPath(); ctx.moveTo(0, -75); ctx.lineTo(105, -15); ctx.lineTo(82, 66); ctx.lineTo(24, 48); ctx.lineTo(0, 82); ctx.lineTo(-24, 48); ctx.lineTo(-82, 66); ctx.lineTo(-105, -15); ctx.closePath(); ctx.fill(); ctx.restore(); ctx.fillStyle = 'rgba(255,255,255,.15)'; ctx.fillRect(56, 126, W - 112, 12); ctx.fillStyle = '#ff4f85'; ctx.fillRect(56, 126, (W - 112) * Math.max(0, boss.hp / boss.max), 12); } s.particles.forEach((particle) => { ctx.globalAlpha = Math.max(0, particle.life); ctx.fillStyle = particle.color; ctx.beginPath(); ctx.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2); ctx.fill(); }); ctx.globalAlpha = 1; if (!s.dead) drawShip(); };
    const loop = (time) => { if (stopped) return; const dt = Math.min(.033, (time - last) / 1000 || 0); last = time; if (!s.dead) update(dt); draw(); raf = requestAnimationFrame(loop); };
    const position = (event) => { const bounds = canvas.getBoundingClientRect(); s.ship.target = clamp((event.clientX - bounds.left) / bounds.width * W, 42, W - 42); };
    const down = (event) => { dragging = true; position(event); }; const move = (event) => { if (dragging) { event.preventDefault(); position(event); } }; const up = () => { dragging = false; }; const keyDown = (event) => keys.add(event.code); const keyUp = (event) => keys.delete(event.code);
    canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('keydown', keyDown); window.addEventListener('keyup', keyUp); raf = requestAnimationFrame(loop);
    return () => { stopped = true; cancelAnimationFrame(raf); canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('keydown', keyDown); window.removeEventListener('keyup', keyUp); };
  }, [mode, run]);

  return <section className="shell"><header><div><small>SPACENOVAX · OFFICIAL ARCADE</small><h1>NOVA-X1 Genesis Defense</h1><p className="notice">{notice}</p></div><span className="status">{session ? 'CAPTAIN LINKED' : 'PRACTICE'}</span></header><div className="rewards"><div>Diamonds<b>+10 SPNX × 2</b></div><div>First boss<b>+5 SPNX</b></div><div>Daily cap<b>30 SPNX</b></div></div><div className="game"><canvas ref={canvasRef} width={W} height={H}/><div className="hud"><span>SCORE {hud.score.toLocaleString()}</span><span>HP {hud.hp}</span><span>STAGE {hud.stage}</span></div><div className="bottom">💎 {hud.diamonds} / 300 · NOVA-X1</div>{mode !== 'playing' && <div className="overlay"><div className="panel"><small>{mode === 'gameover' ? 'MISSION FAILED' : 'FLEET COMMAND'}</small><h2>{mode === 'gameover' ? 'NOVA-X1 DESTROYED' : 'DEFEND THE GENESIS GATE'}</h2><p>{rewardText}</p><button disabled={!session && Boolean(apiBase)} onClick={() => { setMode('playing'); setRun((value) => value + 1); }}>{mode === 'gameover' ? 'RETRY MISSION' : 'LAUNCH NOVA-X1'}</button></div></div>}</div></section>;
}
