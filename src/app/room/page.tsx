import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyRoomSession } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase-server';
import RoomApp from '@/components/RoomApp';

export default async function RoomPage() {
  const cookieStore = await cookies();
  const session = await verifyRoomSession(cookieStore.get('constellation_session')?.value);
  if (!session) redirect('/');
  const { data: user } = await supabaseAdmin.from('users').select('id,room_id,username,is_online,last_seen_at').eq('id', session.userId).maybeSingle();
  if (!user || user.room_id !== session.roomId) redirect('/');
  const { data: room } = await supabaseAdmin.from('rooms').select('invite_code').eq('id', user.room_id).maybeSingle();
  const { data: people } = await supabaseAdmin.from('users').select('id,username,is_online,last_seen_at').eq('room_id', user.room_id).order('created_at');
  const personIds = (people || []).map((person: { id: string }) => person.id);
  const [{ data: settings }, { data: activeRound }, { data: audit }] = await Promise.all([
    supabaseAdmin.from('user_settings').select('*').eq('user_id', user.id).maybeSingle(),
    supabaseAdmin.from('constellation_rounds').select('*').eq('room_id', user.room_id).eq('status', 'active').maybeSingle(),
    personIds.length ? supabaseAdmin.from('audit_log').select('id,event_type,metadata,created_at,user_id').in('user_id', personIds).order('created_at', { ascending: false }).limit(30) : Promise.resolve({ data: [] }),
  ]);
  let stars: unknown[] = [];
  if (activeRound) { const { data } = await supabaseAdmin.from('constellation_stars').select('*').eq('round_id', activeRound.id).order('position'); stars = data || []; }
  return <RoomApp initial={{ me: user, people: people || [], settings, activeRound, stars, audit: audit || [], inviteCode: room?.invite_code || '' }} />;
}
