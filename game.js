const GRID_SIZE = 20;
const TILE_SIZE = 32;
const canvas = document.getElementById("game");
const context = canvas.getContext("2d");
const statusText = document.getElementById("status");
const attemptsText = document.getElementById("attempts");
const giveUpButton = document.getElementById("give-up");
const prevStageButton = document.getElementById("prev-stage");
const nextStageButton = document.getElementById("next-stage");

const tiles = {
  floor: ".",
  wall: "#",
  player: "P",
  ice: "I",
  dot: "o"
};

const colors = {
  floor: "#dff6ff",
  grid: "#c4e6ef",
  wall: "#31515d",
  wallTop: "#4f7b88",
  ice: "#9de8ff",
  iceShadow: "#66bdd3",
  iceLight: "#effcff",
  dot: "#f4d35e",
  dotRing: "#b98918",
  player: "#f06c4f",
  playerLight: "#ffd2c7"
};

let blocks = [];
let fixedCubes = new Set();
let dots = new Set();

let cleared = false;
let gameOver = false;

let currentStageIndex = 0;
let stage = parseStage(STAGES[currentStageIndex].map);
let player = findPlayer(stage);
let attempts = 12;

mergeTouchingBlocks();
collectDotsUnderBlocks();

function parseStage(mapText) {
  const mapRows = Array.isArray(mapText) ? mapText : mapText.trim().split("\n");
  const rows = mapRows.map((row) => row.trim().split(""));

  blocks = [];
  fixedCubes = new Set();
  dots = new Set();
  cleared = false;

  for (let y = 0; y < rows.length; y += 1) {
    for (let x = 0; x < rows[y].length; x += 1) {
      if (rows[y][x] === tiles.ice) {
        blocks.push({ cells: [{ x, y }] });
        rows[y][x] = tiles.floor;
      }

      if (rows[y][x] === tiles.dot) {
        dots.add(cellKey(x, y));
        rows[y][x] = tiles.floor;
      }
    }
  }

  return rows;
}

function loadStage(stageIndex) {
  currentStageIndex = Math.max(0, Math.min(stageIndex, STAGES.length - 1));
  stage = parseStage(STAGES[currentStageIndex].map);
  player = findPlayer(stage);
  mergeTouchingBlocks();
  collectDotsUnderBlocks();
  updateStatus();
  draw();
}

function findPlayer(stageMap) {
  for (let y = 0; y < stageMap.length; y += 1) {
    for (let x = 0; x < stageMap[y].length; x += 1) {
      if (stageMap[y][x] === tiles.player) {
        stageMap[y][x] = tiles.floor;
        return { x, y };
      }
    }
  }

  return { x: 1, y: 1 };
}

function isWall(x, y) {
  if (x < 0 || y < 0 || x >= GRID_SIZE || y >= GRID_SIZE) {
    return true;
  }

  return stage[y][x] === tiles.wall;
}

function cellKey(x, y) {
  return `${x},${y}`;
}

function getBlockAt(x, y) {
  return blocks.find((block) =>
    block.cells.some((cell) => cell.x === x && cell.y === y)
  );
}

function isFixedCube(x, y) {
  return fixedCubes.has(cellKey(x, y));
}

function getBlockCellSet(block) {
  return new Set(block.cells.map((cell) => cellKey(cell.x, cell.y)));
}

function canMoveBlock(block, dx, dy) {
  const ownCells = getBlockCellSet(block);

  return block.cells.every((cell) => {
    const nextX = cell.x + dx;
    const nextY = cell.y + dy;
    const otherBlock = getBlockAt(nextX, nextY);

    if (isWall(nextX, nextY)) {
      return false;
    }

    if (isFixedCube(nextX, nextY)) {
      return false;
    }

    return !otherBlock || ownCells.has(cellKey(nextX, nextY));
  });
}

function moveBlock(block, dx, dy) {
  block.cells = block.cells.map((cell) => ({
    x: cell.x + dx,
    y: cell.y + dy
  }));
}

function collectDotsUnderBlocks() {
  blocks = blocks.flatMap((block) => {
    const remainingCells = [];

    block.cells.forEach((cell) => {
      const key = cellKey(cell.x, cell.y);

      if (dots.has(key)) {
        dots.delete(key);
        fixedCubes.add(key);
      } else {
        remainingCells.push(cell);
      }
    });

    return splitCellsIntoBlocks(remainingCells);
  });
}

function splitCellsIntoBlocks(cells) {
  const cellMap = new Map(cells.map((cell) => [cellKey(cell.x, cell.y), cell]));
  const visited = new Set();
  const splitBlocks = [];

  cells.forEach((startCell) => {
    const startKey = cellKey(startCell.x, startCell.y);

    if (visited.has(startKey)) {
      return;
    }

    const queue = [startCell];
    const component = [];
    visited.add(startKey);

    while (queue.length > 0) {
      const cell = queue.shift();
      component.push(cell);

      [
        { x: cell.x + 1, y: cell.y },
        { x: cell.x - 1, y: cell.y },
        { x: cell.x, y: cell.y + 1 },
        { x: cell.x, y: cell.y - 1 }
      ].forEach((neighbor) => {
        const neighborKey = cellKey(neighbor.x, neighbor.y);

        if (cellMap.has(neighborKey) && !visited.has(neighborKey)) {
          visited.add(neighborKey);
          queue.push(cellMap.get(neighborKey));
        }
      });
    }

    splitBlocks.push({ cells: component });
  });

  return splitBlocks;
}

function areBlocksTouching(first, second) {
  const secondCells = getBlockCellSet(second);

  return first.cells.some((cell) =>
    secondCells.has(cellKey(cell.x + 1, cell.y)) ||
    secondCells.has(cellKey(cell.x - 1, cell.y)) ||
    secondCells.has(cellKey(cell.x, cell.y + 1)) ||
    secondCells.has(cellKey(cell.x, cell.y - 1))
  );
}

function mergeTouchingBlocks() {
  let merged = true;

  while (merged) {
    merged = false;

    for (let i = 0; i < blocks.length; i += 1) {
      for (let j = i + 1; j < blocks.length; j += 1) {
        if (areBlocksTouching(blocks[i], blocks[j])) {
          blocks[i].cells = blocks[i].cells.concat(blocks[j].cells);
          blocks.splice(j, 1);
          merged = true;
          break;
        }
      }

      if (merged) {
        break;
      }
    }
  }
}

function movePlayer(dx, dy) {
if (cleared || gameOver) {
    return;
  }

  const nextX = player.x + dx;
  const nextY = player.y + dy;
  const block = getBlockAt(nextX, nextY);

  if (isWall(nextX, nextY) || isFixedCube(nextX, nextY)) {
    return;
  }

  if (block) {
    if (!canMoveBlock(block, dx, dy)) {
      return;
    }

    moveBlock(block, dx, dy);
    mergeTouchingBlocks();
    collectDotsUnderBlocks();
  }

  player = { x: nextX, y: nextY };
  updateStatus();
  draw();
}

function drawTile(x, y, tile) {
  const pixelX = x * TILE_SIZE;
  const pixelY = y * TILE_SIZE;

  context.fillStyle = colors.floor;
  context.fillRect(pixelX, pixelY, TILE_SIZE, TILE_SIZE);

  context.strokeStyle = colors.grid;
  context.strokeRect(pixelX + 0.5, pixelY + 0.5, TILE_SIZE, TILE_SIZE);

  if (tile === tiles.wall) {
    context.fillStyle = colors.wall;
    context.fillRect(pixelX, pixelY, TILE_SIZE, TILE_SIZE);
    context.fillStyle = colors.wallTop;
    context.fillRect(pixelX + 4, pixelY + 4, TILE_SIZE - 8, TILE_SIZE - 8);
  }
}

function drawDot(x, y) {
  const centerX = x * TILE_SIZE + TILE_SIZE / 2;
  const centerY = y * TILE_SIZE + TILE_SIZE / 2;

  context.fillStyle = colors.dotRing;
  context.beginPath();
  context.arc(centerX, centerY, TILE_SIZE * 0.19, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = colors.dot;
  context.beginPath();
  context.arc(centerX, centerY, TILE_SIZE * 0.13, 0, Math.PI * 2);
  context.fill();
}

function drawIceBlock(block) {
  block.cells.forEach((cell) => {
    const pixelX = cell.x * TILE_SIZE;
    const pixelY = cell.y * TILE_SIZE;

    context.fillStyle = colors.iceShadow;
    context.fillRect(pixelX + 3, pixelY + 3, TILE_SIZE - 5, TILE_SIZE - 5);
    context.fillStyle = colors.ice;
    context.fillRect(pixelX + 2, pixelY + 2, TILE_SIZE - 6, TILE_SIZE - 6);
    context.fillStyle = colors.iceLight;
    context.fillRect(pixelX + 6, pixelY + 6, TILE_SIZE - 18, 4);
  });
}

function drawFixedCube(key) {
  const parts = key.split(",");
  const pixelX = Number(parts[0]) * TILE_SIZE;
  const pixelY = Number(parts[1]) * TILE_SIZE;

  context.fillStyle = "#738c94";
  context.fillRect(pixelX + 3, pixelY + 3, TILE_SIZE - 5, TILE_SIZE - 5);
  context.fillStyle = "#b8d4dc";
  context.fillRect(pixelX + 2, pixelY + 2, TILE_SIZE - 6, TILE_SIZE - 6);
  context.fillStyle = "#effcff";
  context.fillRect(pixelX + 6, pixelY + 6, TILE_SIZE - 18, 4);
}

function drawPlayer() {
  const centerX = player.x * TILE_SIZE + TILE_SIZE / 2;
  const centerY = player.y * TILE_SIZE + TILE_SIZE / 2;
  const radius = TILE_SIZE * 0.34;

  context.fillStyle = colors.player;
  context.beginPath();
  context.arc(centerX, centerY, radius, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = colors.playerLight;
  context.beginPath();
  context.arc(centerX - 4, centerY - 5, radius * 0.35, 0, Math.PI * 2);
  context.fill();
}

function draw() {
  context.clearRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      drawTile(x, y, stage[y][x]);
    }
  }

  dots.forEach((key) => {
    const parts = key.split(",");
    drawDot(Number(parts[0]), Number(parts[1]));
  });

  fixedCubes.forEach(drawFixedCube);
  blocks.forEach(drawIceBlock);
  drawPlayer();

  if (cleared) {
    drawClearMessage();
  }

  if (gameOver) {
    drawGameOverMessage();
  }
}

function drawClearMessage() {
  context.fillStyle = "rgba(23, 32, 38, 0.72)";
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = "#f3f8fb";
  context.font = "bold 64px Arial, Helvetica, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(
    currentStageIndex === STAGES.length - 1 ? "ALL CLEAR" : "CLEAR",
    canvas.width / 2,
    canvas.height / 2
  );
}

function drawGameOverMessage() {
  context.fillStyle = "rgba(23, 32, 38, 0.72)";
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = "#f3f8fb";
  context.font = "bold 64px Arial, Helvetica, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";

  context.fillText(
    "GAME OVER",
    canvas.width / 2,
    canvas.height / 2 - 40
  );

  context.font = "bold 28px Arial, Helvetica, sans-serif";

  context.fillText(
    "Press Give Up to Restart",
    canvas.width / 2,
    canvas.height / 2 + 40
  );
}


function updateStatus() {
  const stageLabel =
    `Stage ${currentStageIndex + 1}/${STAGES.length}: ${STAGES[currentStageIndex].name}`;

  if (dots.size === 0) {
    cleared = true;
    statusText.textContent = `${stageLabel} - Clear`;
  } else if (gameOver) {
    statusText.textContent = "GAME OVER";
  } else {
    statusText.textContent =
      `${stageLabel} - Dots left: ${dots.size}`;
  }

  attemptsText.textContent = `残機: ${attempts}`;
}

window.addEventListener("keydown", (event) => {
  const moves = {
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0]
  };

  const move = moves[event.key];

  if (!move) {
    return;
  }

  event.preventDefault();
  movePlayer(move[0], move[1]);
});

giveUpButton.addEventListener("click", () => {

  if (gameOver) {
    attempts = 12;
    gameOver = false;
    loadStage(currentStageIndex);
    return;
  }


  attempts -= 1;


  if (attempts <= 0) {
    attempts = 0;
    gameOver = true;
    updateStatus();
    draw();
    return;
  }


  loadStage(currentStageIndex);
});

prevStageButton.addEventListener("click", () => {
  loadStage(currentStageIndex - 1);
});

nextStageButton.addEventListener("click", () => {
  loadStage(currentStageIndex + 1);
});

updateStatus();
draw();
