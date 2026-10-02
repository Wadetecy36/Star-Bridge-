'use client';

import { useEffect, useMemo, useState } from 'react';
import { Flower2, MessageCircleHeart, Settings, Sparkles, LogOut, ShieldCheck, Send, Heart, SlidersHorizontal, X, Volume2, Bell, Palette, Clock3, GlassWater } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase-browser';
import AmbientSky from '@/components/AmbientSky';
import MotionPreference from '@/components/MotionPreference';

type Initial = { me: any; people: any[]; settings: any; activeRound: any; stars: any[]; audit: any[]; inviteCode: string; token?: string };
type EmoteBurst = { id: string; emote: string; leftPercent: number };
const seedChoices = ['🌷', '🌼', '🪻', '🌿', '✨'];
const emotes = ['💖', '🤗', '😘', '🥹', '🎉'];
const difficultyCopy: Record<string, string> = { easy: '5 × 5 · 3 targets · no timer', normal: '5 × 5 · 5 targets · default', hard: '5 × 5 · 7 targets · 90 seconds', custom: 'Make it your own' };

function dedupeById<T extends { id?: string | number }>(items: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items || []) {
    if (!item) continue;
    const idKey = item.id != null ? String(item.id) : undefined;
    if (idKey) {
      if (seen.has(idKey)) continue;
      seen.add(idKey);
    }
    result.push(item);
  }
  return result;
}

function appendUnique<T extends { id?: string | number }>(current: T[], item: T): T[] {
  if (!item) return current || [];
  const list = current || [];
  const itemId = item.id != null ? String(item.id) : null;
  if (!itemId) return [...list, item];
  const idx = list.findIndex(c => c && c.id != null && String(c.id) === itemId);
  if (idx !== -1) {
    const copy = [...list];
    copy[idx] = { ...copy[idx], ...item };
    return copy;
  }
  return [...list, item];
}

export default function RoomApp({ initial }: { initial: Initial }) {
  const roomToken = (initial as any).token || (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('token') || localStorage.getItem('constellation_token') || '' : '');
  function authFetch(input: string, init?: RequestInit) {
    const headers = new Headers(init?.headers);
    if (roomToken && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${roomToken}`);
    }
    return fetch(input, { ...init, headers });
  }

  const [tab, setTab] = useState<'constellation' | 'garden' | 'jar' | 'dock'>('constellation');
  const [stars, setStars] = useState(initial.stars); const [round, setRound] = useState(initial.activeRound);
  const [plants, setPlants] = useState<any[]>([]); const [newPlantIds, setNewPlantIds] = useState<string[]>([]); const [messages, setMessages] = useState<any[]>([]); const [newMessageIds, setNewMessageIds] = useState<string[]>([]); const [pressedStar, setPressedStar] = useState<string>(''); const [bottles, setBottles] = useState<any[]>([]); const [bottleText, setBottleText] = useState(''); const [openBottle, setOpenBottle] = useState<any | null>(null); const [emoteBursts, setEmoteBursts] = useState<EmoteBurst[]>([]);

  function playEmoteChime() {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.38);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch {}
  }

  function triggerBurst(emote: string) {
    const burstId = `burst-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const leftPercent = 36 + Math.floor(Math.random() * 28);
    const newBurst: EmoteBurst = { id: burstId, emote, leftPercent };
    setEmoteBursts(current => [...current.slice(-10), newBurst]);
    if (settings.sound_enabled !== false && settings.emote_sound_enabled !== false) {
      playEmoteChime();
    }
    window.setTimeout(() => {
      setEmoteBursts(current => current.filter(b => b.id !== burstId));
    }, 2200);
  }
  const [settingsOpen, setSettingsOpen] = useState(false); const [auditOpen, setAuditOpen] = useState(false); const [settings, setSettings] = useState(initial.settings || {}); const [achievements, setAchievements] = useState<any[]>([]); const [completion, setCompletion] = useState<any | null>(null);
  const [message, setMessage] = useState(''); const [seed, setSeed] = useState('🌷'); const [notice, setNotice] = useState(''); const [loadingRound, setLoadingRound] = useState(false); const [inviteOpen, setInviteOpen] = useState(false);
  const [people, setPeople] = useState(initial.people);
  const roomIdsKey = useMemo(() => people.map(person => person.id).join(','), [people]);
  async function refreshRoomState() { const response = await authFetch('/api/room-state', { cache: 'no-store' }); if (!response.ok) return; const data = await response.json(); setPeople(data.people || []); if (data.activeRound) { setRound((current: any) => current?.id === data.activeRound.id ? { ...current, ...data.activeRound } : data.activeRound); setStars(data.stars || []); } }

  async function loadAchievements() { const response = await authFetch('/api/achievements', { cache: 'no-store' }); if (!response.ok) return; const data = await response.json(); setAchievements(dedupeById(data.rounds || [])); }
  async function triggerCompletion() { if (!round || completion?.id === round.id) return; setCompletion(round); await loadAchievements(); }

  async function loadBottles() { const response = await authFetch('/api/memory-jar', { cache: 'no-store' }); if (!response.ok) return; const data = await response.json(); setBottles(dedupeById(data.bottles || [])); }
  async function dropBottle() { const content = bottleText.trim(); if (!content) return; const response = await authFetch('/api/memory-jar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content }) }); const data = await response.json(); if (!response.ok) return toast(data.error || 'Could not drop this bottle.'); setBottleText(''); await loadBottles(); toast('Your bottle is drifting into the jar.'); }

  async function api(path: string, body?: unknown) { const response = await authFetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); return response.json(); }
  function toast(text: string) { setNotice(text); window.setTimeout(() => setNotice(''), 2800); }

  useEffect(() => {
    const client = supabaseBrowser();
    const channel = client.channel(`room-${initial.me.room_id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'constellation_stars' }, async () => { const latest = await authFetch('/api/room-state', { cache: 'no-store' }); if (!latest.ok) return; const snapshot = await latest.json(); if (snapshot.activeRound) { setRound((current: any) => current?.id === snapshot.activeRound.id ? { ...current, ...snapshot.activeRound } : snapshot.activeRound); setStars(snapshot.stars || []); } })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'garden_plants' }, (payload: any) => { setPlants(current => appendUnique(current, payload.new)); setNewPlantIds(current => [...current, payload.new.id]); window.setTimeout(() => setNewPlantIds(current => current.filter(id => id !== payload.new.id)), 1800); })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload: any) => { setMessages(current => appendUnique(current, payload.new)); setNewMessageIds(current => [...current, payload.new.id]); window.setTimeout(() => setNewMessageIds(current => current.filter(id => id !== payload.new.id)), 1000); })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'emotes' }, (payload: any) => { if (payload.new?.emote && payload.new.user_id !== initial.me.id) { triggerBurst(payload.new.emote); } })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'memory_bottles' }, () => { void loadBottles(); })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'memory_bottles' }, () => { void loadBottles(); })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users' }, (payload: any) => setPeople(current => current.map(person => person.id === payload.new.id ? { ...person, ...payload.new } : person)))
      .subscribe();
    (async () => { const gardenResponse = await authFetch('/api/garden', { cache: 'no-store' }); if (gardenResponse.ok) { const gardenData = await gardenResponse.json(); setPlants(dedupeById(gardenData.plants || [])); } const dockResponse = await authFetch('/api/dock', { cache: 'no-store' }); if (dockResponse.ok) { const dockData = await dockResponse.json(); setMessages(dedupeById(dockData.messages || [])); } await loadAchievements(); await loadBottles(); await refreshRoomState(); })();
    const poll = window.setInterval(refreshRoomState, 2500);
    return () => { window.clearInterval(poll); client.removeChannel(channel); };
  }, [initial.me.room_id, roomIdsKey]);

  async function startRound(difficulty = settings.difficulty || 'normal') { setLoadingRound(true); const result = await api('/api/game', { action: 'new_round', difficulty }); setLoadingRound(false); if (result.round) { setRound(result.round); if (result.stars) setStars(result.stars); await refreshRoomState(); toast(`${difficulty} constellation is ready for both of you.`); } else toast(result.error || 'That constellation could not start.'); }
  async function refreshStars(roundId = round?.id) { if (!roundId) return; await refreshRoomState(); }
  async function clickStar(position: number) { const star = stars.find(item => item.position === position); if (star) { setPressedStar(star.id); window.setTimeout(() => setPressedStar(''), 430); } const result = await api('/api/game', { action: 'click_star', position }); await refreshStars(); window.setTimeout(() => { void refreshStars(); }, 450); if (result.completed) await triggerCompletion(); }
  async function plant(event: React.MouseEvent<HTMLDivElement>) { const rect = event.currentTarget.getBoundingClientRect(); const x = ((event.clientX - rect.left) / rect.width) * 100; const y = ((event.clientY - rect.top) / rect.height) * 100; const response = await authFetch('/api/garden', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ seed_emoji: seed, x, y }) }); const data = await response.json(); if (!response.ok) return toast(data.error || 'Could not plant this seed.'); setPlants(current => appendUnique(current, data.plant)); setNewPlantIds(current => [...current, data.plant.id]); window.setTimeout(() => setNewPlantIds(current => current.filter(id => id !== data.plant.id)), 1800); }
  async function undoPlant() { const response = await authFetch('/api/garden', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'undo' }) }); const data = await response.json(); if (!response.ok) return toast(data.error || 'Could not undo that plant.'); setPlants(current => current.filter(item => item.id !== data.removedId)); toast('Last plant gently returned to the sky.'); }
  async function clearGarden() { if (!window.confirm('Clear every plant from your shared garden? This cannot be undone.')) return; const response = await authFetch('/api/garden', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'clear' }) }); const data = await response.json(); if (!response.ok) return toast(data.error || 'Could not clear the garden.'); setPlants([]); toast('Your shared garden is clear.'); }
  async function sendMessage() { const content = message.trim(); if (!content) return; const response = await authFetch('/api/dock', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'message', content }) }); const data = await response.json(); if (!response.ok) return toast(data.error || 'Could not send that message.'); setMessages(current => appendUnique(current, data.message)); setNewMessageIds(current => [...current, data.message.id]); window.setTimeout(() => setNewMessageIds(current => current.filter(id => id !== data.message.id)), 1000); setMessage(''); }
  async function sendEmote(emote: string) { triggerBurst(emote); try { const response = await authFetch('/api/dock', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'emote', emote }) }); if (!response.ok) { const data = await response.json().catch(() => ({})); toast(data.error || 'Could not send that emote.'); } } catch { toast('Could not send that emote.'); } }
  async function saveSettings(next: any) { const updated = { ...settings, ...next }; try { await authFetch('/api/settings', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(next) }); } catch {} setSettings(updated); toast('Settings saved.'); }
  async function signOut() { await authFetch('/api/room', { method: 'DELETE' }); try { localStorage.removeItem('constellation_token'); } catch {} window.location.href = '/'; }
  async function copyInvite() { try { await navigator.clipboard.writeText(`${window.location.origin}?room=${initial.inviteCode}`); toast('Invite link copied.'); } catch { toast(`Room code: ${initial.inviteCode}`); } }

  const gridSize = round?.grid_size || 5; const locked = stars.filter(star => star.locked_at).length; const progress = round ? Math.min(100, Math.round((locked / round.target_count) * 100)) : 0; const partner = people.find(person => person.id !== initial.me.id);
  return <main className={`${settings.theme === 'day' ? 'app day' : 'app'} room-sky`}>
    <MotionPreference reducedMotion={Boolean(settings.reduce_motion)}/><AmbientSky reducedMotion={Boolean(settings.reduce_motion)}/>
    <header className="topbar"><div className="compact-brand"><button className="compact-badge brand-orbit brand-home" onClick={() => window.location.reload()} aria-label="Refresh StarBridge"><span>✦</span><i/><b/></button><div><p className="eyebrow">our shared sky</p><h1>Constellation</h1></div></div><div className="header-actions"><button className="icon-button invite-trigger" onClick={() => setInviteOpen(true)} aria-label="Invite your partner"><Heart size={20}/><span>Invite</span></button><button className="icon-button settings-trigger" onClick={() => setSettingsOpen(true)} aria-label="Open settings"><Settings size={20}/><span>Settings</span></button></div></header>
    {notice && <div className="toast">{notice}</div>}
    <nav className="tabs">{[['constellation', Sparkles], ['garden', Flower2], ['jar', GlassWater], ['dock', MessageCircleHeart]].map(([id, Icon]: any) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}><Icon size={18}/><span>{id === 'jar' ? 'Memory Jar' : id[0].toUpperCase() + id.slice(1)}</span></button>)}</nav>
    <section className="content">
      {tab === 'constellation' && <div className={`scene constellation-scene scene-enter`} key={`constellation-${round?.id || 'empty'}`}><SectionHeading icon={<Sparkles size={21}/>} eyebrow="shared puzzle" title={round ? `${round.difficulty} constellation` : 'Choose your first sky'} subtitle={round ? `${locked} of ${round.target_count} stars held together` : 'Set a shared difficulty, then let the first constellation appear.'} action={<button className="soft-button" onClick={() => startRound()} disabled={loadingRound}>{loadingRound ? 'Making a sky…' : 'New constellation'} <span>→</span></button>}/>{round ? <><div className="constellation-progress" aria-label={`${locked} of ${round.target_count} stars connected`}><div><strong>{locked} / {round.target_count}</strong><span>stars connected</span></div><div className="progress-track"><i style={{ width: `${progress}%` }}/></div></div><div className="puzzle-wrap"><div className="round-chip"><span>✦</span>{round.difficulty} · {round.target_count} targets{round.time_limit_seconds ? ` · ${round.time_limit_seconds}s` : ''}</div><div className="star-grid" style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}>{stars.map((star, idx) => { const pending = !star.locked_at && (star.clicked_by_user_1 || star.clicked_by_user_2); return <button key={`${star.id || star.position}-${idx}`} className={`star ${star.is_target ? 'target' : ''} ${star.locked_at ? 'locked' : ''} ${pending ? 'pending' : ''} ${pressedStar === star.id ? 'pressed' : ''}`} onClick={() => clickStar(star.position)} aria-label={`Star ${star.position + 1}`}>{star.locked_at ? '✦' : pending ? '◌' : star.is_target ? '·' : ''}</button>})}</div></div><AchievementsStrip rounds={achievements} /></> : <Empty icon="✦" title="No constellation yet" text="Start a round and your shared star grid will appear here." />}</div>}
      {tab === 'garden' && <div className="scene scene-enter garden-scene"><SectionHeading icon={<Flower2 size={21}/>} eyebrow="shared garden" title="Leave a little life behind" subtitle="Pick a seed, then tap anywhere in the garden." action={<div className="garden-tools"><div className="seed-row">{seedChoices.map((item, idx) => <button className={seed === item ? 'seed active' : 'seed'} key={`seed-${item}-${idx}`} onClick={() => setSeed(item)}>{item}</button>)}</div><div className="garden-actions"><button type="button" className="garden-action" onClick={undoPlant}>Undo</button><button type="button" className="garden-action danger" onClick={clearGarden}>Clear</button></div></div>}/><div className="garden" onClick={plant}>{plants.map((plant, idx) => <span key={`plant-${plant.id || 'p'}-${idx}`} className={`plant ${newPlantIds.includes(plant.id) ? 'plant-new' : ''}`} style={{ left: `${plant.x}%`, top: `${plant.y}%` }}>{plant.seed_emoji}</span>)}{!plants.length && <Empty icon="🌱" title="Your garden is waiting" text="Plant the first little thing for your partner." />}</div></div>}
      {tab === 'jar' && <div className="scene jar-scene scene-enter"><SectionHeading icon={<GlassWater size={21}/>} eyebrow="message in a bottle" title="Memory Jar" subtitle="Leave a small thought for them to find whenever they need it."/><div className="bottle-composer"><textarea value={bottleText} onChange={event => setBottleText(event.target.value.slice(0, 300))} placeholder="Write something they’ll want to keep…" maxLength={300} rows={3}/><div><small>{bottleText.length} / 300</small><button className="soft-button" onClick={dropBottle}>Drop a bottle <span>✦</span></button></div></div>{bottles.length ? <div className="bottle-field">{bottles.map((bottle, index) => <button className="bottle" key={`bottle-${bottle.id || 'b'}-${index}`} onClick={() => setOpenBottle(bottle)} style={{ transform: `translateY(${(index % 3) * 11}px) rotate(${(index % 2 ? 1 : -1) * (index % 4)}deg)` }} aria-label={`Open a bottle from ${bottle.username}`}>🫙</button>)}</div> : <Empty icon="🫙" title="Your jar is waiting" text="Drop the first little note into your shared sky." />}</div>}
      {tab === 'dock' && <div className="scene dock-scene scene-enter"><SectionHeading icon={<MessageCircleHeart size={21}/>} eyebrow="the dock" title="Close, even from far away" subtitle={partner ? `${partner.username}'s local time will appear here` : 'Invite your partner to dock with you.'}/><div className="messages">{messages.map((item, idx) => <div className={`${item.user_id === initial.me.id ? 'message mine' : 'message'} ${newMessageIds.includes(item.id) ? 'message-new' : ''}`} key={`msg-${item.id || 'm'}-${idx}`}>{item.content}<small>{new Date(item.sent_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</small></div>)}{!messages.length && <Empty icon="♡" title="A quiet dock" text="Say the first thing. It will be waiting here." />}</div><div className="emotes" aria-label="Quick reactions">{emotes.map((emote, idx) => <button key={`emote-choice-${emote}-${idx}`} onClick={() => sendEmote(emote)} aria-label={`Send ${emote} emote`}>{emote}</button>)}</div><div className="composer"><input value={message} onChange={event => setMessage(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') sendMessage(); }} placeholder="Say something soft…"/><button onClick={sendMessage} aria-label="Send message"><Send size={18}/></button></div></div>}
    </section>
    {emoteBursts.map(item => <div className="emote-burst" key={item.id} style={{ left: `${item.leftPercent}%` }} aria-hidden="true">{item.emote}</div>)}
    {completion && <div className="completion-veil" role="dialog" aria-modal="true" aria-label="Constellation complete"><div className="completion-sparks"><i>✦</i><i>✧</i><i>✦</i><i>✧</i><i>✦</i></div><div className="completion-card"><span className="completion-mark">✦</span><p className="eyebrow">a shared sky, complete</p><h2>Constellation connected</h2><p>{completion.target_count} stars found together. Another little world is yours now.</p><button className="soft-button" onClick={() => { setCompletion(null); startRound(completion.difficulty); }}>Start another sky <span>→</span></button><button className="completion-close" onClick={() => setCompletion(null)}>Keep this moment</button></div></div>}
    {openBottle && <div className="sheet-backdrop invite-backdrop centered-overlay" onClick={event => { if (event.target === event.currentTarget) setOpenBottle(null); }}><div className="invite-card bottle-reveal"><button className="close" onClick={() => setOpenBottle(null)}><X/></button><span className="section-icon"><GlassWater size={20}/></span><p className="eyebrow">a bottle from {openBottle.username}</p><h2>A little thing to keep</h2><p className="bottle-note">{openBottle.content}</p><small>{relativeTime(openBottle.created_at)}</small></div></div>}
    {inviteOpen && <div className="sheet-backdrop invite-backdrop" onClick={event => { if (event.target === event.currentTarget) setInviteOpen(false); }}><div className="invite-card"><button className="close" onClick={() => setInviteOpen(false)}><X/></button><span className="section-icon"><Heart size={20}/></span><p className="eyebrow">your private room</p><h2>Send them this code</h2><p>They can enter it from the Join their room panel on their device.</p><div className="invite-code">{initial.inviteCode}</div><button className="soft-button" onClick={copyInvite}>Copy invite link</button></div></div>}
    {settingsOpen && <SettingsSheet settings={settings} me={initial.me} close={() => setSettingsOpen(false)} save={saveSettings} newRound={startRound} signOut={signOut} openAudit={() => setAuditOpen(true)} />}
    {auditOpen && <AuditSheet events={initial.audit} close={() => setAuditOpen(false)} />}
  </main>;
}

function relativeTime(value: string) { const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000)); if (seconds < 60) return 'just now'; if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`; if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`; return `${Math.floor(seconds / 86400)}d ago`; }

function AchievementsStrip({ rounds }: { rounds: any[] }) { if (!rounds.length) return <div className="achievement-empty"><span>✦</span>Your first completed sky will live here.</div>; return <section className="achievements"><div className="achievements-head"><p className="eyebrow">our achievements</p><strong>{rounds.length} constellation{rounds.length === 1 ? '' : 's'} connected</strong></div><div className="achievement-list">{rounds.slice(0, 12).map((round, idx) => <article className="achievement" key={`${round.id || 'ach'}-${idx}`}><span>✦</span><div><strong>{round.difficulty}</strong><small>{round.target_count} stars · {relativeTime(round.completed_at)}</small></div></article>)}</div></section>; }

function SectionHeading({ icon, eyebrow, title, subtitle, action }: { icon: React.ReactNode; eyebrow: string; title: string; subtitle: string; action?: React.ReactNode }) { return <div className="scene-heading"><div className="section-title"><span className="section-icon">{icon}</span><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2><p>{subtitle}</p></div></div>{action && <div className="scene-action">{action}</div>}</div>; }
function Empty({ icon, title, text }: { icon: string; title: string; text: string }) { return <div className="empty"><span>{icon}</span><h3>{title}</h3><p>{text}</p></div>; }
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) { return <label className="toggle-row"><span>{label}</span><button type="button" role="switch" aria-checked={checked} className={checked ? 'toggle on' : 'toggle'} onClick={() => onChange(!checked)}><i/></button></label>; }
function SettingsSheet({ settings, me, close, save, newRound, signOut, openAudit }: any) { const [draft, setDraft] = useState(settings); const set = (next: any) => { const value = { ...draft, ...next }; setDraft(value); save(next); }; return <div className="sheet-backdrop" onClick={event => { if (event.target === event.currentTarget) close(); }}><aside className="sheet"><div className="sheet-top"><div><span className="section-icon"><SlidersHorizontal size={20}/></span><p className="eyebrow">shared room settings</p><h2>Our little space</h2></div><button className="close" onClick={close} aria-label="Close settings"><X/></button></div><section><h3>Account</h3><p className="muted">Signed in as {me.username}</p><button className="line-button" onClick={signOut}><LogOut size={16}/>Sign out</button></section><section><h3>Constellation difficulty</h3><p className="control-help">Choosing a level begins the next shared constellation for both of you.</p><div className="difficulty-list">{['easy','normal','hard','custom'].map(level => <button key={level} className={draft.difficulty === level ? 'selected' : ''} onClick={() => { set({ difficulty: level }); newRound(level); }}><strong>{level[0].toUpperCase() + level.slice(1)}</strong><small>{difficultyCopy[level]}</small></button>)}</div></section><section><h3><Volume2 size={16}/> Sound</h3><Toggle label="Sound enabled" checked={draft.sound_enabled ?? true} onChange={value => set({ sound_enabled: value })}/><Toggle label="Emote sound" checked={draft.emote_sound_enabled ?? true} onChange={value => set({ emote_sound_enabled: value })}/></section><section><h3><Bell size={16}/> Notifications</h3><Toggle label="Notifications enabled" checked={draft.notifications_enabled ?? true} onChange={value => set({ notifications_enabled: value })}/><div className="setting-inline"><Clock3 size={15}/><span>Quiet hours are stored for later push notifications.</span></div></section><section><h3><Palette size={16}/> Appearance</h3><Toggle label="Reduce motion" checked={draft.reduce_motion ?? false} onChange={value => set({ reduce_motion: value })}/><div className="theme-row"><button className={draft.theme === 'night' ? 'selected' : ''} onClick={() => set({ theme: 'night' })}>Night</button><button className={draft.theme === 'day' ? 'selected' : ''} onClick={() => set({ theme: 'day' })}>Day</button></div></section><section><h3><ShieldCheck size={16}/> Transparency</h3><button className="line-button" onClick={openAudit}>View our audit log</button></section></aside></div> }
function AuditSheet({ events, close }: any) { return <div className="sheet-backdrop" onClick={event => { if (event.target === event.currentTarget) close(); }}><aside className="sheet audit"><div className="sheet-top"><div><span className="section-icon"><ShieldCheck size={20}/></span><p className="eyebrow">transparency log</p><h2>Our room activity</h2></div><button className="close" onClick={close}><X/></button></div>{events.map((event: any, idx: number) => <div className="audit-row" key={`${event.id || 'evt'}-${idx}`}><strong>{event.event_type.replaceAll('_', ' ')}</strong><small>{new Date(event.created_at).toLocaleString()}</small></div>)}{!events.length && <Empty icon="⌁" title="Nothing to show" text="Security events will appear here." />}</aside></div> }
