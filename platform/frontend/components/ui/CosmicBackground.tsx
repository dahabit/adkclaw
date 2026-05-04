'use client';

import { useEffect, useRef } from 'react';

/**
 * Layered animated background:
 *   - CSS aurora (slow color blobs) handled in globals.css via .aurora utility
 *   - Canvas particles (drifting stars) handled here, ~120 specks
 *
 * Pinned full-bleed, behind everything (z=-10), pointer-events: none.
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

    const PARTICLE_COUNT = reduceMotion ? 40 : 120;
    type P = {
      x: number;
      y: number;
      r: number;
      vx: number;
      vy: number;
      hue: number;
      alpha: number;
    };
    const particles: P[] = [];

    function resize() {
      if (!canvas) return;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx?.scale(dpr, dpr);
    }
    resize();

    function spawn(): P {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const hues = [210, 220, 230, 260, 190]; // cloud-blue · indigo · cyan
      return {
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.8 + 0.4,
        vx: (Math.random() - 0.5) * 0.12,
        vy: (Math.random() - 0.5) * 0.12 - 0.04,
        hue: hues[Math.floor(Math.random() * hues.length)] ?? 210,
        alpha: Math.random() * 0.7 + 0.2,
      };
    }
    for (let i = 0; i < PARTICLE_COUNT; i++) particles.push(spawn());

    let raf = 0;
    let running = !document.hidden;

    function frame() {
      if (!ctx || !canvas) return;
      const w = window.innerWidth;
      const h = window.innerHeight;

      ctx.clearRect(0, 0, w, h);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;

        // Wrap around edges
        if (p.x < -10) p.x = w + 10;
        else if (p.x > w + 10) p.x = -10;
        if (p.y < -10) p.y = h + 10;
        else if (p.y > h + 10) p.y = -10;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 80%, 70%, ${p.alpha})`;
        ctx.shadowBlur = p.r * 4;
        ctx.shadowColor = `hsla(${p.hue}, 90%, 65%, ${p.alpha * 0.8})`;
        ctx.fill();
      }
      ctx.shadowBlur = 0;

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
      {/* Particles canvas */}
      <canvas ref={canvasRef} className="absolute inset-0" />
      {/* Subtle grain to break the bands */}
      <div className="absolute inset-0 opacity-[0.04] mix-blend-overlay grain" />
    </div>
  );
}
