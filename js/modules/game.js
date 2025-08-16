import { auth, db, doc, setDoc, getDoc, updateDoc, onSnapshot, collection, deleteDoc, signInAnonymously } from '../firebase.js';
import { setGridLayout, getBoxIndex, getNeighbors, renderBoard, countUnclickedNeighbors, findAndFillChain } from './board.js';

// helper: auto guest if not logged in
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
  const startGameButton = document.getElementById('start-game-button');
  const lobbyStatus = document.getElementById('lobby-status');
  const board = document.querySelector('.board');
  const playerNamesContainer = document.getElementById('player-names-container');
  const timerDisplay = document.getElementById('timer-container');

  let clickedBoxes = new Set();
  let players = [];
  let currentPlayerId = null;
  let currentGameId = null;
  let unsubscribeFromGame = null;
  let boardState = Array(100).fill(null);
  let timerInterval = null;
  let timerActive = false;
  let gameEnded = false;
  let timerSeconds = 15;

  function showBack(show) {
    if (backButton) backButton.style.visibility = show ? 'visible' : 'hidden';
  }

  async function stopGameAndGoToLogin() {
    try {
      if (unsubscribeFromGame) unsubscribeFromGame();
      if (currentGameId) {
        try { await updateDoc(doc(db, 'games', currentGameId), { status: 'ended' }); } catch {}
      }
    } finally {
      currentGameId = null;
      if (gameContainer) gameContainer.style.display = 'none';
      if (gameLobbyContainer) gameLobbyContainer.style.display = 'none';
      if (authContainer) authContainer.style.display = 'flex'; // go to login
      showBack(false);
    }
  }

  backButton?.addEventListener('click', stopGameAndGoToLogin);

  // Ensure Start Game always works (auto-guest if needed)
  startGameButton?.addEventListener('click', async () => {
    try {
      startGameButton.disabled = true;
      await ensureUserSignedIn(); // guest if needed
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
        joinGame(gameId);
        unsubscribe();
        startGameButton.disabled = false;
      });
    } catch (e) {
      lobbyStatus.textContent = 'Could not start game. Try again.';
      startGameButton.disabled = false;
    }
  });

  function updateTimerDisplay() {
    const minutes = Math.floor(timerSeconds / 60);
    const seconds = timerSeconds % 60;
    if (timerDisplay) timerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  function startTurnTimer() {
    timerActive = true;
    timerInterval = setInterval(async () => {
      timerSeconds--;
      updateTimerDisplay();

      if (timerSeconds <= 0) {
        clearInterval(timerInterval);
        timerActive = false;

        // Count boxes for each player
        const boxes = Array.from(board.children);
        const player1Boxes = boxes.filter(box => box.classList.contains('player_1')).length;
        const player2Boxes = boxes.filter(box => box.classList.contains('player_2')).length;

        const winnerId = player1Boxes > player2Boxes ? players[0] :
                         player2Boxes > player1Boxes ? players[1] : null;

        const gameRef = doc(db, 'games', currentGameId);
        await updateDoc(gameRef, { status: 'ended', winner: winnerId, timerSeconds: 0 }).catch(() => {});
      }
    }, 1000);
  }

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

  function joinGame(gameId) {
    gameLobbyContainer.style.display = 'none';
    gameContainer.style.display = 'flex';
    setGridLayout();
    gameEnded = false;
    board?.classList.remove('disabled');

    const gameRef = doc(db, 'games', gameId);
    if (unsubscribeFromGame) unsubscribeFromGame();

    unsubscribeFromGame = onSnapshot(gameRef, (docSnap) => {
      if (!docSnap.exists()) return;
      const gameData = docSnap.data();
      boardState = gameData.boardState;
      players = gameData.players;
      currentPlayerId = gameData.currentPlayer;
      const playerNames = gameData.playerNames || {};
      timerSeconds = typeof gameData.timerSeconds === 'number' ? gameData.timerSeconds : 15;

      renderBoard(boardState, clickedBoxes);
      renderPlayerNames(players, playerNames);

      // Use the same timer element everywhere
      if (gameData.status === 'ended') {
        gameEnded = true;
        clearInterval(timerInterval);
        timerActive = false;
        board?.classList.add('disabled');

        if (timerDisplay) {
          if (gameData.winner) {
            const winnerName = playerNames[gameData.winner] || 'Opponent';
            timerDisplay.textContent = `${winnerName} wins!`;
          } else {
            timerDisplay.textContent = "It's a draw!";
          }
        }
        return;
      }

      if (players.length === 2 && gameData.status === 'playing') {
        board?.classList.remove('disabled');
        if (!gameEnded && auth.currentUser && auth.currentUser.uid === currentPlayerId && !timerActive) {
          startTurnTimer();
        }
        updateTimerDisplay();
      } else {
        clearInterval(timerInterval);
        timerActive = false;
        board?.classList.add('disabled');
        if (timerDisplay) timerDisplay.textContent = "Waiting for opponent...";
      }
    });
  }

  // Remove any old leave button handlers if you had them
  const oldLeave = document.getElementById('leave-game-button');
  if (oldLeave) oldLeave.remove();

  board?.addEventListener('click', async (event) => {
    if (gameEnded || !currentGameId) return;
    if (!auth.currentUser || auth.currentUser.uid !== currentPlayerId) return;

    const el = event.target;
    const index = getBoxIndex(el);
    if (index === -1 || clickedBoxes.has(el)) return;

    const currentPlayerClass = (players.indexOf(auth.currentUser.uid) === 0) ? 'player_1' : 'player_2';
    let nextBoardState = [...boardState];
    nextBoardState[index] = currentPlayerClass;

    const row = Math.floor(index / 10);
    const col = index % 10;

    getNeighbors(row, col).forEach(nb => {
      const neighborIndex = getBoxIndex(nb);
      if (nextBoardState[neighborIndex] === null) {
        const unclickedCount = countUnclickedNeighbors(nb, el, nextBoardState);
        if (unclickedCount === 0) {
          nextBoardState[neighborIndex] = currentPlayerClass;
        } else if (unclickedCount === 1) {
          nextBoardState = findAndFillChain(nb, el, currentPlayerClass, nextBoardState);
        }
      }
    });

    const currentPlayerIndex = players.indexOf(auth.currentUser.uid);
    const nextPlayerIndex = (currentPlayerIndex + 1) % players.length;
    const nextPlayerId = players[nextPlayerIndex];

    const gameRef = doc(db, 'games', currentGameId);
    await updateDoc(gameRef, {
      boardState: nextBoardState,
      currentPlayer: nextPlayerId,
      timerSeconds: 15
    }).catch(() => {});
  });
}