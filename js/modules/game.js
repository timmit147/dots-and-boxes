import { auth, db, doc, setDoc, getDoc, updateDoc, onSnapshot, collection, deleteDoc, signInAnonymously } from '../firebase.js';
import { setGridLayout, getBoxIndex, getNeighbors, renderBoard, countUnclickedNeighbors, findAndFillChain } from './board.js';

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

export function initGame() {
  const board = document.querySelector('.board');
  const gameLobbyContainer = document.getElementById('game-lobby-container');
  const gameContainer = document.getElementById('game-container');
  const authContainer = document.getElementById('auth-container');
  const lobbyStatus = document.getElementById('lobby-status');
  const startGameButton = document.getElementById('start-game-button');
  const timerDisplay = document.getElementById('timer-container');
  const playerNamesContainer = document.getElementById('player-names-container');
  const backButton = document.getElementById('back-button');

  // Grid setup
  setGridLayout();

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

      const timerContainer = document.getElementById('timer-container');
      if (gameData.status === 'ended') {
        gameEnded = true;
        clearInterval(timerInterval);
        timerActive = false;
        board?.classList.add('disabled');

        if (gameData.winner) {
          const winnerName = playerNames[gameData.winner] || 'Opponent';
          timerContainer.textContent = `${winnerName} wins!`;
        } else {
          timerContainer.textContent = "It's a draw!";
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
        timerContainer.textContent = "Waiting for opponent...";
      }
    });
  }

  backButton?.addEventListener('click', leaveToLobby);

  function leaveToLobby() {
    if (unsubscribeFromGame) unsubscribeFromGame();
    currentGameId = null;
    const gameLobbyContainer = document.getElementById('game-lobby-container');
    const gameContainer = document.getElementById('game-container');
    if (gameLobbyContainer) gameLobbyContainer.style.display = 'flex';
    if (gameContainer) gameContainer.style.display = 'none';
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

  // Helper: ensure a user exists (auto sign-in as Guest if needed)
  async function ensureUserSignedIn() {
    if (auth.currentUser) return auth.currentUser;
    const cred = await signInAnonymously(auth);
    return cred.user;
  }

  startGameButton?.addEventListener('click', async () => {
    try {
      startGameButton.disabled = true;
      // Auto-guest if not logged in; keep user if logged in
      await ensureUserSignedIn();

      lobbyStatus.textContent = "Waiting for opponent...";

      const matchesRef = collection(db, 'matches');
      const myMatchRef = doc(matchesRef, auth.currentUser.uid);

      await setDoc(myMatchRef, { uid: auth.currentUser.uid, timestamp: Date.now() });

      const unsubscribe = onSnapshot(matchesRef, async (snapshot) => {
        const waitingPlayers = [];
        snapshot.forEach(s => waitingPlayers.push(s.data().uid));
        if (waitingPlayers.length < 2) return;

        const bothUids = waitingPlayers.slice(0, 2).sort();
        const opponentUid = bothUids.find(uid => uid !== auth.currentUser.uid);
        const gameId = bothUids.join('-');

        if (auth.currentUser.uid === bothUids[0]) {
          const gameRef = doc(db, 'games', gameId);

          const myName = auth.currentUser.isAnonymous
            ? "Guest" + Math.floor(1000 + Math.random() * 9000)
            : auth.currentUser.email.split('@')[0];

          let opponentName = "Guest" + Math.floor(1000 + Math.random() * 9000);
          try {
            const opponentDoc = await getDoc(doc(db, 'users', opponentUid));
            if (opponentDoc.exists() && opponentDoc.data()?.name) {
              opponentName = opponentDoc.data().name;
            }
          } catch {}

          await setDoc(gameRef, {
            players: bothUids,
            playerNames: { [auth.currentUser.uid]: myName, [opponentUid]: opponentName },
            status: 'playing',
            boardState: Array(100).fill(null),
            currentPlayer: auth.currentUser.uid,
            timerSeconds: 15
          });
        }

        await deleteDoc(doc(matchesRef, bothUids[0]));
        await deleteDoc(doc(matchesRef, bothUids[1]));

        currentGameId = gameId;
        joinGame(gameId);

        unsubscribe();
        startGameButton.disabled = false;
      });
    } catch (e) {
      console.error(e);
      lobbyStatus.textContent = "Could not start game. Try again.";
      startGameButton.disabled = false;
    }
  });
}