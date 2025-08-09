// Firebase configuration and initialization
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, signInAnonymously } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-firestore.js";

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
const createGameButton = document.getElementById('create-game-button');
const joinGameButton = document.getElementById('join-game-button');
const gameIdInput = document.getElementById('game-id-input');
const lobbyStatus = document.getElementById('lobby-status');
const currentGameIdSpan = document.getElementById('current-game-id');
const leaveGameButton = document.getElementById('leave-game-button');
const currentPlayerTurnSpan = document.getElementById('current-player-turn');

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

createGameButton.addEventListener('click', async () => {
    if (!currentUser) {
        lobbyStatus.textContent = "Please sign in first.";
        return;
    }
    const gameId = Math.random().toString(36).substring(2, 8);
    const gameRef = doc(db, 'games', gameId);
    await setDoc(gameRef, {
        players: [currentUser.uid],
        status: 'waiting',
        boardState: Array(100).fill(null)
    });
    currentGameId = gameId;
    joinGame(gameId);
});

joinGameButton.addEventListener('click', async () => {
    if (!currentUser) {
        lobbyStatus.textContent = "Please sign in first.";
        return;
    }
    const gameId = gameIdInput.value.trim();
    if (!gameId) {
        lobbyStatus.textContent = "Please enter a Game ID.";
        return;
    }
    const gameRef = doc(db, 'games', gameId);
    const gameSnap = await getDoc(gameRef);

    if (gameSnap.exists()) {
        const gameData = gameSnap.data();
        if (gameData.players.length < 2) {
            await updateDoc(gameRef, {
                players: [...gameData.players, currentUser.uid],
                status: 'playing',
                currentPlayer: gameData.players[0]
            });
            currentGameId = gameId;
            joinGame(gameId);
        } else {
            lobbyStatus.textContent = "This game is already full.";
        }
    } else {
        lobbyStatus.textContent = "Game not found.";
    }
});

function joinGame(gameId) {
    gameLobbyContainer.style.display = 'none';
    gameContainer.style.display = 'flex';
    currentGameIdSpan.textContent = gameId;
    setGridLayout();

    const gameRef = doc(db, 'games', gameId);
    if (unsubscribeFromGame) unsubscribeFromGame();

    unsubscribeFromGame = onSnapshot(gameRef, (docSnap) => {
        if (docSnap.exists()) {
            const gameData = docSnap.data();
            boardState = gameData.boardState;
            players = gameData.players;
            currentPlayerId = gameData.currentPlayer;
            
            renderBoard(boardState);

            if (gameData.currentPlayer) {
                currentPlayerTurnSpan.textContent = (gameData.currentPlayer === currentUser.uid) ? 'Your Turn' : 'Opponent\'s Turn';
            }
        }
    });
}

leaveGameButton.addEventListener('click', () => {
    if (unsubscribeFromGame) unsubscribeFromGame();
    currentGameId = null;
    gameLobbyContainer.style.display = 'flex';
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
        currentPlayer: nextPlayerId
    });
});