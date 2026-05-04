'use client';

import { useEffect, useRef } from 'react';

/**
 * Layered animated cosmic background:
 *   1. CSS aurora — three slow color blobs (handled in globals.css)
 *   2. Canvas starfield — 220 twinkling particles, parallax depth, drifting
 *   3. Shooting stars — occasional bright streaks crossing the screen
 *   4. Subtle grain — breaks up gradient banding
 *
 * Pinned full-bleed, behind everything (z=-1), pointer-events: none.
 * Pauses when the tab is hidden to spare battery.
 */
export function CosmicBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    type Star = {
      x: number;
      y: number;
      r: number;
      vx: number;
      vy: number;
      hue: number;
      baseAlpha: number;
      twinkleSpeed: number;
      twinklePhase: number;
      depth: number; // 0..1 — depth, affects size/parallax
    };
    type Shooter = {
      x: number;
      y: number;
      vx: number;
      vy: number;
      life: number;
      maxLife: number;
      hue: number;
    };

    const STAR_COUNT = reduceMotion ? 60 : 220;
    const stars: Star[] = [];
    const shooters: Shooter[] = [];

    function resize() {
      if (!canvas) return;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx?.setTransform(1, 0, 0, 1, 0, 0);
      ctx?.scale(dpr, dpr);
    }
    resize();

    function spawnStar(): Star {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const hues = [210, 220, 230, 260, 190, 280, 200];
      const depth = Math.random();
      return {
        x: Math.random() * w,
        y: Math.random() * h,
        r: 0.5 + depth * 2.2,
        vx: (Math.random() - 0.5) * 0.08 * (0.4 + depth),
        vy: (Math.random() - 0.5) * 0.08 * (0.4 + depth) - 0.03,
        hue: hues[Math.floor(Math.random() * hues.length)] ?? 210,
        baseAlpha: 0.4 + depth * 0.6,
        twinkleSpeed: 0.8 + Math.random() * 2.2,
        twinklePhase: Math.random() * Math.PI * 2,
        depth,
      };
    }
    for (let i = 0; i < STAR_COUNT; i++) stars.push(spawnStar());

    function spawnShooter() {
      if (reduceMotion) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      const angle = -Math.PI / 4 + (Math.random() - 0.5) * 0.3; // ~ -45deg
      const speed = 6 + Math.random() * 4;
      shooters.push({
        x: Math.random() * w,
        y: Math.random() * (h * 0.4),
        vx: Math.cos(angle) * speed * (Math.random() < 0.5 ? -1 : 1),
        vy: Math.abs(Math.sin(angle)) * speed,
        life: 0,
        maxLife: 70 + Math.random() * 30,
        hue: 200 + Math.random() * 40,
      });
    }

    let raf = 0;
    let running = !document.hidden;
    let frameCount = 0;

    function frame() {
      if (!ctx || !canvas) return;
      const w = window.innerWidth;
      const h = window.innerHeight;

      ctx.clearRect(0, 0, w, h);

      // ─── Stars ───────────────────────────────────────────────────
      for (const s of stars) {
        s.x += s.vx;
        s.y += s.vy;

        if (s.x < -10) s.x = w + 10;
        else if (s.x > w + 10) s.x = -10;
        if (s.y < -10) s.y = h + 10;
        else if (s.y > h + 10) s.y = -10;

        s.twinklePhase += 0.016 * s.twinkleSpeed;
        const twinkle = 0.55 + 0.45 * Math.sin(s.twinklePhase);
        const alpha = s.baseAlpha * twinkle;

        // Glow halo
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${s.hue}, 90%, 75%, ${alpha})`;
        ctx.shadowBlur = s.r * 6;
        ctx.shadowColor = `hsla(${s.hue}, 95%, 70%, ${alpha * 0.85})`;
        ctx.fill();

        // Cross-flare for the brightest 8% of stars (looks like a sparkle)
        if (s.depth > 0.92) {
          ctx.shadowBlur = 0;
          ctx.strokeStyle = `hsla(${s.hue}, 95%, 85%, ${alpha * 0.9})`;
          ctx.lineWidth = 0.6;
          const flare = s.r * 4;
          ctx.beginPath();
          ctx.moveTo(s.x - flare, s.y);
          ctx.lineTo(s.x + flare, s.y);
          ctx.moveTo(s.x, s.y - flare);
          ctx.lineTo(s.x, s.y + flare);
          ctx.stroke();
        }
      }
      ctx.shadowBlur = 0;

      // ─── Shooting stars ──────────────────────────────────────────
      // Spawn one every ~3 seconds on average
      if (frameCount % 180 === 0 && Math.random() < 0.6) spawnShooter();

      for (let i = shooters.length - 1; i >= 0; i--) {
        const sh = shooters[i];
        if (!sh) continue;
        sh.life++;
        sh.x += sh.vx;
        sh.y += sh.vy;

        const t = sh.life / sh.maxLife;
        if (t >= 1) {
          shooters.splice(i, 1);
          continue;
        }
        const alpha = (1 - t) * (t < 0.15 ? t / 0.15 : 1);
        const tailLen = 80;
        const tx = sh.x - sh.vx * tailLen * 0.3;
        const ty = sh.y - sh.vy * tailLen * 0.3;

        const grad = ctx.createLinearGradient(tx, ty, sh.x, sh.y);
        grad.addColorStop(0, `hsla(${sh.hue}, 95%, 70%, 0)`);
        grad.addColorStop(1, `hsla(${sh.hue}, 95%, 90%, ${alpha})`);

        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(sh.x, sh.y);
        ctx.stroke();

        // Bright head
        ctx.beginPath();
        ctx.arc(sh.x, sh.y, 1.8, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${sh.hue}, 100%, 92%, ${alpha})`;
        ctx.shadowBlur = 14;
        ctx.shadowColor = `hsla(${sh.hue}, 100%, 80%, ${alpha})`;
        ctx.fill();
      }
      ctx.shadowBlur = 0;

      frameCount++;
      raf = requestAnimationFrame(frame);
    }

    if (running) raf = requestAnimationFrame(frame);

    function onVis() {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        running = false;
      } else if (!running) {
        running = true;
        raf = requestAnimationFrame(frame);
      }
    }
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('resize', resize);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* Aurora — pure CSS, slow morphing blobs */}
      <div className="aurora aurora-1" />
      <div className="aurora aurora-2" />
      <div className="aurora aurora-3" />
      <div className="aurora aurora-4" />
      {/* Particles + shooting stars */}
      <canvas ref={canvasRef} className="absolute inset-0" />
      {/* Subtle grain to break the bands */}
      <div className="absolute inset-0 opacity-[0.04] mix-blend-overlay grain" />
    </div>
  );
}
