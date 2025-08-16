// Pure board helpers. Uses the existing DOM structure/classes.

const rows = 10;
const cols = 10;

export function setGridLayout() {
  const board = document.querySelector('.board');
  if (!board) return;
  board.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  board.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
  board.innerHTML = '';
  for (let i = 0; i < rows * cols; i++) {
    const box = document.createElement('div');
    const r = Math.floor(i / cols);
    const c = i % cols;
    if ((r + c) % 2 !== 0) box.classList.add('even');
    box.classList.add('box');
    board.appendChild(box);
  }
}

export function getBoxIndex(box) {
  const board = document.querySelector('.board');
  return board ? Array.from(board.children).indexOf(box) : -1;
}

export function getNeighbors(row, col) {
  const board = document.querySelector('.board');
  const neighbors = [];
  if (!board) return neighbors;
  const boxes = board.children;
  if (row > 0) neighbors.push(boxes[(row - 1) * cols + col]);
  if (row < rows - 1) neighbors.push(boxes[(row + 1) * cols + col]);
  if (col > 0) neighbors.push(boxes[row * cols + (col - 1)]);
  if (col < cols - 1) neighbors.push(boxes[row * cols + (col + 1)]);
  return neighbors;
}

export function renderBoard(boardState, clickedBoxes) {
  const board = document.querySelector('.board');
  if (!board) return;
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

export function countUnclickedNeighbors(box, excludedBox = null, state, colsLocal = cols) {
  const idx = getBoxIndex(box);
  if (idx === -1) return 0;
  const row = Math.floor(idx / colsLocal);
  const col = idx % colsLocal;
  const neighbors = getNeighbors(row, col);
  return neighbors.reduce((count, nb) => {
    if (nb === excludedBox) return count;
    const nbIdx = getBoxIndex(nb);
    if (state[nbIdx] === null) return count + 1;
    return count;
  }, 0);
}

export function findAndFillChain(startBox, previousBox, playerClass, state, colsLocal = cols) {
  const chain = [];
  let currentBox = startBox;
  let prevBox = previousBox;
  let isClosedChain = false;
  let nextBoardState = [...state];

  while (currentBox && nextBoardState[getBoxIndex(currentBox)] === null) {
    const unclickedCount = countUnclickedNeighbors(currentBox, prevBox, nextBoardState, colsLocal);

    if (unclickedCount === 1) {
      chain.push(currentBox);
      const curIdx = getBoxIndex(currentBox);
      const r = Math.floor(curIdx / colsLocal);
      const c = curIdx % colsLocal;
      const neighbors = getNeighbors(r, c);
      const unclickedNeighbors = neighbors.filter(
        nb => nextBoardState[getBoxIndex(nb)] === null && nb !== prevBox
      );
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
    chain.forEach(b => {
      const i = getBoxIndex(b);
      nextBoardState[i] = playerClass;
    });
  }
  return nextBoardState;
}