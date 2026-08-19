'use client';

import { useEffect, useState } from 'react';

export default function MotionPreference({ reducedMotion = false }: { reducedMotion?: boolean }) {
  const [osReduced, setOsReduced] = useState(false);
  useEffect(() => { const media = window.matchMedia('(prefers-reduced-motion: reduce)'); const sync = () => setOsReduced(media.matches); sync(); media.addEventListener('change', sync); return () => media.removeEventListener('change', sync); }, []);
  useEffect(() => { document.documentElement.classList.toggle('motion-reduced', Boolean(reducedMotion || osReduced)); }, [reducedMotion, osReduced]);
  return null;
}
