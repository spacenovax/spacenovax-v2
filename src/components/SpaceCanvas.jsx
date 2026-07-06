import { useEffect, useRef } from 'react';

export default function SpaceCanvas() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    if (!canvas || !host) return;

    const ctx = canvas.getContext('2d');
    let width = 1;
    let height = 1;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let stars = [];
    let meteors = [];
    let lastMeteor = 0;
    let nextMeteor = 900;
    let animationId = 0;

    function resize() {
      const rect = host.getBoundingClientRect();
      width = Math.max(1, Math.floor(rect.width));
      height = Math.max(1, Math.floor(rect.height));
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.floor((width * height) / 3200);
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: 0.45 + Math.random() * 1.5,
        a: 0.15 + Math.random() * 0.82,
        tw: 0.002 + Math.random() * 0.018,
        color: Math.random() < 0.2 ? 'cyan' : Math.random() < 0.1 ? 'purple' : 'white',
        phase: Math.random() * Math.PI * 2,
      }));
    }

    function spawnMeteor(now) {
      const right = Math.random() > 0.24;
      const purple = Math.random() < 0.18;
      const speed = 8 + Math.random() * 7;
      meteors.push({
        x: right ? width + 150 : -150,
        y: 28 + Math.random() * height * 0.52,
        vx: right ? -speed : speed,
        vy: speed * (0.33 + Math.random() * 0.28),
        len: 95 + Math.random() * 110,
        lineWidth: 2 + Math.random() * 1.5,
        life: 0,
        maxLife: 72 + Math.random() * 34,
        purple,
      });

      lastMeteor = now;
      nextMeteor = 4200 + Math.random() * 2200;
    }

    function drawStar(star, now) {
      const pulse = Math.sin(now * star.tw + star.phase) * 0.5 + 0.5;
      const alpha = star.a * (0.4 + pulse * 0.6);
      const color = star.color === 'cyan' ? '52,239,255' : star.color === 'purple' ? '180,80,255' : '255,255,255';
      ctx.beginPath();
      ctx.fillStyle = `rgba(${color},${alpha})`;
      ctx.shadowColor = `rgba(${color},${alpha})`;
      ctx.shadowBlur = 6;
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    function drawMeteor(m) {
      const fadeIn = Math.min(1, m.life / 12);
      const fadeOut = Math.min(1, (m.maxLife - m.life) / 18);
      const fade = Math.max(0, fadeIn * fadeOut);
      const mag = Math.hypot(m.vx, m.vy) || 1;
      const ux = m.vx / mag;
      const uy = m.vy / mag;
      const tailX = m.x - ux * m.len;
      const tailY = m.y - uy * m.len;
      const main = m.purple ? '180,80,255' : '52,239,255';
      const gradient = ctx.createLinearGradient(tailX, tailY, m.x, m.y);
      gradient.addColorStop(0, `rgba(${main},0)`);
      gradient.addColorStop(0.55, `rgba(${main},${0.54 * fade})`);
      gradient.addColorStop(1, `rgba(255,255,255,${fade})`);
      ctx.strokeStyle = gradient;
      ctx.lineWidth = m.lineWidth;
      ctx.lineCap = 'round';
      ctx.shadowColor = `rgba(${main},${fade})`;
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(m.x, m.y);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    function loop(now) {
      ctx.clearRect(0, 0, width, height);
      const nebula = ctx.createRadialGradient(width * 0.65, height * 0.46, 10, width * 0.65, height * 0.46, width * 0.48);
      nebula.addColorStop(0, 'rgba(126,67,255,.14)');
      nebula.addColorStop(1, 'rgba(126,67,255,0)');
      ctx.fillStyle = nebula;
      ctx.fillRect(0, 0, width, height);
      stars.forEach((star) => drawStar(star, now));
      if (now - lastMeteor > nextMeteor) spawnMeteor(now);
      meteors.forEach((m) => {
        m.x += m.vx;
        m.y += m.vy;
        m.life += 1;
        drawMeteor(m);
      });
      meteors = meteors.filter((m) => m.life < m.maxLife && m.x > -280 && m.x < width + 280 && m.y < height + 200);
      animationId = requestAnimationFrame(loop);
    }

    resize();
    window.addEventListener('resize', resize, { passive: true });
    setTimeout(() => spawnMeteor(performance.now()), 800);
    animationId = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return <canvas className="space-canvas" ref={canvasRef} aria-hidden="true" />;
}
