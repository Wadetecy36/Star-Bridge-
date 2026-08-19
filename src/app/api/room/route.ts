import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyRoomSession, signRoomSession } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase-server';

const COOKIE = 'constellation_session';
const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function code() { const bytes = crypto.getRandomValues(new Uint8Array(8)); return Array.from(bytes, value => CHARS[value % CHARS.length]).join(''); }
function hash(value: string) { let result = 0; for (let i = 0; i < value.length; i += 1) result = ((result << 5) - result) + value.charCodeAt(i) | 0; return Math.abs(result).toString(36); }
async function audit(userId: string | null, event: string, metadata: Record<string, unknown>, ip: string | null) { await supabaseAdmin.from('audit_log').insert({ user_id: userId, event_type: event, metadata, ip_hash: ip ? hash(ip) : null }); }
async function sessionResponse(userId: string, roomId: string, request: NextRequest, inviteCode: string | null = null) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null; const userAgent = request.headers.get('user-agent');
  const { data: session, error } = await supabaseAdmin.from('sessions').insert({ user_id: userId, ip_hash: ip ? hash(ip) : null, user_agent: userAgent }).select('id').single();
  if (error || !session) throw new Error(error?.message || 'Could not start session');
  const token = await signRoomSession({ userId, roomId, sessionId: session.id });
  const response = NextResponse.json({ ok: true, userId, roomId, inviteCode });
  response.cookies.set(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: false, maxAge: 60 * 60 * 24 * 90, path: '/' });
  return response;
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const action = body?.action;
  const username = String(body?.username || '').trim().slice(0, 30);
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const existing = await verifyRoomSession(request.cookies.get(COOKIE)?.value);
  if (existing) {
    const { data: existingUser } = await supabaseAdmin.from('users').select('id,room_id').eq('id', existing.userId).maybeSingle();
    if (existingUser?.room_id === existing.roomId) {
      await supabaseAdmin.from('users').update({ is_online: true, last_seen_at: new Date().toISOString() }).eq('id', existing.userId);
      if (action === 'join') return NextResponse.json({ ok: false, activeSession: true, error: 'This browser already has a room open. Use My Rooms to return to it, or sign out before joining a different room.' }, { status: 409 });
      if (action === 'create') return NextResponse.json({ ok: false, activeSession: true, error: 'This browser already has a room open. Use My Rooms or sign out before creating another room.' }, { status: 409 });
    }
  }
  if (!username) return NextResponse.json({ error: 'Please choose a name.' }, { status: 400 });
  if (action === 'create') {
    for (let tries = 0; tries < 5; tries += 1) {
      const inviteCode = code(); const { data: room, error: roomError } = await supabaseAdmin.from('rooms').insert({ invite_code: inviteCode }).select('id').single(); if (roomError || !room) continue;
      const { data: user, error: userError } = await supabaseAdmin.from('users').insert({ room_id: room.id, username, is_online: true }).select('id').single(); if (userError || !user) return NextResponse.json({ error: userError?.message || 'Could not create your room.' }, { status: 400 });
      await supabaseAdmin.from('user_settings').insert({ user_id: user.id }); await audit(user.id, 'account_created', { action: 'create_room', inviteCode }, ip); await audit(user.id, 'login_success', { action: 'create_room' }, ip); return sessionResponse(user.id, room.id, request, inviteCode);
    }
    return NextResponse.json({ error: 'Could not create a unique room code. Please try again.' }, { status: 500 });
  }
  if (action === 'join') {
    const inviteCode = String(body?.inviteCode || '').trim().toUpperCase(); if (!/^[A-Z2-9]{6,8}$/.test(inviteCode)) return NextResponse.json({ error: 'Enter a valid room code.' }, { status: 400 });
    const ipHash = hash(ip); const now = new Date().toISOString(); const { data: limit } = await supabaseAdmin.from('join_rate_limits').select('*').eq('invite_code', inviteCode).eq('ip_hash', ipHash).maybeSingle(); if (limit?.locked_until && new Date(limit.locked_until) > new Date()) return NextResponse.json({ error: 'Too many attempts. Try again in 30 minutes.' }, { status: 429 });
    const { data: room } = await supabaseAdmin.from('rooms').select('id,max_users').eq('invite_code', inviteCode).maybeSingle(); const { count } = room ? await supabaseAdmin.from('users').select('id', { count: 'exact', head: true }).eq('room_id', room.id) : { count: 0 };
    if (!room) {
      const attempts = (limit?.failed_attempts || 0) + 1;
      const lockedUntil = attempts >= 5 ? new Date(Date.now() + 30 * 60 * 1000).toISOString() : null;
      await supabaseAdmin.from('join_rate_limits').upsert({ invite_code: inviteCode, ip_hash: ipHash, failed_attempts: attempts, window_started_at: now, locked_until: lockedUntil }, { onConflict: 'invite_code,ip_hash' });
      await audit(null, 'login_failed', { reason: 'unknown_code', inviteCode }, ip);
      return NextResponse.json({ error: 'That room code was not found.' }, { status: 404 });
    }
    const { data: existingNamedUser } = await supabaseAdmin.from('users').select('id,room_id').eq('room_id', room.id).eq('username', username).maybeSingle();
    if (existingNamedUser) {
      await supabaseAdmin.from('users').update({ is_online: true, last_seen_at: new Date().toISOString() }).eq('id', existingNamedUser.id);
      await audit(existingNamedUser.id, 'login_success', { action: 'rejoin_named_room', inviteCode }, ip);
      return sessionResponse(existingNamedUser.id, room.id, request, inviteCode);
    }
    if (!room || (count || 0) >= room.max_users) { const attempts = (limit?.failed_attempts || 0) + 1; const lockedUntil = attempts >= 5 ? new Date(Date.now() + 30 * 60 * 1000).toISOString() : null; await supabaseAdmin.from('join_rate_limits').upsert({ invite_code: inviteCode, ip_hash: ipHash, failed_attempts: attempts, window_started_at: now, locked_until: lockedUntil }, { onConflict: 'invite_code,ip_hash' }); await audit(null, 'login_failed', { reason: !room ? 'unknown_code' : 'room_full', inviteCode }, ip); return NextResponse.json({ error: !room ? 'That room code was not found.' : 'That room already has two people.' }, { status: !room ? 404 : 409 }); }
    const { data: user, error } = await supabaseAdmin.from('users').insert({ room_id: room.id, username, is_online: true }).select('id').single(); if (error || !user) return NextResponse.json({ error: error?.message || 'Could not join room.' }, { status: 400 });
    await supabaseAdmin.from('user_settings').insert({ user_id: user.id }); await audit(user.id, 'account_created', { action: 'join_room', inviteCode }, ip); await audit(user.id, 'login_success', { action: 'join_room' }, ip); return sessionResponse(user.id, room.id, request);
  }
  return NextResponse.json({ error: 'Unknown auth action.' }, { status: 400 });
}
export async function DELETE() { const response = NextResponse.json({ ok: true }); response.cookies.set(COOKIE, '', { maxAge: 0, path: '/' }); return response; }
