const GRID_SIZE = 20;
const TILE_SIZE = 32;
const canvas = document.getElementById("game");
const context = canvas.getContext("2d");
const sceneLayer = document.createElement("canvas");
sceneLayer.width = canvas.width;
sceneLayer.height = canvas.height;
const sceneContext = sceneLayer.getContext("2d");
const backgroundImage = new Image();
const stageBackgrounds = [
  "image/stage1 傘を差す女の子1.jpg",
  "image/stage2 玉ねぎで泣いてる.jpg",
  "image/stage3写生少女.png",
  "image/stage4 school mizugi.png",
  "image/stage5女子高生顔をあからめ会話.jpg",
  "image/stage6 girls band.jpg",
  "image/stage7 school girl missile.jpg",
  "image/stage8 girls so close.jpg",
  "image/stage9 girl and cat.jpg",
  "image/stage10 school girl can spell.jpg"
];
backgroundImage.src = stageBackgrounds[0];
backgroundImage.addEventListener("load", draw);
const statusText = document.getElementById("status");
const attemptsText = document.getElementById("attempts");
const giveUpButton = document.getElementById("give-up");
const prevStageButton = document.getElementById("prev-stage");
const nextStageButton = document.getElementById("next-stage");
const gameShell = document.querySelector(".game-shell");
const directionButtons = document.querySelectorAll("[data-direction]");

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
let awaitingExitConfirmation = false;
let gameEnded = false;
let autoAdvanceTimer = null;
const clearedStages = new Set();

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
  if (autoAdvanceTimer !== null) {
    window.clearTimeout(autoAdvanceTimer);
    autoAdvanceTimer = null;
  }

  currentStageIndex = Math.max(0, Math.min(stageIndex, STAGES.length - 1));
  setStageBackground(currentStageIndex);
  stage = parseStage(STAGES[currentStageIndex].map);
  player = findPlayer(stage);
  mergeTouchingBlocks();
  collectDotsUnderBlocks();
  updateStatus();
  draw();
}

function setStageBackground(stageIndex) {
  const nextSource = stageBackgrounds[stageIndex];

  if (nextSource && !backgroundImage.src.endsWith(encodeURI(nextSource))) {
    backgroundImage.src = nextSource;
  }
}

function updateStageButtons() {
  prevStageButton.disabled = currentStageIndex === 0;
  // A face is unlocked only after the puzzle currently shown on it is cleared.
  nextStageButton.disabled =
    currentStageIndex === STAGES.length - 1 ||
    !clearedStages.has(currentStageIndex) ||
    autoAdvanceTimer !== null;
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
  if (cleared || gameOver || awaitingExitConfirmation || gameEnded) {
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

function drawTile(target, x, y, tile) {
  const pixelX = x * TILE_SIZE;
  const pixelY = y * TILE_SIZE;

  target.strokeStyle = "rgba(196, 230, 239, 0.55)";
  target.strokeRect(pixelX + 0.5, pixelY + 0.5, TILE_SIZE, TILE_SIZE);

  if (tile === tiles.wall) {
    target.fillStyle = colors.wall;
    target.fillRect(pixelX, pixelY, TILE_SIZE, TILE_SIZE);
    target.fillStyle = colors.wallTop;
    target.fillRect(pixelX + 4, pixelY + 4, TILE_SIZE - 8, TILE_SIZE - 8);
  }
}

function drawBackground(target) {
  target.fillStyle = colors.floor;
  target.fillRect(0, 0, canvas.width, canvas.height);

  if (!backgroundImage.complete || backgroundImage.naturalWidth === 0) {
    return;
  }

  // Keep the complete artwork visible, adding the floor color as letterboxing
  // when its proportions differ from the square game board.
  const scale = Math.min(
    canvas.width / backgroundImage.naturalWidth,
    canvas.height / backgroundImage.naturalHeight
  );
  const width = backgroundImage.naturalWidth * scale;
  const height = backgroundImage.naturalHeight * scale;
  const x = (canvas.width - width) / 2;
  const y = (canvas.height - height) / 2;
  target.drawImage(backgroundImage, x, y, width, height);
}

function drawDot(target, x, y) {
  const centerX = x * TILE_SIZE + TILE_SIZE / 2;
  const centerY = y * TILE_SIZE + TILE_SIZE / 2;

  target.fillStyle = colors.dotRing;
  target.beginPath();
  target.arc(centerX, centerY, TILE_SIZE * 0.19, 0, Math.PI * 2);
  target.fill();

  target.fillStyle = colors.dot;
  target.beginPath();
  target.arc(centerX, centerY, TILE_SIZE * 0.13, 0, Math.PI * 2);
  target.fill();
}

function drawIceBlock(block) {
  block.cells.forEach((cell) => {
    const pixelX = cell.x * TILE_SIZE;
    const pixelY = cell.y * TILE_SIZE;

    // The already-painted scene is sampled through the ice.  A shifted sample
    // gives the image a simple, inexpensive refraction effect.
    context.save();
    context.beginPath();
    context.rect(pixelX + 2, pixelY + 2, TILE_SIZE - 6, TILE_SIZE - 6);
    context.clip();
    context.globalAlpha = 0.78;
    context.drawImage(sceneLayer, pixelX - 3, pixelY - 2, TILE_SIZE, TILE_SIZE, pixelX, pixelY, TILE_SIZE, TILE_SIZE);
    // A faint, vertically mirrored sample reads as a reflection on the surface.
    context.globalAlpha = 0.15;
    context.translate(0, 2 * pixelY + TILE_SIZE);
    context.scale(1, -1);
    context.drawImage(sceneLayer, pixelX + 2, pixelY + 3, TILE_SIZE, TILE_SIZE, pixelX, pixelY, TILE_SIZE, TILE_SIZE);
    context.restore();

    context.fillStyle = "rgba(103, 218, 249, 0.30)";
    context.fillRect(pixelX + 2, pixelY + 2, TILE_SIZE - 6, TILE_SIZE - 6);
    const sheen = context.createLinearGradient(pixelX, pixelY, pixelX + TILE_SIZE, pixelY + TILE_SIZE);
    sheen.addColorStop(0, "rgba(255, 255, 255, 0.72)");
    sheen.addColorStop(0.35, "rgba(222, 252, 255, 0.16)");
    sheen.addColorStop(1, "rgba(36, 147, 181, 0.30)");
    context.fillStyle = sheen;
    context.fillRect(pixelX + 2, pixelY + 2, TILE_SIZE - 6, TILE_SIZE - 6);
    context.strokeStyle = "rgba(239, 252, 255, 0.82)";
    context.strokeRect(pixelX + 2.5, pixelY + 2.5, TILE_SIZE - 7, TILE_SIZE - 7);
    context.fillStyle = "rgba(255, 255, 255, 0.80)";
    context.fillRect(pixelX + 6, pixelY + 6, TILE_SIZE - 18, 3);
  });
}

function drawFixedCube(target, key) {
  const parts = key.split(",");
  const pixelX = Number(parts[0]) * TILE_SIZE;
  const pixelY = Number(parts[1]) * TILE_SIZE;

  target.fillStyle = "#738c94";
  target.fillRect(pixelX + 3, pixelY + 3, TILE_SIZE - 5, TILE_SIZE - 5);
  target.fillStyle = "#b8d4dc";
  target.fillRect(pixelX + 2, pixelY + 2, TILE_SIZE - 6, TILE_SIZE - 6);
  target.fillStyle = "#effcff";
  target.fillRect(pixelX + 6, pixelY + 6, TILE_SIZE - 18, 4);
}

function drawPlayer(target = context) {
  const centerX = player.x * TILE_SIZE + TILE_SIZE / 2;
  const centerY = player.y * TILE_SIZE + TILE_SIZE / 2;
  const radius = TILE_SIZE * 0.34;

  target.fillStyle = colors.player;
  target.beginPath();
  target.arc(centerX, centerY, radius, 0, Math.PI * 2);
  target.fill();

  target.fillStyle = colors.playerLight;
  target.beginPath();
  target.arc(centerX - 4, centerY - 5, radius * 0.35, 0, Math.PI * 2);
  target.fill();
}

function draw() {
  sceneContext.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground(sceneContext);

  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      drawTile(sceneContext, x, y, stage[y][x]);
    }
  }

  dots.forEach((key) => {
    const parts = key.split(",");
    drawDot(sceneContext, Number(parts[0]), Number(parts[1]));
  });

  // These objects are part of the scene sampled through movable ice.
  fixedCubes.forEach((key) => drawFixedCube(sceneContext, key));
  drawPlayer(sceneContext);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(sceneLayer, 0, 0);
  blocks.forEach(drawIceBlock);

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
  const allStagesCleared = clearedStages.size === STAGES.length;

  context.font = "bold 64px Arial, Helvetica, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(
    allStagesCleared ? "ALL CLEAR" : "CLEAR",
    canvas.width / 2,
    canvas.height / 2 - (allStagesCleared ? 36 : 0)
  );

  if (awaitingExitConfirmation) {
    context.font = "bold 28px Arial, Helvetica, sans-serif";
    context.fillText("ゲームを終了しますか (y/n)", canvas.width / 2, canvas.height / 2 + 42);
  }
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
    const becameCleared = !cleared;
    cleared = true;
    clearedStages.add(currentStageIndex);
    awaitingExitConfirmation = clearedStages.size === STAGES.length;
    const willAdvance = !awaitingExitConfirmation && currentStageIndex < STAGES.length - 1;
    statusText.textContent = awaitingExitConfirmation
      ? "ALL CLEAR - ゲームを終了しますか (y/n)"
      : willAdvance
        ? `${stageLabel} - Clear! 次の面へ進みます`
        : `${stageLabel} - Clear`;

    if (becameCleared && willAdvance) {
      autoAdvanceTimer = window.setTimeout(() => {
        autoAdvanceTimer = null;
        if (cleared && !gameOver && !gameEnded) {
          loadStage(currentStageIndex + 1);
        }
      }, 1000);
    }
  } else if (gameOver) {
    statusText.textContent = "GAME OVER";
  } else {
    statusText.textContent =
      `${stageLabel} - Dots left: ${dots.size}`;
  }

  attemptsText.textContent = `残機: ${attempts}`;
  updateStageButtons();
}

window.addEventListener("keydown", (event) => {
  if (gameEnded) {
    return;
  }

  if (awaitingExitConfirmation) {
    const answer = event.key.toLowerCase();

    if (answer === "y") {
      event.preventDefault();
      gameEnded = true;
      awaitingExitConfirmation = false;
      gameShell.hidden = true;
      return;
    }

    if (answer === "n") {
      event.preventDefault();
      awaitingExitConfirmation = false;
      statusText.textContent = "ALL CLEAR";
      draw();
    }

    return;
  }

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
  if (awaitingExitConfirmation || gameEnded) {
    return;
  }

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
  if (awaitingExitConfirmation || gameEnded) {
    return;
  }

  loadStage(currentStageIndex - 1);
});

nextStageButton.addEventListener("click", () => {
  if (awaitingExitConfirmation || gameEnded) {
    return;
  }

  if (!clearedStages.has(currentStageIndex)) {
    return;
  }

  loadStage(currentStageIndex + 1);
});

const touchMoves = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0]
};

directionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (awaitingExitConfirmation || gameEnded) {
      return;
    }

    const move = touchMoves[button.dataset.direction];
    movePlayer(move[0], move[1]);
  });
});


updateStatus();
draw();
