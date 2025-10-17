import { ApiClient, GameSocket } from "./net.js";

const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");

const api = new ApiClient();
let socket = null;
let mode = "local";
let timerInterval = null;
let timerSeconds = 0;
let goalCooldown = 0;
let goalBannerTimeout = null;
const MATCH_DURATION = 120;

const TRANSPARENT_PIXEL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/l8a9WAAAAABJRU5ErkJggg==";

const PLAYER_WIDTH = 64;
const PLAYER_HEIGHT = 64;
const PLAYER_SPEED = 220;
const JUMP_VELOCITY = -340;
const BALL_RADIUS = 16;
const FLOOR_Y = 420;
const CEILING_LIMIT = 55;
const GOAL_MOUTH_HEIGHT = 150;
const GOAL_LINE_OFFSET = 80;
const GOAL_POST_THICKNESS = 16;
const GOAL_CROSSBAR_THICKNESS = 12;
const GOAL_DEPTH = 60;
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
const goalBanner = document.getElementById("goal-banner");
const matchEndOverlay = document.getElementById("match-finished");
const finalScoreLeft = document.getElementById("final-score-left");
const finalScoreRight = document.getElementById("final-score-right");
const restartButton = document.getElementById("restart-button");
/** Elementos del juego */
const sprites = {
  background: loadSprite("img/background.png"),
  field: loadSprite("img/field.png"),
  player1: loadSprite("img/placeholder_player1.png"),
  player2: loadSprite("img/placeholder_player2.png"),
  ball: loadSprite("img/ball.png"),
};

const state = {
  time: 0,
  players: {
    p1: { x: 220, y: FLOOR_Y, vx: 0, vy: 0, facing: 1 },
    p2: { x: canvas.width - 220, y: FLOOR_Y, vx: 0, vy: 0, facing: -1 },
  },
  ball: { x: canvas.width / 2, y: FLOOR_Y - BALL_RADIUS, vx: 0, vy: 0 },
  score: { left: 0, right: 0 },
  pressed: {},
};

/** Carga un sprite desde la carpeta estatica. */
function loadSprite(path) {
  const image = new Image();
  image.src = `/static/${path}`;
  image.addEventListener("error", () => {
    image.__missing = true;
    image.src = TRANSPARENT_PIXEL;
  });
  image.addEventListener("load", () => {
    image.__loaded = true;
  });
  return image;
}

/** Inicia el bucle local de renderizado y actualizacion. */
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

/** Actualiza la fisica y las posiciones segun el modo de juego actual. */
function update(delta) {
  goalCooldown = Math.max(0, goalCooldown - delta);

  Object.entries(state.players).forEach(([key, player]) => {
    if (mode === "local") {
      player.vx = 0;
      const leftKey = key === "p1" ? "KeyA" : "ArrowLeft";
      const rightKey = key === "p1" ? "KeyD" : "ArrowRight";
      if (state.pressed[leftKey]) {
        player.vx = -PLAYER_SPEED;
        player.facing = -1;
      }
      if (state.pressed[rightKey]) {
        player.vx = PLAYER_SPEED;
        player.facing = 1;
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
    updateFacingFromVelocity(player);
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

  const scoredSide = detectGoal();
  if (scoredSide && goalCooldown <= 0) {
    awardGoal(scoredSide);
    goalCooldown = 1.0;
    return;
  }

  handleGoalStructures();
  handleBallPlayerCollision(state.players.p1);
  handleBallPlayerCollision(state.players.p2);
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

  if (mode === "online" && socket) {
    socket.sendState({
      players: state.players,
      ball: state.ball,
      score: state.score,
      timestamp: Date.now(),
    });
  }
}

/** Dibuja todos los elementos del juego en el canvas. */
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
  drawPlayerSprite(state.players.p1, sprites.player1);
  drawPlayerSprite(state.players.p2, sprites.player2);
}

/** Vincula los eventos de la interfaz y del teclado. */
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

  window.addEventListener(
    "keydown",
    (event) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(event.code)) {
        event.preventDefault();
      }
      state.pressed[event.code] = true;
      if (event.code === "KeyW" && state.players.p1.vy === 0) {
        state.players.p1.vy = JUMP_VELOCITY;
      }
      if (event.code === "ArrowUp" && state.players.p2.vy === 0) {
        state.players.p2.vy = JUMP_VELOCITY;
      }
    },
    { passive: false },
  );
  window.addEventListener(
    "keyup",
    (event) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(event.code)) {
        event.preventDefault();
      }
      state.pressed[event.code] = false;
    },
    { passive: false },
  );

  if (restartButton) {
    restartButton.addEventListener("click", restartMatch);
  }
}

/** Cambia al modo local para dos jugadores. */
function enterLocalMode() {
  mode = "local";
  disconnectSocket();
  resetMatch();
  resetPositions();
  startTimer();
  updateStatus("Modo local activado");
}

/** Muestra un mensaje en el historial del chat. */
function logChat(author, message) {
  const log = document.getElementById("chat-log");
  const entry = document.createElement("div");
  entry.innerHTML = `<strong>${author}:</strong> ${message}`;
  log.appendChild(entry);
  log.scrollTop = log.scrollHeight;
}

/** Alterna la visualizacion del temporizador de conexion. */
function startTimer() {
  clearInterval(timerInterval);
  timerSeconds = MATCH_DURATION;
  state.time = MATCH_DURATION;
  updateTimerLabel(timerSeconds);
  hideMatchEnd();
  timerInterval = setInterval(() => {
    timerSeconds -= 1;
    if (timerSeconds <= 0) {
      state.time = 0;
      updateTimerLabel(0);
      endMatch();
      return;
    }
    state.time = timerSeconds;
    updateTimerLabel(timerSeconds);
  }, 1000);
}

/** Reinicia el temporizador y el marcador. */
function resetMatch() {
  state.score.left = 0;
  state.score.right = 0;
  scoreboardLabels.left.textContent = "0";
  scoreboardLabels.right.textContent = "0";
  timerSeconds = MATCH_DURATION;
  state.time = MATCH_DURATION;
  updateTimerLabel(MATCH_DURATION);
  goalCooldown = 0;
  state.pressed = {};
  clearInterval(timerInterval);
  hideMatchEnd();
}

/** Actualiza la etiqueta de estado en la interfaz. */
function updateStatus(text) {
  document.getElementById("connection-status").textContent = text;
}

/** Establece la conexion WebSocket. */
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
        updateFacingFromVelocity(state.players.p1);
        updateFacingFromVelocity(state.players.p2);
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
        updateFacingFromVelocity(state.players.p2);
      }
    },
    () => updateStatus("Desconectado"),
  );
}

/** Cierra cualquier conexion WebSocket existente. */
function disconnectSocket() {
  if (socket) {
    socket.close();
    socket = null;
  }
}

/** Restaura jugadores y pelota a las posiciones iniciales. */
function resetPositions() {
  state.players.p1.x = 220;
  state.players.p1.y = FLOOR_Y;
  state.players.p1.vx = 0;
  state.players.p1.vy = 0;
  state.players.p1.facing = 1;
  state.players.p2.x = canvas.width - 220;
  state.players.p2.y = FLOOR_Y;
  state.players.p2.vx = 0;
  state.players.p2.vy = 0;
  state.players.p2.facing = -1;
  state.ball.x = canvas.width / 2;
  state.ball.y = FLOOR_Y - BALL_RADIUS;
  state.ball.vx = 0;
  state.ball.vy = 0;
}

setupUI();
enterLocalMode();
startLoop();

/** Renderiza el estadio de fondo, la cancha y los arcos. */
function drawArena() {
  drawBackgroundLayer();
  const hasCustomField = drawFieldLayer();
  drawPitchOverlay(hasCustomField);
  drawGoal("left");
  drawGoal("right");
}

/** Pinta el fondo del estadio usando una imagen personalizable o un degradado alternativo. */
function drawBackgroundLayer() {
  const background = sprites.background;
  if (background.complete && !background.__missing) {
    ctx.drawImage(background, 0, 0, canvas.width, canvas.height);
    return true;
  }

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

  return false;
}

/** Pinta la cancha con una imagen personalizable o degradados alternativos. */
function drawFieldLayer() {
  const field = sprites.field;
  const fieldTop = FLOOR_Y;
  const fieldHeight = canvas.height - FLOOR_Y;

  if (field.complete && !field.__missing) {
    ctx.drawImage(field, 0, fieldTop, canvas.width, fieldHeight);
    return true;
  }

  ctx.fillStyle = "#0f1729";
  ctx.fillRect(0, FLOOR_Y - 45, canvas.width, 45);

  const turfGradient = ctx.createLinearGradient(0, FLOOR_Y, 0, canvas.height);
  turfGradient.addColorStop(0, "#16632f");
  turfGradient.addColorStop(1, "#104a24");
  ctx.fillStyle = turfGradient;
  ctx.fillRect(0, FLOOR_Y, canvas.width, canvas.height - FLOOR_Y);

  return false;
}

/** Dibuja las lineas de la cancha por encima de la textura. */
function drawPitchOverlay(skipLines) {
  if (skipLines) {
    return;
  }
  const turfHeight = canvas.height - FLOOR_Y;

  ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
  ctx.fillRect(canvas.width / 2 - 2, FLOOR_Y, 4, turfHeight);

  ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(canvas.width / 2, FLOOR_Y, 70, 0, Math.PI);
  ctx.stroke();
}

/** Dibuja un arco en la cancha. */
function drawGoal(side) {
  ctx.save();
  if (side === "left") {
    ctx.translate(GOAL_LINE_LEFT - GOAL_POST_THICKNESS, GOAL_TOP);
  } else {
    ctx.translate(GOAL_LINE_RIGHT + GOAL_POST_THICKNESS, GOAL_TOP);
    ctx.scale(-1, 1);
  }

  ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
  ctx.fillRect(-GOAL_DEPTH, 0, GOAL_DEPTH, GOAL_MOUTH_HEIGHT);

  ctx.strokeStyle = "rgba(255, 255, 255, 0.14)";
  ctx.lineWidth = 1;
  for (let y = 12; y < GOAL_MOUTH_HEIGHT; y += 12) {
    ctx.beginPath();
    ctx.moveTo(-GOAL_DEPTH, y);
    ctx.lineTo(0, y);
    ctx.stroke();
  }
  for (let x = -GOAL_DEPTH; x <= 0; x += 12) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, GOAL_MOUTH_HEIGHT);
    ctx.stroke();
  }

  ctx.fillStyle = "#f4f4f8";
  ctx.fillRect(0, 0, GOAL_POST_THICKNESS, GOAL_MOUTH_HEIGHT);
  ctx.fillRect(-GOAL_DEPTH, 0, GOAL_POST_THICKNESS, GOAL_MOUTH_HEIGHT);
  ctx.fillRect(-GOAL_DEPTH, 0, GOAL_DEPTH + GOAL_POST_THICKNESS, GOAL_CROSSBAR_THICKNESS);

  ctx.restore();
}

/** Rebota la pelota cuando choca con las estructuras del arco. */
function handleGoalStructures() {
  const leftCrossbar = {
    x: GOAL_LINE_LEFT - GOAL_DEPTH,
    y: GOAL_TOP - GOAL_CROSSBAR_THICKNESS,
    width: GOAL_DEPTH + GOAL_POST_THICKNESS,
    height: GOAL_CROSSBAR_THICKNESS,
  };
  const rightCrossbar = {
    x: GOAL_LINE_RIGHT - GOAL_POST_THICKNESS,
    y: GOAL_TOP - GOAL_CROSSBAR_THICKNESS,
    width: GOAL_DEPTH + GOAL_POST_THICKNESS,
    height: GOAL_CROSSBAR_THICKNESS,
  };

  resolveBallRectCollision(state.ball, leftCrossbar);
  resolveBallRectCollision(state.ball, rightCrossbar);
}

/** Maneja la colision entre un jugador (aproximado como un circulo) y la pelota. */
function handleBallPlayerCollision(player) {
  const playerRadius = PLAYER_HEIGHT * 0.45;
  const centerX = player.x;
  const centerY = player.y - PLAYER_HEIGHT / 2;
  const dx = state.ball.x - centerX;
  const dy = state.ball.y - centerY;
  const distance = Math.hypot(dx, dy) || 0.0001;
  const minDistance = BALL_RADIUS + playerRadius;
  if (distance >= minDistance) {
    return;
  }

  const nx = dx / distance;
  const ny = dy / distance;
  const overlap = minDistance - distance;
  state.ball.x += nx * overlap;
  state.ball.y += ny * overlap;

  const relativeVx = state.ball.vx - player.vx;
  const relativeVy = state.ball.vy - player.vy;
  const impact = relativeVx * nx + relativeVy * ny;
  if (impact < 0) {
    const restitution = 0.9;
    state.ball.vx -= (1 + restitution) * impact * nx;
    state.ball.vy -= (1 + restitution) * impact * ny;
  }
}

/** Detecta si la pelota cruzo alguna linea de gol. */
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

/** Actualiza el marcador y reinicia despues de un gol. */
function awardGoal(side) {
  state.score[side] += 1;
  scoreboardLabels.left.textContent = state.score.left;
  scoreboardLabels.right.textContent = state.score.right;
  showGoalBanner();
  resetPositions();
}

/** Resuelve la colision entre un circulo y un rectangulo alineado a los ejes. */
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

/** Limita un valor entre dos extremos. */
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/** Muestra un cartel temporal de celebracion tras anotar. */
function showGoalBanner(text = "GOOOL!") {
  if (!goalBanner) {
    return;
  }
  goalBanner.textContent = text;
  goalBanner.classList.add("show");
  clearTimeout(goalBannerTimeout);
  goalBannerTimeout = setTimeout(() => {
    goalBanner.classList.remove("show");
  }, 1500);
}

/** Gestiona el estado de fin de partido cuando el contador llega a cero. */
function endMatch() {
  clearInterval(timerInterval);
  timerInterval = null;
  state.time = 0;
  updateTimerLabel(0);
  showMatchEnd();
}

/** Reinicia el partido local desde el comienzo. */
function restartMatch() {
  mode = "local";
  disconnectSocket();
  resetMatch();
  resetPositions();
  startTimer();
  updateStatus("Modo local activado");
}

/** Muestra la superposicion de fin de partido con el marcador final. */
function showMatchEnd() {
  if (!matchEndOverlay) {
    return;
  }
  state.pressed = {};
  Object.values(state.players).forEach((player) => {
    player.vx = 0;
    player.vy = 0;
  });
  if (finalScoreLeft) {
    finalScoreLeft.textContent = scoreboardLabels.left.textContent;
  }
  if (finalScoreRight) {
    finalScoreRight.textContent = scoreboardLabels.right.textContent;
  }
  matchEndOverlay.classList.add("show");
}

/** Oculta la superposicion de fin de partido. */
function hideMatchEnd() {
  if (matchEndOverlay) {
    matchEndOverlay.classList.remove("show");
  }
}

/** Actualiza la etiqueta del temporizador con texto formateado. */
function updateTimerLabel(seconds) {
  timerLabel.textContent = formatTime(seconds);
}

/** Formatea los segundos en mm:ss. */
function formatTime(seconds) {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60)
    .toString()
    .padStart(2, "0");
  const secs = (safe % 60).toString().padStart(2, "0");
  return `${minutes}:${secs}`;
}

/** Dibuja el sprite de un jugador teniendo en cuenta su direccion. */
function drawPlayerSprite(player, sprite) {
  ctx.save();
  ctx.translate(player.x, player.y);
  if (player.facing > 0) {
    ctx.scale(-1, 1);
  }
  ctx.drawImage(
    sprite,
    -PLAYER_WIDTH / 2,
    -PLAYER_HEIGHT,
    PLAYER_WIDTH,
    PLAYER_HEIGHT,
  );
  ctx.restore();
}

/** Asegura que un jugador tenga una direccion acorde con su velocidad. */
function updateFacingFromVelocity(player) {
  if (typeof player.facing !== "number") {
    player.facing = player.vx >= 0 ? 1 : -1;
    return;
  }
  if (player.vx > 5) {
    player.facing = 1;
  } else if (player.vx < -5) {
    player.facing = -1;
  }
}

