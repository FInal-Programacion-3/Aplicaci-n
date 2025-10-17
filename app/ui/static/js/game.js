import { ApiClient, GameSocket } from "./net.js";

const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");

const api = new ApiClient();
let socket = null;
let mode = "local";
let timerInterval = null;
let timerSeconds = 0;
let goalCooldown = 0;

const PLAYER_WIDTH = 64;
const PLAYER_HEIGHT = 64;
const PLAYER_SPEED = 220;
const JUMP_VELOCITY = -340;
const BALL_RADIUS = 16;
const FLOOR_Y = 420;
const CEILING_LIMIT = 55;
const GOAL_MOUTH_HEIGHT = 150;
const GOAL_LINE_OFFSET = 34;
const GOAL_POST_THICKNESS = 14;
const GOAL_DEPTH = 70;
const GRAVITY = 540;
const BALL_DAMPING = 0.72;
const WALL_DAMPING = 0.8;
const POST_RESTITUTION = 0.65;

const GOAL_TOP = FLOOR_Y - GOAL_MOUTH_HEIGHT;
const GOAL_LINE_LEFT = GOAL_LINE_OFFSET;
const GOAL_LINE_RIGHT = canvas.width - GOAL_LINE_OFFSET;

const scoreboardLabels = {
  left: document.getElementById("score-left"),
  right: document.getElementById("score-right"),
};
const timerLabel = document.getElementById("match-timer");

const sprites = {
  player1: loadSprite("img/placeholder_player1.png"),
  player2: loadSprite("img/placeholder_player2.png"),
  ball: loadSprite("img/ball.png"),
};

const state = {
  time: 0,
  players: {
    p1: { x: 220, y: FLOOR_Y, vx: 0, vy: 0 },
    p2: { x: canvas.width - 220, y: FLOOR_Y, vx: 0, vy: 0 },
  },
  ball: { x: canvas.width / 2, y: FLOOR_Y - BALL_RADIUS, vx: 0, vy: 0 },
  score: { left: 0, right: 0 },
  pressed: {},
};

/** Load a sprite from the static folder. */
function loadSprite(path) {
  const image = new Image();
  image.src = `/static/${path}`;
  return image;
}

/** Start the local render and update loop. */
function startLoop() {
  let previous = performance.now();
  function frame(timestamp) {
    const delta = (timestamp - previous) / 1000;
    previous = timestamp;
    update(delta);
    render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

/** Update physics and positions for the current game mode. */
function update(delta) {
  goalCooldown = Math.max(0, goalCooldown - delta);

  Object.entries(state.players).forEach(([key, player]) => {
    if (mode === "local") {
      player.vx = 0;
      const leftKey = key === "p1" ? "KeyA" : "ArrowLeft";
      const rightKey = key === "p1" ? "KeyD" : "ArrowRight";
      if (state.pressed[leftKey]) {
        player.vx = -PLAYER_SPEED;
      }
      if (state.pressed[rightKey]) {
        player.vx = PLAYER_SPEED;
      }
    }

    player.x += player.vx * delta;
    player.y += player.vy * delta;
    player.vy += GRAVITY * delta;

    if (player.y > FLOOR_Y) {
      player.y = FLOOR_Y;
      player.vy = 0;
    }

    const inset = PLAYER_WIDTH / 2 + 12;
    player.x = clamp(player.x, inset, canvas.width - inset);
  });

  state.ball.x += state.ball.vx * delta;
  state.ball.y += state.ball.vy * delta;
  state.ball.vy += GRAVITY * delta;

  const floorContact = FLOOR_Y - BALL_RADIUS;
  if (state.ball.y > floorContact) {
    state.ball.y = floorContact;
    state.ball.vy *= -BALL_DAMPING;
    state.ball.vx *= 0.96;
    if (Math.abs(state.ball.vy) < 8) {
      state.ball.vy = 0;
    }
  }

  if (state.ball.y < CEILING_LIMIT + BALL_RADIUS) {
    state.ball.y = CEILING_LIMIT + BALL_RADIUS;
    state.ball.vy = Math.abs(state.ball.vy) * WALL_DAMPING;
  }

  handleGoalStructures();

  const wallLeft = BALL_RADIUS;
  const wallRight = canvas.width - BALL_RADIUS;
  if (state.ball.x < wallLeft) {
    state.ball.x = wallLeft;
    state.ball.vx = Math.abs(state.ball.vx) * WALL_DAMPING;
  }
  if (state.ball.x > wallRight) {
    state.ball.x = wallRight;
    state.ball.vx = -Math.abs(state.ball.vx) * WALL_DAMPING;
  }

  if (goalCooldown <= 0) {
    const scoredSide = detectGoal();
    if (scoredSide) {
      awardGoal(scoredSide);
      goalCooldown = 1.1;
      return;
    }
  }

  if (mode === "online" && socket) {
    socket.sendState({
      players: state.players,
      ball: state.ball,
      score: state.score,
      timestamp: Date.now(),
    });
  }
}

/** Draw all game elements into the canvas. */
function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawArena();
  ctx.drawImage(
    sprites.ball,
    state.ball.x - BALL_RADIUS,
    state.ball.y - BALL_RADIUS,
    BALL_RADIUS * 2,
    BALL_RADIUS * 2,
  );
  ctx.drawImage(
    sprites.player1,
    state.players.p1.x - PLAYER_WIDTH / 2,
    state.players.p1.y - PLAYER_HEIGHT,
    PLAYER_WIDTH,
    PLAYER_HEIGHT,
  );
  ctx.drawImage(
    sprites.player2,
    state.players.p2.x - PLAYER_WIDTH / 2,
    state.players.p2.y - PLAYER_HEIGHT,
    PLAYER_WIDTH,
    PLAYER_HEIGHT,
  );
}

/** Attach UI and keyboard events. */
function setupUI() {
  document.getElementById("mode-local").addEventListener("click", enterLocalMode);
  document.getElementById("mode-ai").addEventListener("click", () => {
    mode = "online";
    resetMatch();
    resetPositions();
    updateStatus("Buscando partida...");
    connectSocket();
  });

  document.querySelectorAll(".powers button").forEach((button) => {
    button.addEventListener("click", () => {
      logChat("Sistema", `Poder ${button.dataset.power} activado (placeholder).`);
    });
  });

  document.getElementById("chat-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const input = document.getElementById("chat-input");
    const value = input.value.trim();
    if (!value) {
      return;
    }
    if (socket) {
      socket.sendChat(value);
    }
    logChat("Tu", value);
    input.value = "";
  });

  window.addEventListener("keydown", (event) => {
    state.pressed[event.code] = true;
    if (event.code === "KeyW" && state.players.p1.vy === 0) {
      state.players.p1.vy = JUMP_VELOCITY;
    }
    if (event.code === "ArrowUp" && state.players.p2.vy === 0) {
      state.players.p2.vy = JUMP_VELOCITY;
    }
  });
  window.addEventListener("keyup", (event) => {
    state.pressed[event.code] = false;
  });
}

/** Switch to the offline two player mode. */
function enterLocalMode() {
  mode = "local";
  disconnectSocket();
  resetMatch();
  resetPositions();
  startTimer();
  updateStatus("Modo local activado");
}

/** Display a message in the chat log. */
function logChat(author, message) {
  const log = document.getElementById("chat-log");
  const entry = document.createElement("div");
  entry.innerHTML = `<strong>${author}:</strong> ${message}`;
  log.appendChild(entry);
  log.scrollTop = log.scrollHeight;
}

/** Toggle the connection timer display. */
function startTimer() {
  clearInterval(timerInterval);
  timerSeconds = 0;
  state.time = 0;
  timerLabel.textContent = "00:00";
  timerInterval = setInterval(() => {
    timerSeconds += 1;
    state.time = timerSeconds;
    const minutes = Math.floor(timerSeconds / 60)
      .toString()
      .padStart(2, "0");
    const secs = (timerSeconds % 60).toString().padStart(2, "0");
    timerLabel.textContent = `${minutes}:${secs}`;
  }, 1000);
}

/** Reset timer and scoreboard. */
function resetMatch() {
  state.score.left = 0;
  state.score.right = 0;
  scoreboardLabels.left.textContent = "0";
  scoreboardLabels.right.textContent = "0";
  timerLabel.textContent = "00:00";
  timerSeconds = 0;
  goalCooldown = 0;
  clearInterval(timerInterval);
}

/** Update status label in the UI. */
function updateStatus(text) {
  document.getElementById("connection-status").textContent = text;
}

/** Establish the WebSocket connection. */
function connectSocket() {
  disconnectSocket();
  socket = new GameSocket(
    (event) => {
      if (event.type === "ready") {
        resetMatch();
        resetPositions();
        startTimer();
        updateStatus(`Sala: ${event.room}`);
      }
      if (event.type === "state") {
        Object.assign(state, event.state);
        scoreboardLabels.left.textContent = state.score.left;
        scoreboardLabels.right.textContent = state.score.right;
      }
      if (event.type === "chat") {
        logChat(event.from, event.message);
      }
      if (event.type === "ai_state") {
        state.ball = event.ball;
        state.players.p2.x = event.npc.position[0];
        state.players.p2.y = event.npc.position[1];
      }
    },
    () => updateStatus("Desconectado"),
  );
}

/** Close any existing WebSocket connection. */
function disconnectSocket() {
  if (socket) {
    socket.close();
    socket = null;
  }
}

/** Restore players and ball to the kick-off positions. */
function resetPositions() {
  state.players.p1.x = 220;
  state.players.p1.y = FLOOR_Y;
  state.players.p1.vx = 0;
  state.players.p1.vy = 0;
  state.players.p2.x = canvas.width - 220;
  state.players.p2.y = FLOOR_Y;
  state.players.p2.vx = 0;
  state.players.p2.vy = 0;
  state.ball.x = canvas.width / 2;
  state.ball.y = FLOOR_Y - BALL_RADIUS;
  state.ball.vx = 0;
  state.ball.vy = 0;
}

setupUI();
enterLocalMode();
startLoop();

/** Render the background stadium, pitch, and goals. */
function drawArena() {
  const turfHeight = canvas.height - FLOOR_Y;

  const skyGradient = ctx.createLinearGradient(0, 0, 0, FLOOR_Y);
  skyGradient.addColorStop(0, "#191f33");
  skyGradient.addColorStop(1, "#263655");
  ctx.fillStyle = skyGradient;
  ctx.fillRect(0, 0, canvas.width, FLOOR_Y);

  ctx.fillStyle = "#1d2842";
  ctx.fillRect(0, 70, canvas.width, 210);

  ctx.fillStyle = "#242f4b";
  for (let i = 0; i < 12; i += 1) {
    const bandHeight = 12;
    const y = 80 + i * 16;
    ctx.fillRect(0, y, canvas.width, bandHeight);
  }

  ctx.fillStyle = "#0f1729";
  ctx.fillRect(0, FLOOR_Y - 45, canvas.width, 45);

  const turfGradient = ctx.createLinearGradient(0, FLOOR_Y, 0, canvas.height);
  turfGradient.addColorStop(0, "#16632f");
  turfGradient.addColorStop(1, "#104a24");
  ctx.fillStyle = turfGradient;
  ctx.fillRect(0, FLOOR_Y, canvas.width, turfHeight);

  ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
  ctx.fillRect(canvas.width / 2 - 2, FLOOR_Y, 4, turfHeight);

  ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(canvas.width / 2, FLOOR_Y, 70, Math.PI, 0);
  ctx.stroke();

  drawGoal("left");
  drawGoal("right");
}

/** Draw a goal on the field. */
function drawGoal(side) {
  ctx.save();
  if (side === "left") {
    ctx.translate(GOAL_LINE_LEFT - GOAL_POST_THICKNESS, GOAL_TOP);
  } else {
    ctx.translate(GOAL_LINE_RIGHT + GOAL_POST_THICKNESS, GOAL_TOP);
    ctx.scale(-1, 1);
  }

  ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
  ctx.beginPath();
  ctx.moveTo(GOAL_POST_THICKNESS, 0);
  ctx.lineTo(GOAL_POST_THICKNESS + GOAL_DEPTH, GOAL_MOUTH_HEIGHT * 0.18);
  ctx.lineTo(GOAL_POST_THICKNESS + GOAL_DEPTH, GOAL_MOUTH_HEIGHT);
  ctx.lineTo(GOAL_POST_THICKNESS, GOAL_MOUTH_HEIGHT);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
  ctx.lineWidth = 1;
  for (let y = 14; y < GOAL_MOUTH_HEIGHT; y += 16) {
    ctx.beginPath();
    ctx.moveTo(GOAL_POST_THICKNESS, y);
    ctx.lineTo(GOAL_POST_THICKNESS + GOAL_DEPTH, y - GOAL_MOUTH_HEIGHT * 0.18);
    ctx.stroke();
  }
  for (let xLine = GOAL_POST_THICKNESS + 8; xLine < GOAL_POST_THICKNESS + GOAL_DEPTH; xLine += 16) {
    ctx.beginPath();
    ctx.moveTo(xLine, (xLine - GOAL_POST_THICKNESS) * 0.18);
    ctx.lineTo(xLine, GOAL_MOUTH_HEIGHT);
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
  ctx.fillRect(0, 0, GOAL_POST_THICKNESS, GOAL_MOUTH_HEIGHT);
  ctx.fillRect(0, 0, GOAL_POST_THICKNESS + 8, GOAL_POST_THICKNESS);

  ctx.restore();
}

/** Bounce the ball when it collides with goal structures. */
function handleGoalStructures() {
  const leftPost = {
    x: GOAL_LINE_LEFT - GOAL_POST_THICKNESS,
    y: GOAL_TOP,
    width: GOAL_POST_THICKNESS,
    height: GOAL_MOUTH_HEIGHT,
  };
  const rightPost = {
    x: GOAL_LINE_RIGHT,
    y: GOAL_TOP,
    width: GOAL_POST_THICKNESS,
    height: GOAL_MOUTH_HEIGHT,
  };

  resolveBallRectCollision(state.ball, leftPost);
  resolveBallRectCollision(state.ball, rightPost);
}

/** Detect if the ball crossed either goal line. */
function detectGoal() {
  const withinVertical = state.ball.y + BALL_RADIUS > GOAL_TOP && state.ball.y - BALL_RADIUS < FLOOR_Y;
  if (!withinVertical) {
    return null;
  }
  if (state.ball.x - BALL_RADIUS <= GOAL_LINE_LEFT) {
    return "right";
  }
  if (state.ball.x + BALL_RADIUS >= GOAL_LINE_RIGHT) {
    return "left";
  }
  return null;
}

/** Update score and reset after a goal. */
function awardGoal(side) {
  state.score[side] += 1;
  scoreboardLabels.left.textContent = state.score.left;
  scoreboardLabels.right.textContent = state.score.right;
  resetPositions();
}

/** Resolve the collision between a circle and an axis-aligned rectangle. */
function resolveBallRectCollision(ball, rect) {
  const closestX = clamp(ball.x, rect.x, rect.x + rect.width);
  const closestY = clamp(ball.y, rect.y, rect.y + rect.height);

  const dx = ball.x - closestX;
  const dy = ball.y - closestY;
  const distanceSq = dx * dx + dy * dy;
  if (distanceSq >= BALL_RADIUS * BALL_RADIUS) {
    return false;
  }

  const distance = Math.sqrt(distanceSq) || 0.0001;
  const nx = dx / distance;
  const ny = dy / distance;
  const overlap = BALL_RADIUS - distance + 0.5;
  ball.x += nx * overlap;
  ball.y += ny * overlap;

  const relativeVelocity = ball.vx * nx + ball.vy * ny;
  if (relativeVelocity < 0) {
    ball.vx -= (1 + POST_RESTITUTION) * relativeVelocity * nx;
    ball.vy -= (1 + POST_RESTITUTION) * relativeVelocity * ny;
  } else {
    ball.vx += nx * overlap * 20;
    ball.vy += ny * overlap * 20;
  }

  return true;
}

/** Clamp a value between two bounds. */
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
