'use client';

import { useEffect, useRef } from 'react';

type Star = { x: number; y: number; size: number; phase: number; speed: number; depth: number };

export default function AmbientSky({ reducedMotion = false }: { reducedMotion?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current; const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    let animation = 0; let width = 0; let height = 0; let dpr = 1; let last = 0; let paused = document.hidden;
    let pointerX = 0; let pointerY = 0; let targetX = 0; let targetY = 0; let shooting: { x: number; y: number; progress: number } | null = null;
    const stars: Star[] = [];
    const resize = () => { dpr = Math.min(window.devicePixelRatio || 1, 1.5); width = window.innerWidth; height = window.innerHeight; canvas.width = Math.floor(width * dpr); canvas.height = Math.floor(height * dpr); context.setTransform(dpr, 0, 0, dpr, 0, 0); stars.length = 0; const count = Math.min(120, Math.max(46, Math.floor(width * height / 10000))); for (let i = 0; i < count; i += 1) { const depth = i % 10 < 2 ? 1.5 : i % 3 === 0 ? 1 : .55; stars.push({ x: Math.random() * width, y: Math.random() * height, size: (.35 + Math.random() * 1.25) * depth, phase: Math.random() * Math.PI * 2, speed: (.0017 + Math.random() * .006) * depth, depth }); } };
    const pointer = (event: PointerEvent) => { targetX = (event.clientX / width - .5) * 14; targetY = (event.clientY / height - .5) * 10; };
    const visibility = () => { paused = document.hidden; if (!paused && !reducedMotion) { last = performance.now(); animation = requestAnimationFrame(frame); } };
    const frame = (time: number) => { if (paused) return; const delta = Math.min(48, time - (last || time)); last = time; pointerX += (targetX - pointerX) * .025; pointerY += (targetY - pointerY) * .025; context.clearRect(0, 0, width, height); for (const star of stars) { if (!reducedMotion) { star.y += star.speed * delta; if (star.y > height + 5) star.y = -5; } const alpha = .18 + ((Math.sin(time / (850 + star.depth * 400) + star.phase) + 1) * .5) * (.56 * star.depth / 1.5); const x = star.x + pointerX * star.depth; const y = star.y + pointerY * star.depth; context.beginPath(); context.fillStyle = `rgba(255,248,237,${alpha})`; context.arc(x, y, star.size, 0, Math.PI * 2); context.fill(); }
      if (!reducedMotion) { if (!shooting && Math.random() < delta / 16000) shooting = { x: Math.random() * width * .7, y: Math.random() * height * .32, progress: 0 }; if (shooting) { shooting.progress += delta / 1250; const x = shooting.x + shooting.progress * width; const y = shooting.y + shooting.progress * width * .34; const line = context.createLinearGradient(x, y, x - 100, y - 34); line.addColorStop(0, 'rgba(255,229,180,.82)'); line.addColorStop(1, 'rgba(255,229,180,0)'); context.strokeStyle = line; context.lineWidth = 1.4; context.beginPath(); context.moveTo(x, y); context.lineTo(x - 100, y - 34); context.stroke(); if (shooting.progress > 1.12) shooting = null; } animation = requestAnimationFrame(frame); } };
    resize(); window.addEventListener('resize', resize); window.addEventListener('pointermove', pointer, { passive: true }); document.addEventListener('visibilitychange', visibility); if (!reducedMotion) animation = requestAnimationFrame(frame); else frame(performance.now());
    return () => { cancelAnimationFrame(animation); window.removeEventListener('resize', resize); window.removeEventListener('pointermove', pointer); document.removeEventListener('visibilitychange', visibility); };
  }, [reducedMotion]);
  return <canvas ref={ref} className="ambient-sky" aria-hidden="true"/>;
}
