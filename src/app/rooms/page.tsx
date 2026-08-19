'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, Clock3, Sparkles } from 'lucide-react';

type SavedRoom = { roomId: string; userId: string; username: string; inviteCode: string; savedAt: number };
const KEY = 'constellation-my-rooms';

export default function MyRoomsPage() {
  const [rooms, setRooms] = useState<SavedRoom[]>([]);
  useEffect(() => { (async () => { try { const local = JSON.parse(localStorage.getItem(KEY) || '[]'); const response = await fetch('/api/my-rooms'); const remote = response.ok ? (await response.json()).rooms : []; const combined = [...local, ...remote].reduce((all: SavedRoom[], room: SavedRoom) => all.some(item => item.roomId === room.roomId) ? all : [...all, room], []).slice(0, 12); setRooms(combined); localStorage.setItem(KEY, JSON.stringify(combined)); } catch { setRooms([]); } })(); }, []);
  function forget(roomId: string) { const next = rooms.filter(room => room.roomId !== roomId); setRooms(next); localStorage.setItem(KEY, JSON.stringify(next)); }
  return <main className="classic-landing"><div className="aurora aurora-one"/><div className="aurora aurora-two"/><section className="classic-card rooms-card"><div className="orbit-mark"><Sparkles size={23}/></div><p className="classic-eyebrow">this browser’s little skies</p><h1>My Rooms</h1><p className="classic-tagline">Rooms you have created or joined on this device are kept here for an easy return.</p>{rooms.length ? <div className="saved-room-list">{rooms.map(room => <article key={room.roomId} className="saved-room"><div><p className="saved-code">{room.inviteCode}</p><strong>{room.username}'s room</strong><small><Clock3 size={13}/>Saved {new Date(room.savedAt).toLocaleDateString()}</small></div><div className="saved-actions"><a href="/room">Open <ArrowRight size={15}/></a><button onClick={() => forget(room.roomId)}>Forget</button></div></article>)}</div> : <div className="my-rooms-empty"><span>✦</span><h2>No saved rooms yet</h2><p>Create a room or join one here, and it will appear on this device.</p></div>}<a className="return-home" href="/">← Back to StarBridge</a></section></main>;
}
