// Firebase configuration and initialization
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, signInAnonymously } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, onSnapshot, collection, deleteDoc, query, where, getDocs, orderBy, limit } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCQh3iNGIGDVaFTmiEGyZa6r5r7U0thX80",
    authDomain: "box-chain.firebaseapp.com",
    projectId: "box-chain",
    storageBucket: "box-chain.firebasestorage.app",
    messagingSenderId: "957225784449",
    appId: "1:957225784449:web:a02f5e553128cd61e66980"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM elements
const board = document.querySelector('.board');
const authContainer = document.getElementById('auth-container');
const gameLobbyContainer = document.getElementById('game-lobby-container');
const gameContainer = document.getElementById('game-container');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const signupButton = document.getElementById('signup-button');
const signinButton = document.getElementById('signin-button');
const signoutButton = document.getElementById('signout-button');
const guestLoginButton = document.getElementById('guest-login-button'); // New element for guest login
const authStatus = document.getElementById('auth-status');
const lobbyStatus = document.getElementById('lobby-status');
const leaveGameButton = document.getElementById('leave-game-button');
const startGameButton = document.getElementById('start-game-button'); // New element for start game
const timerDisplay = document.getElementById('timer-container');
const playerNamesContainer = document.getElementById('player-names-container');

// Game state variables
const rows = 10;
const cols = 10;
let clickedBoxes = new Set();
let players = [];
let currentPlayerId = null;
let currentUser = null;
let currentGameId = null;
let unsubscribeFromGame = null;
let boardState = Array(100).fill(null);
let timerInterval = null;
let timerActive = false;
let gameEnded = false;
let timerSeconds = 15;

// --- Board Rendering Logic ---
function setGridLayout() {
    if (!board) return;

    board.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    board.style.gridTemplateRows = `repeat(${rows}, 1fr)`;

    board.innerHTML = '';
    const totalBoxes = rows * cols;
    for (let i = 0; i < totalBoxes; i++) {
        const box = document.createElement('div');
        const row = Math.floor(i / cols);
        const col = i % cols;
        if ((row + col) % 2 !== 0) {
            box.classList.add('even');
        }
        box.classList.add('box');
        board.appendChild(box);
    }
}

function getBoxIndex(box) {
    return Array.from(board.children).indexOf(box);
}

function getNeighbors(row, col) {
    const neighbors = [];
    const boxes = board.children;

    if (row > 0) neighbors.push(boxes[(row - 1) * cols + col]);
    if (row < rows - 1) neighbors.push(boxes[(row + 1) * cols + col]);
    if (col > 0) neighbors.push(boxes[row * cols + (col - 1)]);
    if (col < cols - 1) neighbors.push(boxes[row * cols + (col + 1)]);

    return neighbors;
}

function renderBoard(boardState) {
    const boxes = board.children;
    clickedBoxes.clear();
    for (let i = 0; i < boxes.length; i++) {
        boxes[i].classList.remove('player_1', 'player_2');
        if (boardState[i] === 'player_1') {
            boxes[i].classList.add('player_1');
            clickedBoxes.add(boxes[i]);
        } else if (boardState[i] === 'player_2') {
            boxes[i].classList.add('player_2');
            clickedBoxes.add(boxes[i]);
        }
    }
}

// --- Timer Logic ---
function updateTimerDisplay() {
    const minutes = Math.floor(timerSeconds / 60);
    const seconds = timerSeconds % 60;
    timerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function startTurnTimer() {
    timerActive = true;
    timerInterval = setInterval(() => {
        timerSeconds--;
        updateTimerDisplay();

        if (timerSeconds <= 0) {
            clearInterval(timerInterval);
            timerActive = false;
            
            // Count boxes for each player
            const boxes = Array.from(board.children);
            const player1Boxes = boxes.filter(box => box.classList.contains('player_1')).length;
            const player2Boxes = boxes.filter(box => box.classList.contains('player_2')).length;
            
            // Determine winner
            const currentPlayerIndex = players.indexOf(currentUser.uid);
            const winnerId = player1Boxes > player2Boxes ? players[0] : 
                           player2Boxes > player1Boxes ? players[1] : null;

            const gameRef = doc(db, 'games', currentGameId);
            updateDoc(gameRef, {
                status: 'ended',
                winner: winnerId,
                timerSeconds: 0
            });
        }
    }, 1000);
}

// --- Game Logic ---
function countUnclickedNeighbors(box, excludedBox = null, state = boardState) {
    const index = getBoxIndex(box);
    if (index === -1) return 0;

    const row = Math.floor(index / cols);
    const col = index % cols;

    const neighbors = getNeighbors(row, col);

    return neighbors.reduce((count, nb) => {
        if (nb === excludedBox) return count;
        if (state[getBoxIndex(nb)] === null) return count + 1;
        return count;
    }, 0);
}

function findAndFillChain(startBox, previousBox, playerClass, state) {
    const chain = [];
    let currentBox = startBox;
    let prevBox = previousBox;
    let isClosedChain = false;
    let nextBoardState = [...state];

    while (currentBox && nextBoardState[getBoxIndex(currentBox)] === null) {
        const unclickedCount = countUnclickedNeighbors(currentBox, prevBox, nextBoardState);

        if (unclickedCount === 1) {
            chain.push(currentBox);
            
            const neighbors = getNeighbors(Math.floor(getBoxIndex(currentBox) / cols), getBoxIndex(currentBox) % cols);
            const unclickedNeighbors = neighbors.filter(nb => nextBoardState[getBoxIndex(nb)] === null && nb !== prevBox);
            
            if (unclickedNeighbors.length === 1) {
                prevBox = currentBox;
                currentBox = unclickedNeighbors[0];
            } else {
                currentBox = null;
            }
        } else if (unclickedCount === 0) {
            chain.push(currentBox);
            isClosedChain = true;
            currentBox = null;
        } else {
            currentBox = null;
        }
    }

    if (isClosedChain) {
        chain.forEach(boxInChain => {
            const index = getBoxIndex(boxInChain);
            nextBoardState[index] = playerClass;
        });
    }
    return nextBoardState;
}

// Function to render player names
function renderPlayerNames(players, playerNames) {
    if (!playerNamesContainer) return;
    
    playerNamesContainer.innerHTML = '';
    players.forEach((playerId, index) => {
        const playerDiv = document.createElement('div');
        playerDiv.className = `player player_${index + 1}`;
        const name = playerNames[playerId] || `Player ${index + 1}`;
        const isCurrentPlayer = playerId === currentPlayerId;
        const isYou = playerId === currentUser?.uid;
        playerDiv.innerHTML = `${name} ${isYou ? '(You)' : ''} ${isCurrentPlayer ? '- Your Turn!' : ''}`;
        playerNamesContainer.appendChild(playerDiv);
    });
}

// --- Event Listeners ---
signupButton.addEventListener('click', () => {
    const email = emailInput.value;
    const password = passwordInput.value;
    createUserWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            const user = userCredential.user;
            authStatus.textContent = `User ${user.email} signed up successfully!`;
        })
        .catch((error) => {
            authStatus.textContent = `Sign Up Error: ${error.message}`;
        });
});

signinButton.addEventListener('click', () => {
    const email = emailInput.value;
    const password = passwordInput.value;
    signInWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            const user = userCredential.user;
            authStatus.textContent = `User ${user.email} signed in successfully!`;
        })
        .catch((error) => {
            authStatus.textContent = `Sign In Error: ${error.message}`;
        });
});

// New event listener for guest login
guestLoginButton.addEventListener('click', () => {
    signInAnonymously(auth)
        .then(() => {
            authStatus.textContent = "Signed in as a guest!";
        })
        .catch((error) => {
            authStatus.textContent = `Guest Sign In Error: ${error.message}`;
        });
});

signoutButton.addEventListener('click', () => {
    signOut(auth).then(() => {
        authStatus.textContent = 'User signed out.';
    }).catch((error) => {
        authStatus.textContent = `Sign Out Error: ${error.message}`;
    });
});

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        authContainer.style.display = 'none';
        gameLobbyContainer.style.display = 'flex';
        // Optional: Differentiate UI for guest users
        if (user.isAnonymous) {
            authStatus.textContent = "You are logged in as a guest. Your game progress will not be saved.";
        } else {
            authStatus.textContent = `Welcome, ${user.email}!`;
        }
    } else {
        currentUser = null;
        authContainer.style.display = 'flex';
        gameLobbyContainer.style.display = 'none';
        gameContainer.style.display = 'none';
    }
});

leaveGameButton.addEventListener('click', () => {
    if (unsubscribeFromGame) unsubscribeFromGame();
    currentGameId = null;
    gameLobbyContainer.style.display = 'flex';
    // The main change: Hide the game container
    gameContainer.style.display = 'none';
});

board.addEventListener('click', (event) => {
    const el = event.target;
    const index = getBoxIndex(el);

    if (index === -1 || clickedBoxes.has(el) || currentUser.uid !== currentPlayerId) {
        return;
    }

    const currentPlayerClass = (players.indexOf(currentUser.uid) === 0) ? 'player_1' : 'player_2';
    let nextBoardState = [...boardState];
    nextBoardState[index] = currentPlayerClass;

    const row = Math.floor(index / cols);
    const col = index % cols;

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

    const currentPlayerIndex = players.indexOf(currentUser.uid);
    const nextPlayerIndex = (currentPlayerIndex + 1) % players.length;
    const nextPlayerId = players[nextPlayerIndex];

    const gameRef = doc(db, 'games', currentGameId);
    updateDoc(gameRef, {
        boardState: nextBoardState,
        currentPlayer: nextPlayerId,
        timerSeconds: 15 // <-- Reset timer for both players every turn
    });
});

// New event listener for starting the game with an opponent
startGameButton.addEventListener('click', async () => {
    if (!currentUser) {
        lobbyStatus.textContent = "Please sign in first.";
        return;
    }

    startGameButton.disabled = true;
    lobbyStatus.textContent = "Waiting for opponent...";

    const matchesRef = collection(db, 'matches');
    const timestamp = Date.now();

    try {
        // Try to find an existing waiting player
        const availableMatchesSnap = await getDocs(query(
            matchesRef,
            where('status', '==', 'waiting')
        ));
        // Sort by timestamp in JS and pick the first not yourself
        const availableMatches = availableMatchesSnap.docs
            .filter(doc => doc.data().uid !== currentUser.uid)
            .sort((a, b) => a.data().timestamp - b.data().timestamp);
        if (availableMatches.length > 0) {
            // Found a waiting player - join their game
            const waitingPlayer = availableMatches[0];
            const waitingPlayerId = waitingPlayer.data().uid;
            
            try {
                // Try to claim this match
                await updateDoc(waitingPlayer.ref, { 
                    status: 'matched',
                    matchedWith: currentUser.uid
                });

                // Generate game ID and create the game
                const gameId = `game-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                const gameRef = doc(db, 'games', gameId);

                // Set up player names
                const myName = currentUser.isAnonymous
                    ? "Guest" + Math.floor(1000 + Math.random() * 9000)
                    : currentUser.email.split('@')[0];

                const opponentName = "Guest" + Math.floor(1000 + Math.random() * 9000);

                // Create the game
                await setDoc(gameRef, {
                    players: [waitingPlayerId, currentUser.uid],
                    playerNames: { 
                        [waitingPlayerId]: opponentName,
                        [currentUser.uid]: myName 
                    },
                    status: 'playing',
                    boardState: Array(100).fill(null),
                    currentPlayer: waitingPlayerId,
                    timerSeconds: 15
                });

                // Clean up the match document
                await deleteDoc(waitingPlayer.ref);

                // Join the game
                currentGameId = gameId;
                joinGame(gameId);
            } catch (e) {
                console.error('Failed to join match:', e);
                startGameButton.disabled = false;
                lobbyStatus.textContent = "Failed to join game. Please try again.";
            }
        } else {
            // No available match, create a new one
            const myMatchId = `${currentUser.uid}-${timestamp}`;
            const myMatchRef = doc(db, 'matches', myMatchId);
            await setDoc(myMatchRef, {
                uid: currentUser.uid,
                timestamp: timestamp,
                status: 'waiting'
            });

            // Listen for someone joining our game
            const unsubscribe = onSnapshot(myMatchRef, async (matchSnap) => {
                if (matchSnap.exists() && matchSnap.data().status === 'matched') {
                    const matchData = matchSnap.data();
                    const opponentUid = matchData.matchedWith;
                    const gameId = `game-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                    
                    // Create the game
                    const gameRef = doc(db, 'games', gameId);
                    const myName = currentUser.isAnonymous
                        ? "Guest" + Math.floor(1000 + Math.random() * 9000)
                        : currentUser.email.split('@')[0];

                    const opponentName = "Guest" + Math.floor(1000 + Math.random() * 9000);

                    await setDoc(gameRef, {
                        players: [currentUser.uid, opponentUid],
                        playerNames: {
                            [currentUser.uid]: myName,
                            [opponentUid]: opponentName
                        },
                        status: 'playing',
                        boardState: Array(100).fill(null),
                        currentPlayer: currentUser.uid,
                        timerSeconds: 15
                    });

                    // Clean up
                    await deleteDoc(myMatchRef);
                    unsubscribe();

                    // Join the game
                    currentGameId = gameId;
                    joinGame(gameId);
                }
            });

            // Set a timeout to clean up if no one joins
            setTimeout(async () => {
                try {
                    const docSnap = await getDoc(myMatchRef);
                    if (docSnap.exists() && docSnap.data().status === 'waiting') {
                        await deleteDoc(myMatchRef);
                        unsubscribe();
                        startGameButton.disabled = false;
                        lobbyStatus.textContent = "No opponent found. Try again.";
                    }
                } catch (e) {
                    console.error('Cleanup error:', e);
                }
            }, 30000);
        }
    } catch (error) {
        console.error('Matchmaking error:', error);
        startGameButton.disabled = false;
        lobbyStatus.textContent = "Error finding opponent. Please try again.";
    }
});

function joinGame(gameId) {
    gameLobbyContainer.style.display = 'none';
    gameContainer.style.display = 'flex';
    setGridLayout();

    const gameRef = doc(db, 'games', gameId);
    if (unsubscribeFromGame) unsubscribeFromGame();

    unsubscribeFromGame = onSnapshot(gameRef, (docSnap) => {
        if (docSnap.exists()) {
            const gameData = docSnap.data();
            boardState = gameData.boardState;
            players = gameData.players;
            currentPlayerId = gameData.currentPlayer;
            const playerNames = gameData.playerNames || {};
            timerSeconds = typeof gameData.timerSeconds === 'number' ? gameData.timerSeconds : 15;

            renderBoard(boardState);
            renderPlayerNames(players, playerNames);

            // Show winner message if game is ended
            const timerContainer = document.getElementById('timer-container');
            if (gameData.status === 'ended') {
                gameEnded = true;
                clearInterval(timerInterval);
                timerActive = false;

                if (gameData.winner) {
                    const winnerName = playerNames[gameData.winner] || 'Opponent';
                    timerContainer.textContent = `${winnerName} wins!`;
                } else {
                    timerContainer.textContent = "It's a draw!";
                }
                return;
            }

            // Only start timer if both players are present and game is playing
            if (players.length === 2 && gameData.status === 'playing') {
                if (!gameEnded && currentUser && currentUser.uid === currentPlayerId && !timerActive) {
                    startTurnTimer();
                }
                updateTimerDisplay();
            } else {
                clearInterval(timerInterval);
                timerActive = false;
                timerContainer.textContent = "Waiting for opponent...";
            }
        }
    });
}