import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyRoomSession } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase-server';

const configs: Record<string, { grid: number; targets: number; timer: number | null }> = {
  easy: { grid: 5, targets: 3, timer: null },
  normal: { grid: 5, targets: 5, timer: null },
  hard: { grid: 5, targets: 7, timer: 90 },
};

function targets(grid: number, count: number) {
  const all = Array.from({ length: grid * grid }, (_, index) => index);
  for (let i = all.length - 1; i > 0; i -= 1) { const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1); [all[i], all[j]] = [all[j], all[i]]; }
  return new Set(all.slice(0, count));
}

async function current() {
  const store = await cookies();
  return verifyRoomSession(store.get('constellation_session')?.value);
}

export async function POST(request: NextRequest) {
  const session = await current();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => null);
  const action = body?.action;
  const { data: me } = await supabaseAdmin.from('users').select('id,room_id').eq('id', session.userId).maybeSingle();
  if (!me || me.room_id !== session.roomId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (action === 'new_round') {
    const difficulty = String(body?.difficulty || 'normal');
    const stored = await supabaseAdmin.from('user_settings').select('*').eq('user_id', me.id).maybeSingle();
    const config = difficulty === 'custom' ? { grid: Math.min(8, Math.max(5, Number(stored.data?.custom_grid_size || 5))), targets: Math.max(1, Number(stored.data?.custom_target_count || 5)), timer: stored.data?.custom_timer_seconds || null } : configs[difficulty] || configs.normal;
    await supabaseAdmin.from('constellation_rounds').update({ status: 'reset' }).eq('room_id', me.room_id).eq('status', 'active');
    const { data: round, error } = await supabaseAdmin.from('constellation_rounds').insert({ room_id: me.room_id, grid_size: config.grid, target_count: config.targets, time_limit_seconds: config.timer, difficulty, status: 'active' }).select().single();
    if (error || !round) return NextResponse.json({ error: error?.message || 'Could not begin round' }, { status: 400 });
    await supabaseAdmin.from('constellation_stars').insert(Array.from({ length: config.grid * config.grid }, (_, position) => ({ round_id: round.id, position, is_target: targets(config.grid, config.targets).has(position) })));
    await supabaseAdmin.from('user_settings').update({ difficulty }).eq('user_id', me.id);
    await supabaseAdmin.from('audit_log').insert({ user_id: me.id, event_type: 'difficulty_changed', metadata: { difficulty } });
    return NextResponse.json({ round });
  }

  if (action === 'click_star') {
    const position = Number(body?.position);
    const { data: round } = await supabaseAdmin.from('constellation_rounds').select('*').eq('room_id', me.room_id).eq('status', 'active').maybeSingle();
    if (!round || !Number.isInteger(position)) return NextResponse.json({ error: 'No active round' }, { status: 400 });
    const { data: star } = await supabaseAdmin.from('constellation_stars').select('*').eq('round_id', round.id).eq('position', position).maybeSingle();
    if (!star?.is_target || star.locked_at) return NextResponse.json({ ok: true });
    const { data: people } = await supabaseAdmin.from('users').select('id').eq('room_id', me.room_id).order('created_at');
    const first = people?.[0]?.id; const field = first === me.id ? 'clicked_by_user_1' : 'clicked_by_user_2';
    const update: Record<string, string> = { [field]: me.id };
    if (star.clicked_by_user_1 && star.clicked_by_user_2 || (field === 'clicked_by_user_1' && star.clicked_by_user_2) || (field === 'clicked_by_user_2' && star.clicked_by_user_1)) update.locked_at = new Date().toISOString();
    await supabaseAdmin.from('constellation_stars').update(update).eq('id', star.id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
