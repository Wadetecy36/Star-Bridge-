import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const EVENTS_FILE_PATH = path.join('/tmp', 'starbridge_events.json');

export interface RoomEvent {
  id: number;
  room_id: string;
  table: string;
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: any;
  old: any;
  timestamp: number;
}

function loadEvents(): RoomEvent[] {
  try {
    if (fs.existsSync(EVENTS_FILE_PATH)) {
      const content = fs.readFileSync(EVENTS_FILE_PATH, 'utf-8');
      return JSON.parse(content);
    }
  } catch {}
  return [];
}

function saveEvents(events: RoomEvent[]) {
  try {
    fs.writeFileSync(EVENTS_FILE_PATH, JSON.stringify(events), 'utf-8');
  } catch {}
}

const userRoomCache = new Map<string, string>();
const roundRoomCache = new Map<string, string>();

const realAdmin: any =
  url && serviceKey
    ? createClient(url, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

async function resolveRoomId(table: string, data: any): Promise<string | null> {
  if (!data) return null;
  const single = Array.isArray(data) ? data[0] : data;
  if (!single) return null;

  if (table === 'rooms') {
    return single.id || null;
  }
  if (table === 'users') {
    if (single.id && single.room_id) userRoomCache.set(single.id, single.room_id);
    return single.room_id || null;
  }
  if (table === 'constellation_rounds') {
    if (single.id && single.room_id) roundRoomCache.set(single.id, single.room_id);
    return single.room_id || null;
  }
  if (table === 'memory_bottles') {
    return single.room_id || null;
  }
  if (table === 'constellation_stars') {
    const roundId = single.round_id;
    if (!roundId) return null;
    if (roundRoomCache.has(roundId)) return roundRoomCache.get(roundId)!;
    if (realAdmin) {
      const { data: round } = await realAdmin.from('constellation_rounds').select('room_id').eq('id', roundId).maybeSingle();
      if (round?.room_id) {
        roundRoomCache.set(roundId, round.room_id);
        return round.room_id;
      }
    }
  }
  if (table === 'garden_plants' || table === 'messages' || table === 'emotes' || table === 'user_settings' || table === 'audit_log') {
    const userId = single.user_id;
    if (!userId) return null;
    if (userRoomCache.has(userId)) return userRoomCache.get(userId)!;
    if (realAdmin) {
      const { data: user } = await realAdmin.from('users').select('room_id').eq('id', userId).maybeSingle();
      if (user?.room_id) {
        userRoomCache.set(userId, user.room_id);
        return user.room_id;
      }
    }
  }
  return null;
}

export async function broadcastEvent(table: string, eventType: 'INSERT' | 'UPDATE' | 'DELETE', newRow: any, oldRow: any) {
  try {
    const roomId = await resolveRoomId(table, newRow || oldRow);
    if (!roomId) return;

    const events = loadEvents();
    const lastId = events.length > 0 ? events[events.length - 1].id : 0;
    const ev: RoomEvent = {
      id: lastId + 1,
      room_id: roomId,
      table,
      eventType,
      new: newRow,
      old: oldRow,
      timestamp: Date.now(),
    };
    events.push(ev);
    if (events.length > 500) events.shift();
    saveEvents(events);
  } catch {}
}

export function getEventsForRoom(roomId: string, since: number): RoomEvent[] {
  const events = loadEvents();
  return events.filter(e => e.room_id === roomId && e.id > since);
}

function wrapBuilder(table: string, builder: any, action: string, payload?: any): any {
  return new Proxy(builder, {
    get(target, prop) {
      if (prop === 'then') {
        return (onfulfilled: any, onrejected: any) => {
          return target.then(async (res: any) => {
            if (!res?.error && action !== 'select') {
              const eventType = action === 'insert' ? 'INSERT' : action === 'delete' ? 'DELETE' : 'UPDATE';
              const items = Array.isArray(res.data) ? res.data : res.data ? [res.data] : Array.isArray(payload) ? payload : payload ? [payload] : [];
              for (const item of items) {
                void broadcastEvent(table, eventType, item, null);
              }
            }
            if (onfulfilled) return onfulfilled(res);
            return res;
          }, onrejected);
        };
      }
      const val = target[prop];
      if (typeof val === 'function') {
        return (...args: any[]) => {
          const res = val.apply(target, args);
          if (res && typeof res.then === 'function') {
            return wrapBuilder(table, res, action, payload);
          }
          return res;
        };
      }
      return val;
    },
  });
}

function createProxyClient(baseClient: any) {
  return {
    from: (table: string) => {
      const q = baseClient.from(table);
      return new Proxy(q, {
        get(target, prop) {
          if (prop === 'insert' || prop === 'update' || prop === 'delete' || prop === 'upsert') {
            return (...args: any[]) => {
              const b = target[prop](...args);
              return wrapBuilder(table, b, prop as string, args[0]);
            };
          }
          const val = target[prop];
          if (typeof val === 'function') {
            return (...args: any[]) => {
              const res = val.apply(target, args);
              if (res && typeof res.then === 'function') {
                return wrapBuilder(table, res, 'select');
              }
              return res;
            };
          }
          return val;
        },
      });
    },
  };
}

export const supabaseAdmin: any = realAdmin ? createProxyClient(realAdmin) : null;
export const publicSupabaseUrl = url || '';
export const publicSupabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
