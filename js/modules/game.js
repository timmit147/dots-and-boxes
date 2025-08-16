import { auth, db, doc, setDoc, getDoc, updateDoc, onSnapshot, collection, deleteDoc, signInAnonymously } from '../firebase.js';
import { setGridLayout, getBoxIndex, renderBoard } from './board.js';

// Ensure guest login if no user is signed in
async function ensureUserSignedIn() {
  if (auth.currentUser) return auth.currentUser;
  const cred = await signInAnonymously(auth);
  return cred.user;
}

export function initGame() {
  const authContainer = document.getElementById('auth-container');
  const gameLobbyContainer = document.getElementById('game-lobby-container');
  const gameContainer = document.getElementById('game-container');
  const backButton = document.getElementById('back-button');
  const playGameButton = document.getElementById('play-game-button');
  const playBotButton = document.getElementById('play-bot-button');
  const lobbyStatus = document.getElementById('lobby-status');
  const board = document.querySelector('.board');
  const playerNamesContainer = document.getElementById('player-names-container');
  const timerDisplay = document.getElementById('timer-container');

  let players = [];
  let currentPlayerId = null;
  let currentGameId = null;
  let unsubscribeFromGame = null;
  let boardState = Array(100).fill(null);
  let gameEnded = false;
  let timerSeconds = 15;
  let botGame = false;

  // --- Return to login screen ---
  async function stopGameAndGoToLogin() {
    try {
      if (unsubscribeFromGame) unsubscribeFromGame();
      if (currentGameId) {
        try { await updateDoc(doc(db, 'games', currentGameId), { status: 'ended' }); } catch {}
      }
    } finally {
      currentGameId = null;
      gameContainer.style.display = 'none';
      gameLobbyContainer.style.display = 'none';
      authContainer.style.display = 'flex';
    }
  }

  backButton?.addEventListener('click', stopGameAndGoToLogin);

  // --- Normal Play Game (multiplayer) ---
  playGameButton?.addEventListener('click', async () => {
    try {
      playGameButton.disabled = true;
      await ensureUserSignedIn();
      lobbyStatus.textContent = 'Waiting for opponent...';

      const matchesRef = collection(db, 'matches');
      const myMatchRef = doc(matchesRef, auth.currentUser.uid);
      await setDoc(myMatchRef, { uid: auth.currentUser.uid, timestamp: Date.now() });

      const unsubscribe = onSnapshot(matchesRef, async (snapshot) => {
        const waiting = [];
        snapshot.forEach(d => waiting.push(d.id));
        if (waiting.length < 2) return;

        const pair = waiting.slice(0, 2).sort();
        const opponentUid = pair.find(id => id !== auth.currentUser.uid);
        const gameId = pair.join('-');

        if (auth.currentUser.uid === pair[0]) {
          const gameRef = doc(db, 'games', gameId);

          const myName = auth.currentUser.isAnonymous
            ? 'Guest' + Math.floor(1000 + Math.random() * 9000)
            : (auth.currentUser.email?.split('@')[0] || 'Player');

          let oppName = 'Guest' + Math.floor(1000 + Math.random() * 9000);
          try {
            const oppDoc = await getDoc(doc(db, 'users', opponentUid));
            if (oppDoc.exists() && oppDoc.data()?.name) oppName = oppDoc.data().name;
          } catch {}

          await setDoc(gameRef, {
            players: pair,
            playerNames: { [auth.currentUser.uid]: myName, [opponentUid]: oppName },
            status: 'playing',
            boardState: Array(100).fill(null),
            currentPlayer: pair[0],
            timerSeconds: 15
          });
        }

        await Promise.all([
          deleteDoc(doc(matchesRef, pair[0])),
          deleteDoc(doc(matchesRef, pair[1]))
        ]);

        currentGameId = gameId;
        botGame = false;
        joinGame(gameId);
        unsubscribe();
        playGameButton.disabled = false;
      });
    } catch (e) {
      lobbyStatus.textContent = 'Could not start game. Try again.';
      playGameButton.disabled = false;
    }
  });

  // --- Play Bot ---
  playBotButton?.addEventListener('click', async () => {
    await ensureUserSignedIn();

    currentGameId = 'bot-game-' + Date.now();
    players = [auth.currentUser.uid, 'BOT'];
    currentPlayerId = players[0];
    boardState = Array(100).fill(null);
    botGame = true;

    gameLobbyContainer.style.display = 'none';
    gameContainer.style.display = 'flex';
    setGridLayout();
    renderBoard(boardState);
    renderPlayerNames(players, { [players[0]]: 'You', BOT: 'Bot' });
    updateTimerDisplay();
  });

  // --- Timer ---
  function updateTimerDisplay() {
    const minutes = Math.floor(timerSeconds / 60);
    const seconds = timerSeconds % 60;
    if (timerDisplay) timerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  // --- Player names ---
  function renderPlayerNames(playersArr, playerNames) {
    if (!playerNamesContainer) return;
    playerNamesContainer.innerHTML = '';
    playersArr.forEach((pid, index) => {
      const div = document.createElement('div');
      const name = playerNames[pid] || `Player ${index + 1}`;
      const isCurrent = pid === currentPlayerId;
      div.className = `player player_${index + 1}`;
      div.innerHTML = `${name}${isCurrent ? ' (Current Turn)' : ''}`;
      playerNamesContainer.appendChild(div);
    });
  }

  // --- Bot logic ---
  function botMove() {
    const available = boardState
      .map((val, i) => (val === null ? i : null))
      .filter(i => i !== null);
    if (available.length === 0) return;
    const choice = available[Math.floor(Math.random() * available.length)];
    boardState[choice] = 'player_2';
    renderBoard(boardState);
    currentPlayerId = players[0];
    renderPlayerNames(players, { [players[0]]: 'You', BOT: 'Bot' });
  }

  // --- Multiplayer join (Firestore) ---
  function joinGame(gameId) {
    const gameRef = doc(db, 'games', gameId);
    unsubscribeFromGame = onSnapshot(gameRef, (snapshot) => {
      if (!snapshot.exists()) return;
      const data = snapshot.data();
      players = data.players || [];
      currentPlayerId = data.currentPlayer;
      boardState = data.boardState || Array(100).fill(null);
      gameEnded = data.status === 'ended';
      timerSeconds = data.timerSeconds || 15;

      gameLobbyContainer.style.display = 'none';
      gameContainer.style.display = 'flex';
      setGridLayout();
      renderBoard(boardState);
      renderPlayerNames(players, data.playerNames || {});
      updateTimerDisplay();
    });
  }

  // --- Handle clicks ---
  board?.addEventListener('click', async (event) => {
    if (gameEnded || !currentGameId) return;

    // Bot game
    if (botGame) {
      if (currentPlayerId !== players[0]) return;
      const el = event.target;
      const index = getBoxIndex(el);
      if (index === -1 || boardState[index] !== null) return;

      boardState[index] = 'player_1';
      renderBoard(boardState);

      currentPlayerId = 'BOT';
      renderPlayerNames(players, { [players[0]]: 'You', BOT: 'Bot' });

      setTimeout(botMove, 500);
      return;
    }

    // Multiplayer game
    if (currentPlayerId !== auth.currentUser.uid) return;
    const el = event.target;
    const index = getBoxIndex(el);
    if (index === -1 || boardState[index] !== null) return;

    boardState[index] = `player_${players.indexOf(auth.currentUser.uid) + 1}`;
    await updateDoc(doc(db, 'games', currentGameId), {
      boardState,
      currentPlayer: players.find(p => p !== auth.currentUser.uid),
      timerSeconds: 15
    });
  });
}
