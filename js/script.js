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
    // Exclude the recently clicked box and any already clicked boxes
    if (nb === excludedBox) return count;
    if (!clickedBoxes.has(nb)) return count + 1;
    return count;
  }, 0);
}

function followChain(startBox, previousBox) {
  const chain = [];
  let currentBox = startBox;
  let prevBox = previousBox;

  while (currentBox) {
    chain.push(currentBox);
    const neighbors = getNeighbors(Math.floor(getBoxIndex(currentBox) / cols), getBoxIndex(currentBox) % cols);

    const unclickedNeighbors = neighbors.filter(nb => !clickedBoxes.has(nb) && nb !== prevBox);
    
    // A valid chain link must have exactly one unclicked neighbor
    if (unclickedNeighbors.length !== 1) {
      return chain;
    }

    prevBox = currentBox;
    currentBox = unclickedNeighbors[0];
  }
  return chain;
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

    let chainsFilled = 0; // Tracks if any chains were filled in this turn

    getNeighbors(row, col).forEach(nb => {
      if (!clickedBoxes.has(nb)) {
        const unclickedCount = countUnclickedNeighbors(nb, el);
        
        // If a neighbor has 0 unclicked neighbors (excluding the clicked box), fill it
        if (unclickedCount === 0) {
          nb.classList.add(currentPlayerClass);
          clickedBoxes.add(nb);
          chainsFilled++;
        } 
        // If a neighbor has 1 unclicked neighbor, start a chain
        else if (unclickedCount === 1) {
          const chain = followChain(nb, el);
          
          if (chain.length > 1) { // A chain must have at least two boxes to be considered
            chain.forEach(boxInChain => {
              boxInChain.classList.add(currentPlayerClass);
              clickedBoxes.add(boxInChain);
            });
            chainsFilled++;
          }
        }
      }
    });

    // Only switch players if no boxes were automatically filled
    if (chainsFilled === 0) {
      isPlayer1Turn = !isPlayer1Turn;
    }
  });
})();