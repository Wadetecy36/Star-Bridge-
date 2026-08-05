// StarBridge — server.js
// A small, self-hostable co-op puzzle game for two.
// Express serves the static client; Socket.io handles all real-time state.

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const GRID_SIZE = 5; // 5x5 constellation grid
const MAX_ROUND_STARS = 8;
const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I ambiguity

app.use(express.static(__dirname, {
  // keep the raw source files out of casual browsing while still serving index.html/style.css/client.js
  index: 'index.html'
}));

/** In-memory room store. Fine for two-player rooms with modest lifetime;
 *  swap for Redis if you ever need multi-instance hosting. */
const rooms = new Map();

function makeRoomCode() {
  let code;
  do {
    code = Array.from({ length: 4 }, () =>
      ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)]
    ).join('');
  } while (rooms.has(code));
  return code;
}

function newPuzzleRound(round) {
  const starCount = Math.min(3 + Math.floor(round / 2), MAX_ROUND_STARS);
  const total = GRID_SIZE * GRID_SIZE;
  const pool = Array.from({ length: total }, (_, i) => i);
  // shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const target = pool.slice(0, starCount).sort((a, b) => a - b);
  return {
    round,
    target,
    locked: [],           // indices confirmed by both players
    pending: {},           // idx -> array of playerIds who've clicked it this round
    score: 0
  };
}

function roomState(room) {
  return {
    players: room.players.map(p => ({ name: p.name, side: p.side, connected: p.connected })),
    puzzle: {
      round: room.puzzle.round,
      target: room.puzzle.target,
      locked: room.puzzle.locked,
      pending: Object.fromEntries(
        Object.entries(room.puzzle.pending).map(([k, v]) => [k, v.length])
      ),
      score: room.score
    },
    garden: room.garden
  };
}

function otherPlayer(room, socketId) {
  return room.players.find(p => p.id !== socketId);
}

io.on('connection', (socket) => {
  let currentRoomCode = null;

  socket.on('create_room', ({ name }) => {
    const code = makeRoomCode();
    const room = {
      code,
      players: [{ id: socket.id, name: (name || 'Player 1').slice(0, 20), side: 'a', connected: true }],
      puzzle: newPuzzleRound(1),
      score: 0,
      garden: []
    };
    rooms.set(code, room);
    currentRoomCode = code;
    socket.join(code);
    socket.emit('room_ready', { code, side: 'a', state: roomState(room) });
  });

  socket.on('join_room', ({ code, name }) => {
    const room = rooms.get((code || '').toUpperCase().trim());
    if (!room) {
      socket.emit('join_error', { message: "That code doesn't match any open room." });
      return;
    }
    const existing = room.players.find(p => p.id === socket.id);
    if (!existing && room.players.filter(p => p.connected).length >= 2) {
      socket.emit('join_error', { message: 'That room already has two people in it.' });
      return;
    }
    const side = room.players.length === 0 ? 'a' : (room.players[0].side === 'a' ? 'b' : 'a');
    room.players.push({ id: socket.id, name: (name || 'Player 2').slice(0, 20), side, connected: true });
    currentRoomCode = room.code;
    socket.join(room.code);

    socket.emit('room_ready', { code: room.code, side, state: roomState(room) });
    socket.to(room.code).emit('partner_joined', { state: roomState(room) });
  });

  socket.on('star_click', ({ idx }) => {
    const room = rooms.get(currentRoomCode);
    if (!room) return;
    const { puzzle } = room;
    if (!puzzle.target.includes(idx) || puzzle.locked.includes(idx)) return;

    if (!puzzle.pending[idx]) puzzle.pending[idx] = [];
    if (!puzzle.pending[idx].includes(socket.id)) puzzle.pending[idx].push(socket.id);

    if (puzzle.pending[idx].length >= 2) {
      puzzle.locked.push(idx);
      delete puzzle.pending[idx];
      io.to(room.code).emit('star_locked', { idx });

      const roundComplete = puzzle.target.every(t => puzzle.locked.includes(t));
      if (roundComplete) {
        room.score += 1;
        const nextRound = puzzle.round + 1;
        room.puzzle = newPuzzleRound(nextRound);
        io.to(room.code).emit('round_complete', {
          score: room.score,
          puzzle: {
            round: room.puzzle.round,
            target: room.puzzle.target,
            locked: room.puzzle.locked,
            pending: {}
          }
        });
      }
    } else {
      // Let the partner see a soft "someone's pointing at this star" glow
      socket.to(room.code).emit('star_pending', { idx });
    }
  });

  socket.on('plant', ({ x, y, emoji }) => {
    const room = rooms.get(currentRoomCode);
    if (!room) return;
    if (typeof x !== 'number' || typeof y !== 'number') return;
    const item = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
      emoji: (typeof emoji === 'string' && emoji.length <= 4) ? emoji : '✨',
      by: socket.id
    };
    room.garden.push(item);
    if (room.garden.length > 300) room.garden.shift(); // cap growth so the canvas stays light
    io.to(room.code).emit('plant_added', item);
  });

  socket.on('chat_message', ({ text }) => {
    const room = rooms.get(currentRoomCode);
    if (!room || !text) return;
    const clean = String(text).slice(0, 300);
    const player = room.players.find(p => p.id === socket.id);
    io.to(room.code).emit('chat_message', {
      text: clean,
      side: player ? player.side : '?',
      name: player ? player.name : 'Someone',
      ts: Date.now()
    });
  });

  socket.on('emote', ({ emoji }) => {
    const room = rooms.get(currentRoomCode);
    if (!room || !emoji) return;
    const player = room.players.find(p => p.id === socket.id);
    io.to(room.code).emit('emote', { emoji, side: player ? player.side : '?' });
  });

  socket.on('cursor_move', ({ x, y }) => {
    const room = rooms.get(currentRoomCode);
    if (!room) return;
    socket.to(room.code).emit('partner_cursor', { x, y });
  });

  socket.on('disconnect', () => {
    const room = rooms.get(currentRoomCode);
    if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (player) player.connected = false;
    socket.to(room.code).emit('partner_left');

    // Clean up empty/abandoned rooms after a grace period
    setTimeout(() => {
      const r = rooms.get(currentRoomCode);
      if (r && r.players.every(p => !p.connected)) {
        rooms.delete(currentRoomCode);
      }
    }, 10 * 60 * 1000);
  });
});

server.listen(PORT, () => {
  console.log(`StarBridge is running at http://localhost:${PORT}`);
});
