const board = document.querySelector('.board');
const rows = 10;
const cols = 10;
const clickedBoxes = new Set();
let isPlayer1Turn = true; // Use boolean for player turns

(function setGridLayout() {
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
})();

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

function countUnclickedNeighbors(box, excludedBoxes = new Set()) {
  const index = getBoxIndex(box);
  if (index === -1) return 0;

  const row = Math.floor(index / cols);
  const col = index % cols;

  const neighbors = getNeighbors(row, col);

  return neighbors.reduce((count, nb) => {
    // Exclude boxes in the temporary set and any already clicked boxes
    if (excludedBoxes.has(nb)) return count;
    if (!clickedBoxes.has(nb)) return count + 1;
    return count;
  }, 0);
}

function fillChain(startBox, currentPlayerClass, excludedBoxes) {
  // Use a temporary set to keep track of boxes in the current chain
  excludedBoxes.add(startBox);

  // Check neighbors of the starting box
  const index = getBoxIndex(startBox);
  if (index === -1) return;

  const row = Math.floor(index / cols);
  const col = index % cols;

  getNeighbors(row, col).forEach(nb => {
    // Only proceed if the neighbor is unclicked and not already part of this chain
    if (!clickedBoxes.has(nb) && !excludedBoxes.has(nb)) {
      const unclickedCount = countUnclickedNeighbors(nb, excludedBoxes);
      
      // If a neighbor has 0 or 1 other unclicked neighbors, fill it and continue the chain
      if (unclickedCount <= 1) {
        nb.classList.add(currentPlayerClass);
        clickedBoxes.add(nb);
        // Recursively call fillChain to continue the process from this new box
        fillChain(nb, currentPlayerClass, excludedBoxes);
      }
    }
  });
}

(function addClickListener() {
  if (!board) return;

  board.addEventListener('click', (event) => {
    const el = event.target;
    if (!el.classList.contains('box') || clickedBoxes.has(el)) return;

    const currentPlayerClass = isPlayer1Turn ? 'player_1' : 'player_2';
    el.classList.add(currentPlayerClass);
    clickedBoxes.add(el);

    // Start the chain-filling process from the clicked box
    fillChain(el, currentPlayerClass, new Set());

    // Toggle the player turn after every click, regardless of chain length
    isPlayer1Turn = !isPlayer1Turn;
  });
})();