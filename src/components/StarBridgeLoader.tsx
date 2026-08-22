'use client';

import { useEffect, useState } from 'react';

export default function StarBridgeLoader() {
  const [done, setDone] = useState(false);
  useEffect(() => {
    const finish = () => window.setTimeout(() => setDone(true), 360);
    if (document.readyState === 'complete') finish(); else window.addEventListener('load', finish, { once: true });
    const fallback = window.setTimeout(() => setDone(true), 2200);
    return () => { window.removeEventListener('load', finish); window.clearTimeout(fallback); };
  }, []);
  return <div className={done ? 'starbridge-loader is-done' : 'starbridge-loader'} aria-hidden={done}>
    <div className="loader-sky"><span className="loader-star s1">✦</span><span className="loader-star s2">✧</span><span className="loader-star s3">✦</span><span className="loader-star s4">·</span><span className="loader-star s5">✧</span></div>
    <div className="loader-core"><div className="loader-orbit"><span>✦</span><i/><b/></div><p>finding your shared sky</p><h1>StarBridge</h1><div className="loader-progress" role="progressbar" aria-label="Loading StarBridge"><i/></div><small>bringing the stars closer</small></div>
  </div>;
}
