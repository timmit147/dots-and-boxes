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

function countUnclickedNeighbors(box, excludedBox = null) {
  const index = getBoxIndex(box);
  if (index === -1) return 0;

  const row = Math.floor(index / cols);
  const col = index % cols;

  const neighbors = getNeighbors(row, col);

  return neighbors.reduce((count, nb) => {
    if (nb === excludedBox) return count;
    if (!clickedBoxes.has(nb)) return count + 1;
    return count;
  }, 0);
}

function findAndFillClosedChain(startBox, previousBox, currentPlayerClass) {
  const chain = [];
  let currentBox = startBox;
  let prevBox = previousBox;
  let isClosed = false;

  // Follow the chain to find its end or if it forms a closed loop
  while (currentBox && !clickedBoxes.has(currentBox)) {
    const unclickedCount = countUnclickedNeighbors(currentBox, prevBox);
    
    // A chain is formed by boxes with only one unclicked neighbor
    if (unclickedCount === 1) {
      chain.push(currentBox);
      const neighbors = getNeighbors(Math.floor(getBoxIndex(currentBox) / cols), getBoxIndex(currentBox) % cols);
      
      const unclickedNeighbors = neighbors.filter(nb => !clickedBoxes.has(nb) && nb !== prevBox);
      
      if (unclickedNeighbors.length === 1) {
        prevBox = currentBox;
        currentBox = unclickedNeighbors[0];
      } else {
        // This should not happen in a valid chain, but just in case
        currentBox = null;
      }
    } else if (unclickedCount === 0) {
      // The chain has looped back or ended in a box with no unclicked neighbors
      chain.push(currentBox);
      isClosed = true;
      currentBox = null;
    } else {
      // The box has two or more unclicked neighbors, so the chain is not a single path
      currentBox = null;
    }
  }

  // Only fill the chain if it is a closed loop
  if (isClosed && chain.length > 0) {
    chain.forEach(boxInChain => {
      boxInChain.classList.add(currentPlayerClass);
      clickedBoxes.add(boxInChain);
    });
  }
}

(function addClickListener() {
  if (!board) return;

  board.addEventListener('click', (event) => {
    const el = event.target;
    if (!el.classList.contains('box') || clickedBoxes.has(el)) return;

    const currentPlayerClass = isPlayer1Turn ? 'player_1' : 'player_2';
    el.classList.add(currentPlayerClass);
    clickedBoxes.add(el);

    const index = getBoxIndex(el);
    if (index === -1) return;

    const row = Math.floor(index / cols);
    const col = index % cols;

    getNeighbors(row, col).forEach(nb => {
      if (!clickedBoxes.has(nb)) {
        const unclickedCount = countUnclickedNeighbors(nb, el);
        
        // A potential chain starts with a neighbor having only one unclicked path
        if (unclickedCount === 1) {
          findAndFillClosedChain(nb, el, currentPlayerClass);
        }
      }
    });

    isPlayer1Turn = !isPlayer1Turn;
  });
})();