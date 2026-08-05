(() => {
  const socket = io();

  // ---------- state ----------
  let mySide = null;
  let myName = '';
  let roomCode = null;
  let currentPuzzle = { target: [], locked: [] };
  let selectedSeed = '✨';
  const GRID_CELLS = 25;

  // ---------- element refs ----------
  const screens = {
    lobby: document.getElementById('lobby'),
    waiting: document.getElementById('waiting'),
    game: document.getElementById('game'),
  };

  const nameInput = document.getElementById('name-input');
  const createBtn = document.getElementById('create-btn');
  const joinBtn = document.getElementById('join-btn');
  const codeInput = document.getElementById('code-input');
  const lobbyError = document.getElementById('lobby-error');

  const roomCodeDisplay = document.getElementById('room-code-display');
  const copyLinkBtn = document.getElementById('copy-link-btn');

  const meName = document.getElementById('me-name');
  const meStar = document.getElementById('me-star');
  const partnerName = document.getElementById('partner-name');
  const partnerBadge = document.querySelector('.player-badge.partner');
  const roomCodeMini = document.getElementById('room-code-mini');
  const bridgeStars = document.getElementById('bridge-stars');
  const connectionBanner = document.getElementById('connection-banner');

  const scoreDisplay = document.getElementById('score-display');
  const starGrid = document.getElementById('star-grid');

  const gardenCanvas = document.getElementById('garden-canvas');
  const gardenPalette = document.getElementById('garden-palette');

  const chatForm = document.getElementById('chat-form');
  const chatInput = document.getElementById('chat-input');
  const chatLog = document.getElementById('chat-log');
  const emoteBar = document.getElementById('emote-bar');
  const emoteOverlay = document.getElementById('emote-overlay');

  const tabs = document.querySelectorAll('.tab');
  const panels = document.querySelectorAll('.panel');

  function showScreen(name) {
    Object.entries(screens).forEach(([key, el]) => el.classList.toggle('hidden', key !== name));
  }

  // ---------- lobby ----------
  createBtn.addEventListener('click', () => {
    myName = nameInput.value.trim() || 'Player 1';
    socket.emit('create_room', { name: myName });
  });

  joinBtn.addEventListener('click', attemptJoin);
  codeInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') attemptJoin(); });
  codeInput.addEventListener('input', () => {
    codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  });

  function attemptJoin() {
    const code = codeInput.value.trim();
    if (code.length !== 4) {
      lobbyError.textContent = 'Room codes are 4 characters.';
      return;
    }
    myName = nameInput.value.trim() || 'Player 2';
    socket.emit('join_room', { code, name: myName });
  }

  // Support ?room=CODE deep links
  const params = new URLSearchParams(window.location.search);
  const linkedRoom = params.get('room');
  if (linkedRoom) codeInput.value = linkedRoom.toUpperCase();

  socket.on('join_error', ({ message }) => {
    lobbyError.textContent = message;
  });

  socket.on('room_ready', ({ code, side, state }) => {
    roomCode = code;
    mySide = side;
    lobbyError.textContent = '';
    meName.textContent = myName;
    roomCodeMini.textContent = code;

    applyState(state);

    const bothConnected = state.players.filter(p => p.connected).length === 2;
    if (bothConnected) {
      enterGame(state);
    } else {
      roomCodeDisplay.textContent = code;
      showScreen('waiting');
    }
  });

  copyLinkBtn.addEventListener('click', () => {
    const url = `${window.location.origin}${window.location.pathname}?room=${roomCode}`;
    navigator.clipboard?.writeText(url).then(() => {
      copyLinkBtn.textContent = 'Copied ✓';
      setTimeout(() => (copyLinkBtn.textContent = 'Copy invite link'), 1800);
    }).catch(() => {
      copyLinkBtn.textContent = url;
    });
  });

  socket.on('partner_joined', ({ state }) => {
    applyState(state);
    enterGame(state);
  });

  function enterGame(state) {
    showScreen('game');
    setPartnerOnline(true);
    const partner = state.players.find(p => p.side !== mySide);
    if (partner) partnerName.textContent = partner.name;
    renderGrid();
  }

  function applyState(state) {
    currentPuzzle = state.puzzle;
    scoreDisplay.textContent = state.puzzle.score;
    renderBridgeStars(state.puzzle.score);
    renderGarden(state.garden);
    const partner = state.players.find(p => p.side !== mySide);
    if (partner) partnerName.textContent = partner.name;
  }

  function setPartnerOnline(online) {
    partnerBadge.classList.toggle('online', online);
  }

  socket.on('partner_left', () => {
    setPartnerOnline(false);
    connectionBanner.textContent = 'Your partner drifted off — keep the room open, they can rejoin with the same code.';
    connectionBanner.classList.remove('hidden');
  });

  // ---------- tabs ----------
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
      tab.classList.add('active'); tab.setAttribute('aria-selected', 'true');
      const target = tab.dataset.tab;
      panels.forEach(p => p.classList.toggle('active', p.id === `panel-${target}`));
    });
  });

  // ---------- constellation puzzle ----------
  function renderGrid() {
    starGrid.innerHTML = '';
    for (let i = 0; i < GRID_CELLS; i++) {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'star-cell';
      cell.dataset.idx = i;
      cell.setAttribute('aria-label', `Star ${i + 1}`);
      if (currentPuzzle.target.includes(i)) cell.classList.add('target');
      if (currentPuzzle.locked.includes(i)) cell.classList.add('locked');
      cell.addEventListener('click', () => {
        if (cell.classList.contains('locked') || !cell.classList.contains('target')) return;
        socket.emit('star_click', { idx: i });
      });
      starGrid.appendChild(cell);
    }
  }

  function renderBridgeStars(score) {
    bridgeStars.innerHTML = '';
    const shown = Math.min(score, 12);
    for (let i = 0; i < shown; i++) {
      const s = document.createElement('span');
      s.className = 'b-star';
      s.textContent = '★';
      bridgeStars.appendChild(s);
    }
  }

  socket.on('star_pending', ({ idx }) => {
    const cell = starGrid.querySelector(`[data-idx="${idx}"]`);
    if (cell) cell.classList.add('pending');
  });

  socket.on('star_locked', ({ idx }) => {
    const cell = starGrid.querySelector(`[data-idx="${idx}"]`);
    if (cell) { cell.classList.remove('pending'); cell.classList.add('locked'); }
    if (!currentPuzzle.locked.includes(idx)) currentPuzzle.locked.push(idx);
  });

  socket.on('round_complete', ({ score, puzzle }) => {
    currentPuzzle = { target: puzzle.target, locked: puzzle.locked, score };
    scoreDisplay.textContent = score;
    renderBridgeStars(score);
    setTimeout(renderGrid, 450); // small beat so the last lock animation is visible
  });

  // ---------- garden ----------
  gardenPalette.addEventListener('click', (e) => {
    const btn = e.target.closest('.seed-btn');
    if (!btn) return;
    document.querySelectorAll('.seed-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedSeed = btn.dataset.emoji;
  });
  gardenPalette.querySelector('.seed-btn')?.classList.add('selected');

  gardenCanvas.addEventListener('click', (e) => {
    const rect = gardenCanvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    socket.emit('plant', { x, y, emoji: selectedSeed });
  });

  gardenCanvas.addEventListener('mousemove', (e) => {
    const rect = gardenCanvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    socket.emit('cursor_move', { x, y });
  });

  gardenCanvas.addEventListener('touchmove', (e) => {
    const touch = e.touches[0];
    if (!touch) return;
    const rect = gardenCanvas.getBoundingClientRect();
    const x = ((touch.clientX - rect.left) / rect.width) * 100;
    const y = ((touch.clientY - rect.top) / rect.height) * 100;
    socket.emit('cursor_move', { x, y });
  }, { passive: true });

  let partnerCursorEl = null;
  socket.on('partner_cursor', ({ x, y }) => {
    if (!partnerCursorEl) {
      partnerCursorEl = document.createElement('div');
      partnerCursorEl.className = 'partner-cursor';
      partnerCursorEl.textContent = '✦';
      gardenCanvas.appendChild(partnerCursorEl);
    }
    partnerCursorEl.style.left = `${x}%`;
    partnerCursorEl.style.top = `${y}%`;
  });

  function renderGarden(items) {
    gardenCanvas.querySelectorAll('.garden-item, .garden-empty-note').forEach(el => el.remove());
    if (!items || items.length === 0) {
      const note = document.createElement('div');
      note.className = 'garden-empty-note';
      note.textContent = 'Nothing planted yet — pick a seed above and click anywhere.';
      gardenCanvas.appendChild(note);
      return;
    }
    items.forEach(addGardenItem);
  }

  function addGardenItem(item) {
    gardenCanvas.querySelector('.garden-empty-note')?.remove();
    const el = document.createElement('div');
    el.className = 'garden-item';
    el.style.left = `${item.x}%`;
    el.style.top = `${item.y}%`;
    el.textContent = item.emoji;
    gardenCanvas.appendChild(el);
  }

  socket.on('plant_added', addGardenItem);

  // ---------- chat ----------
  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (!text) return;
    socket.emit('chat_message', { text });
    chatInput.value = '';
  });

  socket.on('chat_message', ({ text, side, name }) => {
    const line = document.createElement('div');
    line.className = `chat-line ${side === mySide ? 'me' : 'them'}`;
    const who = document.createElement('span');
    who.className = 'who';
    who.textContent = `${side === mySide ? 'You' : name}:`;
    line.appendChild(who);
    line.appendChild(document.createTextNode(text));
    chatLog.appendChild(line);
    chatLog.scrollTop = chatLog.scrollHeight;
  });

  // ---------- emotes ----------
  emoteBar.addEventListener('click', (e) => {
    const btn = e.target.closest('.emote-btn');
    if (!btn) return;
    const emoji = btn.dataset.emoji;
    socket.emit('emote', { emoji });
    spawnFloatingEmote(emoji, true);
  });

  socket.on('emote', ({ emoji, side }) => {
    if (side === mySide) return; // avoid double-render for our own emote
    spawnFloatingEmote(emoji, false);
  });

  function spawnFloatingEmote(emoji, mine) {
    const el = document.createElement('div');
    el.className = 'floating-emote';
    el.textContent = emoji;
    const basePct = mine ? 65 : 25;
    el.style.left = `${basePct + (Math.random() * 12 - 6)}%`;
    emoteOverlay.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  }

})();
