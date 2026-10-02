import { createClient } from '@supabase/supabase-js';

let cachedClient: any = null;

export function supabaseBrowser(): any {
  if (typeof window !== 'undefined' && (window as any).__supabaseBrowserClientInstance) {
    return (window as any).__supabaseBrowserClientInstance;
  }
  if (cachedClient) return cachedClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (url && anonKey) {
    try {
      cachedClient = createClient(url, anonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
          storageKey: 'sb-constellation-browser-singleton',
        },
      });
      if (typeof window !== 'undefined') {
        (window as any).__supabaseBrowserClientInstance = cachedClient;
      }
      return cachedClient;
    } catch (e) {
      console.warn('Failed to initialize Supabase client:', e);
    }
  }

  // Active real-time channel manager for in-memory room
  return {
    channel: (channelName: string) => {
      const roomId = channelName.replace(/^room-/, '');
      const listeners: Array<{
        table: string;
        event: string;
        callback: (payload: any) => void;
      }> = [];

      let pollTimer: number | null = null;
      let lastEventId = 0;
      let active = true;

      const poll = async () => {
        if (!active) return;
        try {
          const res = await fetch(`/api/events?roomId=${encodeURIComponent(roomId)}&since=${lastEventId}`, {
            cache: 'no-store',
          });
          if (res.ok) {
            const data = await res.json();
            const events = data.events || [];
            for (const ev of events) {
              if (ev.id > lastEventId) lastEventId = ev.id;
              for (const l of listeners) {
                const tableMatch = l.table === '*' || l.table === ev.table;
                const eventMatch = l.event === '*' || l.event === ev.eventType;
                if (tableMatch && eventMatch) {
                  try {
                    l.callback({
                      new: ev.new,
                      old: ev.old,
                      eventType: ev.eventType,
                      table: ev.table,
                    });
                  } catch (cbErr) {
                    console.error('Error in realtime listener callback:', cbErr);
                  }
                }
              }
            }
          }
        } catch {
          // Ignore transient network errors
        }
        if (active) {
          pollTimer = window.setTimeout(poll, 700);
        }
      };

      const channelObj: any = {
        on: (
          type: string,
          filter: { event: string; schema?: string; table: string },
          callback: (payload: any) => void
        ) => {
          if (type === 'postgres_changes') {
            listeners.push({
              table: filter.table,
              event: filter.event,
              callback,
            });
          }
          return channelObj;
        },
        subscribe: () => {
          // Fetch initial recent event ID so we only process new events
          fetch(`/api/events?roomId=${encodeURIComponent(roomId)}&since=0`, { cache: 'no-store' })
            .then(r => r.json())
            .then(d => {
              const evs = d.events || [];
              if (evs.length > 0) {
                lastEventId = evs[evs.length - 1].id;
              }
              if (active) {
                pollTimer = window.setTimeout(poll, 600);
              }
            })
            .catch(() => {
              if (active) {
                pollTimer = window.setTimeout(poll, 600);
              }
            });
          return channelObj;
        },
        unsubscribe: () => {
          active = false;
          if (pollTimer) window.clearTimeout(pollTimer);
        },
      };

      return channelObj;
    },
    removeChannel: (channel: any) => {
      if (channel && typeof channel.unsubscribe === 'function') {
        channel.unsubscribe();
      }
    },
    from: (table: string) => {
      const builder: any = {
        select: () => builder,
        insert: () => builder,
        update: () => builder,
        upsert: async (values: any) => {
          if (table === 'user_settings') {
            await fetch('/api/settings', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(values),
            }).catch(() => {});
          }
          return { data: values, error: null };
        },
        eq: () => builder,
        order: () => builder,
        single: () => Promise.resolve({ data: null, error: null }),
        maybeSingle: () => Promise.resolve({ data: null, error: null }),
        then: (resolve: any) => resolve({ data: [], error: null }),
      };
      return builder;
    },
  };
}
