import { ApiClient, GameSocket } from "./net.js";

const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");
const canvasWrapper = document.querySelector(".canvas-wrapper");

const api = new ApiClient();
let socket = null;
let mode = "menu";
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
const JUMP_BUFFER_TIME = 0.18;
const COYOTE_TIME = 0.1;
const jumpKeys = {
  p1: "KeyW",
  p2: "ArrowUp",
};
const FOOT_KEYS = {
  p1: "KeyF",
  p2: "KeyL",
};
const FOOT_SWING_RADIUS = 36;
const FOOT_MIN_ANGLE = 0.55;
const FOOT_MAX_ANGLE = 1.45;
const FOOT_RAISE_SPEED = 9.2;
const FOOT_LOWER_SPEED = 12.4;
const FOOT_RADIUS = 18;
const FOOT_KICK_THRESHOLD = 45;
const FOOT_MAX_KICK_SPEED = 520;
const FOOT_IMPULSE = 4.4;
const FOOT_VERTICAL_RATIO = 0.68;
const FOOT_UPWARD_LIFT = 0.12;
const BALL_SPIN_DAMPING = 0.985;
const FOOT_PIVOT_OFFSET_X = PLAYER_WIDTH / 2 - 16;
const FOOT_PIVOT_OFFSET_Y = 60;

const GOAL_TOP = FLOOR_Y - GOAL_MOUTH_HEIGHT;
const GOAL_LINE_LEFT = GOAL_LINE_OFFSET;
const GOAL_LINE_RIGHT = canvas.width - GOAL_LINE_OFFSET;

const scoreboardLabels = {
  left: document.getElementById("score-left"),
  right: document.getElementById("score-right"),
};
const connectionStatusLabel = document.getElementById("connection-status");
const timerLabel = document.getElementById("match-timer");
const goalBanner = document.getElementById("goal-banner");
const matchEndOverlay = document.getElementById("match-finished");
const finalScoreLeft = document.getElementById("final-score-left");
const finalScoreRight = document.getElementById("final-score-right");
const restartButton = document.getElementById("restart-button");
const scoreboardAvatars = {
  left: document.getElementById("score-avatar-left"),
  right: document.getElementById("score-avatar-right"),
};
const characterSelectionOverlay = document.getElementById("character-selection");
const startMatchButton = document.getElementById("start-match-button");
const characterDisplays = {
  p1: document.getElementById("character-display-p1"),
  p2: document.getElementById("character-display-p2"),
};
const characterNavButtons = Array.from(document.querySelectorAll(".character-nav"));
const menuScreen = document.getElementById("menu-screen");
const menuStartLocalButton = document.getElementById("menu-start-local");
const menuStartAiButton = document.getElementById("menu-start-ai");
const menuAiOptions = document.getElementById("menu-ai-options");
const aiDifficultyButtons = Array.from(document.querySelectorAll(".ai-difficulty"));
const menuStartTournamentButton = document.getElementById("menu-start-tournament");
const openMainMenuButton = document.getElementById("open-main-menu");
const fullscreenToggle = document.getElementById("fullscreen-toggle");
const tournamentPanel = document.getElementById("tournament-panel");
const tournamentBracketList = document.getElementById("tournament-bracket");
const tournamentTrophy = document.getElementById("tournament-trophy");
const modeLabel = document.getElementById("current-mode-label");
const DEFAULT_SPRITES = {
  p1: "img/placeholder_player1.png",
  p2: "img/placeholder_player2.png",
};
const DEFAULT_AVATARS = {
  p1: "/static/img/placeholder_player1.png",
  p2: "/static/img/placeholder_player2.png",
};
const FOOT_SPRITE_PATH = "img/botin.png";
const characters = [
  {
    id: "ingeniero-azul",
    name: "Cuervo",
    sprite: "img/cuervo1.png",
    portrait: "img/cuervo1.png",
    tagline: "No gana nada desde que nacio.",
  },
  {
    id: "ingeniera-roja",
    name: "Colapinto",
    sprite: "img/Colapinto.png",
    portrait: "img/Colapinto.png",
    tagline: "Lo sacan de la f1 el a�o que viene.",
  },
  {
    id: "placeholder-01",
    name: "Prime",
    sprite: "img/prime.png",
    portrait: "img/prime.png",
    tagline: "En busca de ponerla.",
  },
  {
    id: "placeholder-02",
    name: "Nenazo",
    sprite: "img/nenazo.png",
    portrait: "img/nenazo.png",
    tagline: "Nacio ayer",
  },
  {
    id: "placeholder-03",
    name: "Placeholder 03",
    sprite: "img/placeholder_character_03.png",
    portrait: "img/placeholder_character_03.png",
    tagline: "Slot listo para personalizacion.",
  },
  {
    id: "placeholder-04",
    name: "Placeholder 04",
    sprite: "img/placeholder_character_04.png",
    portrait: "img/placeholder_character_04.png",
    tagline: "Ideal para tu proximo personaje.",
  },
  {
    id: "placeholder-05",
    name: "Placeholder 05",
    sprite: "img/placeholder_character_05.png",
    portrait: "img/placeholder_character_05.png",
    tagline: "Cambia sprite y retrato desde la carpeta img.",
  },
  {
    id: "placeholder-06",
    name: "Placeholder 06",
    sprite: "img/placeholder_character_06.png",
    portrait: "img/placeholder_character_06.png",
    tagline: "Personalizable para eventos especiales.",
  },
  {
    id: "placeholder-07",
    name: "Placeholder 07",
    sprite: "img/placeholder_character_07.png",
    portrait: "img/placeholder_character_07.png",
    tagline: "Usa este espacio para un invitado sorpresa.",
  },
  {
    id: "placeholder-08",
    name: "Placeholder 08",
    sprite: "img/placeholder_character_08.png",
    portrait: "img/placeholder_character_08.png",
    tagline: "Mantene todos los assets bajo control.",
  },
  {
    id: "placeholder-09",
    name: "Placeholder 09",
    sprite: "img/placeholder_character_09.png",
    portrait: "img/placeholder_character_09.png",
    tagline: "Listo para tu personaje favorito.",
  },
  {
    id: "placeholder-10",
    name: "Placeholder 10",
    sprite: "img/placeholder_character_10.png",
    portrait: "img/placeholder_character_10.png",
    tagline: "Personaliza nombre, retrato y sprite.",
  },
];
const AI_DIFFICULTIES = {
  easy: {
    label: "Facil",
    speedMultiplier: 0.68,
    steering: 0.08,
    acceleration: 420,
    reaction: 0.28,
    moveThreshold: 20,
    brake: 0.85,
    predictFactor: 0.18,
    jumpCooldown: 0.9,
    jumpAggression: 0.55,
    aerialReach: 85,
    slamImpulse: 140,
    targetSmoothing: 0.7,
    gravityMultiplier: 1,
    ballChaseFactor: 0.35,
    defenseBias: 0.2,
    goalGuardZone: 60,
    goalHoldDistance: 30,
  },
  normal: {
    label: "Normal",
    speedMultiplier: 1.0,
    steering: 0.18,
    acceleration: 620,
    reaction: 0.16,
    moveThreshold: 10,
    brake: 0.8,
    predictFactor: 0.32,
    jumpCooldown: 0.6,
    jumpAggression: 0.9,
    aerialReach: 120,
    slamImpulse: 190,
    targetSmoothing: 0.55,
    gravityMultiplier: 1,
    ballChaseFactor: 0.58,
    defenseBias: 0.45,
    goalGuardZone: 65,
    goalHoldDistance: 38,
  },
  god: {
    label: "Dios",
    speedMultiplier: 1.48,
    steering: 0.32,
    acceleration: 920,
    reaction: 0.04,
    moveThreshold: 5,
    brake: 0.62,
    predictFactor: 0.58,
    jumpCooldown: 0.24,
    jumpAggression: 1.9,
    aerialReach: 210,
    slamImpulse: 320,
    targetSmoothing: 0.2,
    gravityMultiplier: 1,
    ballChaseFactor: 0.88,
    defenseBias: 0.82,
    goalGuardZone: 78,
    goalHoldDistance: 48,
  },
};
const AI_CHAT = {
  start: [
    "Empezo el show.",
    "Cargando protocolos para ganar.",
    "Espero que hayas calentado.",
  ],
  score: [
    "Gol cantado.",
    "Asi se hace.",
    "Ciencia 1 - Humanos 0.",
  ],
  concede: [
    "Error detectado, ajustando.",
    "No vuelve a pasar.",
    "Buen disparo, no te confies.",
  ],
  matchWin: [
    "Partida controlada.",
    "Sistema superior confirmado.",
    "Te gane sin despeinarme.",
  ],
  matchLose: [
    "Buena jugada, aprendere de esto.",
    "Esta derrota alimenta mi codigo.",
    "Tomare nota para la proxima.",
  ],
  champion: [
    "La copa es mia.",
    "Modo dios activado. Gracias por jugar.",
    "Torneo asegurado.",
  ],
  defeat: [
    "Recalculando... felicidades.",
    "Has ganado esta vez.",
    "Buen partido, humano.",
  ],
};
const TOURNAMENT_ROUNDS = [
  { label: "Cuartos", opponent: "Delta Team", difficulty: "easy" },
  { label: "Semifinal", opponent: "Omega Squad", difficulty: "normal" },
  { label: "Final", opponent: "Divinos", difficulty: "god" },
];
const selectedCharacters = {
  p1: null,
  p2: null,
};
const defaultSelectionIndices = {
  p1: 0,
  p2: 1,
};
const selectionState = {
  p1: null,
  p2: null,
};
let pendingMode = null;
let aiDifficulty = "normal";
const tournamentState = {
  active: false,
  roundIndex: 0,
  results: [],
};
let aiMessageTimeout = null;
const spriteCache = {};
/** Elementos del juego */
const sprites = {
  background: getSprite("img/backgroundb.png"),
  field: getSprite("img/cancha.png"),
  player1: getSprite(DEFAULT_SPRITES.p1),
  player2: getSprite(DEFAULT_SPRITES.p2),
  ball: getSprite("img/ball.png"),
  foot: getSprite(FOOT_SPRITE_PATH),
};

function createFootState() {
  return {
    angle: FOOT_MIN_ANGLE,
    raising: false,
    velocity: 0,
    velocityX: 0,
    velocityY: 0,
    hitCooldown: 0,
    worldX: null,
    worldY: null,
  };
}

const state = {
  time: 0,
  players: {
    p1: {
      x: 220,
      y: FLOOR_Y,
      vx: 0,
      vy: 0,
      facing: 1,
      foot: createFootState(),
    },
    p2: {
      x: canvas.width - 220,
      y: FLOOR_Y,
      vx: 0,
      vy: 0,
      facing: -1,
      foot: createFootState(),
    },
  },
  ball: { x: canvas.width / 2, y: FLOOR_Y - BALL_RADIUS, vx: 0, vy: 0, rotation: 0, spin: 0 },
  score: { left: 0, right: 0 },
  pressed: {},
};
const playerControl = {
  p1: { bufferedJump: 0, coyoteTime: COYOTE_TIME },
  p2: { bufferedJump: 0, coyoteTime: COYOTE_TIME },
};
const aiController = {
  jumpCooldown: 0,
  reactionTimer: 0,
  targetX: canvas.width - 220,
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

function getSprite(path) {
  if (!spriteCache[path]) {
    spriteCache[path] = loadSprite(path);
  }
  return spriteCache[path];
}

function initializeCharacterSelection() {
  if (!characterSelectionOverlay) {
    return;
  }
  resetSelectionDisplays();
  characterNavButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const player = button.dataset.player;
      const step = button.dataset.direction === "next" ? 1 : -1;
      cycleCharacter(player, step);
    });
  });
  if (startMatchButton) {
    startMatchButton.addEventListener("click", startConfiguredMatch);
  }
  updateStartMatchAvailability();
}

function cycleCharacter(player, step) {
  if (!player || !characters.length) {
    return;
  }
  const currentIndex =
    typeof selectionState[player] === "number"
      ? selectionState[player]
      : defaultSelectionIndices[player] ?? 0;
  const nextIndex = normalizeIndex(currentIndex + step);
  setCharacterForPlayer(player, nextIndex);
}

function normalizeIndex(index) {
  const total = characters.length;
  if (total === 0) {
    return 0;
  }
  return ((index % total) + total) % total;
}

function setCharacterForPlayer(player, index) {
  if (!characters[index]) {
    return;
  }
  selectionState[player] = index;
  const character = characters[index];
  selectedCharacters[player] = character;
  applySelectionToPlayer(player, character);
  updateCharacterDisplay(player, character);
  updateStartMatchAvailability();
}

function updateCharacterDisplay(player, character) {
  const display = characterDisplays[player];
  if (!display) {
    return;
  }
  const image = display.querySelector(".character-image");
  const name = display.querySelector(".character-name");
  const tagline = display.querySelector(".character-tagline");
  if (character) {
    const portraitPath = `/static/${character.portrait || character.sprite}`;
    if (image) {
      image.src = portraitPath;
      image.alt = character.name;
    }
    if (name) {
      name.textContent = character.name;
    }
    if (tagline) {
      tagline.textContent = character.tagline || "Listo para la cancha.";
    }
    return;
  }
  const defaults = {
    p1: {
      src: DEFAULT_AVATARS.p1,
      name: "Jugador 1",
      tagline: "Selecciona un personaje",
    },
    p2: {
      src: DEFAULT_AVATARS.p2,
      name: "Jugador 2",
      tagline: "Selecciona un personaje",
    },
  };
  const fallback = defaults[player];
  if (image) {
    image.src = fallback.src;
    image.alt = fallback.name;
  }
  if (name) {
    name.textContent = fallback.name;
  }
  if (tagline) {
    tagline.textContent = fallback.tagline;
  }
}

function applySelectionToPlayer(player, character) {
  if (!character) {
    return;
  }
  const sprite = getSprite(character.sprite);
  const portraitPath = `/static/${character.portrait || character.sprite}`;
  if (player === "p1") {
    sprites.player1 = sprite;
    setAvatarForPlayer("p1", portraitPath, character.name);
  } else {
    sprites.player2 = sprite;
    setAvatarForPlayer("p2", portraitPath, character.name);
  }
}

function setAvatarForPlayer(player, src, altText) {
  const element = player === "p1" ? scoreboardAvatars.left : scoreboardAvatars.right;
  if (!element) {
    return;
  }
  if (src) {
    element.src = src;
  }
  if (altText) {
    element.alt = altText;
  }
}

function updateStartMatchAvailability() {
  if (!startMatchButton) {
    return;
  }
  const ready = Boolean(selectedCharacters.p1 && selectedCharacters.p2);
  startMatchButton.disabled = !ready;
}

function clearSelectedCharacters() {
  selectedCharacters.p1 = null;
  selectedCharacters.p2 = null;
  selectionState.p1 = null;
  selectionState.p2 = null;
  sprites.player1 = getSprite(DEFAULT_SPRITES.p1);
  sprites.player2 = getSprite(DEFAULT_SPRITES.p2);
  setAvatarForPlayer("p1", DEFAULT_AVATARS.p1, "Jugador 1");
  setAvatarForPlayer("p2", DEFAULT_AVATARS.p2, "Jugador 2");
  updateCharacterDisplay("p1", null);
  updateCharacterDisplay("p2", null);
}

function resetSelectionDisplays() {
  clearSelectedCharacters();
  updateStartMatchAvailability();
}

function setAiDifficulty(level) {
  if (!AI_DIFFICULTIES[level]) {
    aiDifficulty = "normal";
  } else {
    aiDifficulty = level;
  }
  highlightAiDifficulty();
}


function highlightAiDifficulty() {
  aiDifficultyButtons.forEach((button) => {
    const isActive = button.dataset.difficulty === aiDifficulty;
    if (isActive) {
      button.classList.add("active");
    } else {
      button.classList.remove("active");
    }
  });
}

function getAiSettings() {
  return AI_DIFFICULTIES[aiDifficulty] || AI_DIFFICULTIES.normal;
}

function cancelAiMessage() {
  if (aiMessageTimeout) {
    clearTimeout(aiMessageTimeout);
    aiMessageTimeout = null;
  }
}

function aiSpeak(type, delay = 600) {
  if (mode !== "ai" || !AI_CHAT[type] || AI_CHAT[type].length === 0) {
    return;
  }
  cancelAiMessage();
  aiMessageTimeout = setTimeout(() => {
    if (mode !== "ai") {
      return;
    }
    const pool = AI_CHAT[type];
    const message = pool[Math.floor(Math.random() * pool.length)];
    if (message) {
      logChat("IA", message);
    }
  }, delay);
}

function resetTournament() {
  tournamentState.active = false;
  tournamentState.roundIndex = 0;
  tournamentState.results = [];
  if (tournamentPanel) {
    tournamentPanel.classList.add("hidden");
  }
  if (tournamentBracketList) {
    tournamentBracketList.innerHTML = "";
  }
  if (tournamentTrophy) {
    tournamentTrophy.classList.add("hidden");
  }
}

function updateModeLabel(text) {
  if (modeLabel) {
    modeLabel.textContent = text;
  }
}

function showMenuScreen({ resetSelections = false } = {}) {
  disconnectSocket();
  mode = "menu";
  pendingMode = null;
  clearInterval(timerInterval);
  timerInterval = null;
  resetMatch();
  resetPositions();
  aiController.jumpCooldown = 0;
  aiController.reactionTimer = 0;
  cancelAiMessage();
  if (resetSelections) {
    clearSelectedCharacters();
  }
  hideCharacterSelection();
  hideMatchEnd();
  if (goalBanner) {
    goalBanner.classList.remove("show");
  }
  if (menuScreen) {
    menuScreen.classList.remove("hidden");
  }
  if (menuAiOptions) {
    menuAiOptions.classList.add("hidden");
  }
  highlightAiDifficulty();
  resetTournament();

  updateModeLabel("Menu principal");
  updateStatus("Menu principal");
}

function hideMenuScreen() {
  if (menuScreen) {
    menuScreen.classList.add("hidden");
  }
}

function updateTournamentPanel() {
  if (!tournamentPanel || !tournamentBracketList) {
    return;
  }
  const hasResults = tournamentState.results.length > 0;
  if (!tournamentState.active && !hasResults) {
    tournamentPanel.classList.add("hidden");
    tournamentBracketList.innerHTML = "";
    if (tournamentTrophy) {
      tournamentTrophy.classList.add("hidden");
    }
    return;
  }
  tournamentPanel.classList.remove("hidden");
  tournamentBracketList.innerHTML = "";
  TOURNAMENT_ROUNDS.forEach((round, index) => {
    const item = document.createElement("li");
    let status = tournamentState.results[index];
    if (!status && tournamentState.active && index === tournamentState.roundIndex) {
      status = "active";
    }
    const difficultyLabel = AI_DIFFICULTIES[round.difficulty]?.label ?? "";
    item.textContent = `${round.label} - ${round.opponent} (${difficultyLabel})`;
    if (status === "active") {
      item.classList.add("active");
    }
    if (status === "won" || status === "lost") {
      item.classList.add("completed");
      item.textContent += status === "won" ? " OK" : " KO";
    }
    tournamentBracketList.appendChild(item);
  });
  if (tournamentTrophy) {
    const hasChampion =
      tournamentState.results.length === TOURNAMENT_ROUNDS.length &&
      tournamentState.results.every((result) => result === "won");
    if (hasChampion) {
      tournamentTrophy.classList.remove("hidden");
    } else {
      tournamentTrophy.classList.add("hidden");
    }
  }
}

function currentTournamentRound() {
  if (!tournamentState.active) {
    return null;
  }
  return TOURNAMENT_ROUNDS[tournamentState.roundIndex] ?? null;
}

function prepareTournament({ keepSelections = false } = {}) {
  pendingMode = "tournament";
  tournamentState.active = true;
  tournamentState.roundIndex = 0;
  tournamentState.results = TOURNAMENT_ROUNDS.map(() => "pending");
  cancelAiMessage();
  const firstRound = currentTournamentRound();
  if (firstRound) {
    setAiDifficulty(firstRound.difficulty);
  } else {
    setAiDifficulty("normal");
  }
  highlightAiDifficulty();
  hideMenuScreen();
  disconnectSocket();
  resetMatch();
  resetPositions();
  if (menuAiOptions) {
    menuAiOptions.classList.add("hidden");
  }
  updateTournamentPanel();
  updateModeLabel("Torneo");
  updateStatus("Selecciona tus personajes para el torneo");
  showCharacterSelection({ keepSelections });
}

function autoAssignTournamentCharacter(roundIndex) {
  if (!tournamentState.active) {
    return;
  }
  let index = normalizeIndex(roundIndex + 2);
  if (selectionState.p1 === index) {
    index = normalizeIndex(index + 3);
  }
  setCharacterForPlayer("p2", index);
}

function startTournamentRound() {
  pendingMode = "tournament";
  const round = currentTournamentRound();
  if (!round) {
    return;
  }
  setAiDifficulty(round.difficulty);
  highlightAiDifficulty();
  autoAssignTournamentCharacter(tournamentState.roundIndex);
  const difficultyLabel = AI_DIFFICULTIES[aiDifficulty]?.label ?? "";
  logChat("Narrador", `Ronda ${round.label}: ${round.opponent} (${difficultyLabel})`);
  tournamentState.results[tournamentState.roundIndex] = "active";
  updateTournamentPanel();
  enterAiMode({
    label: `Torneo - ${round.label}`,
    status: `${round.opponent} - Dificultad ${AI_DIFFICULTIES[aiDifficulty]?.label ?? ""}`,
  });
}

function concludeTournamentRound(playerWon) {
  const round = currentTournamentRound();
  if (!round) {
    return;
  }
  if (state.score.left === state.score.right) {
    updateStatus("Empate, se repite la ronda");
    scheduleTournamentContinuation(() => {
      hideMatchEnd();
      resetMatch();
      resetPositions();
      startTournamentRound();
    }, 2200);
    return;
  }
  tournamentState.results[tournamentState.roundIndex] = playerWon ? "won" : "lost";
  updateTournamentPanel();
  if (playerWon) {
    if (tournamentState.roundIndex >= TOURNAMENT_ROUNDS.length - 1) {
      handleTournamentVictory();
    } else {
      tournamentState.roundIndex += 1;
      updateTournamentPanel();
      scheduleTournamentContinuation(() => {
        hideMatchEnd();
        resetMatch();
        resetPositions();
        startTournamentRound();
      }, 2400);
    }
  } else {
    handleTournamentDefeat();
  }
}

function handleTournamentVictory() {
  tournamentState.active = false;
  pendingMode = null;
  updateTournamentPanel();
  updateStatus("Campeon del torneo");
  aiSpeak("defeat", 1200);
  scheduleTournamentContinuation(() => {
    hideMatchEnd();
    showMenuScreen({ resetSelections: false });
  }, 4200);
}

function handleTournamentDefeat() {
  tournamentState.active = false;
  pendingMode = null;
  updateTournamentPanel();
  aiSpeak("champion", 1200);
  updateStatus("Derrota en el torneo");
  scheduleTournamentContinuation(() => {
    hideMatchEnd();
    showMenuScreen({ resetSelections: false });
  }, 3600);
}

function scheduleTournamentContinuation(callback, delay = 2200) {
  setTimeout(() => {
    callback();
  }, delay);
}

function queueJump(playerKey) {
  const control = playerControl[playerKey];
  if (!control) {
    return;
  }
  control.bufferedJump = JUMP_BUFFER_TIME;
}

function toggleFullscreen() {
  if (!canvasWrapper) {
    return;
  }
  if (!document.fullscreenElement) {
    if (canvasWrapper.requestFullscreen) {
      canvasWrapper.requestFullscreen();
    }
  } else if (document.exitFullscreen) {
    document.exitFullscreen();
  }
}

function updateFullscreenButton() {
  if (!fullscreenToggle) {
    return;
  }
  const isActive = Boolean(document.fullscreenElement);
  fullscreenToggle.textContent = isActive ? "Salir" : "Full";
}

function showCharacterSelection({ keepSelections = true } = {}) {
  if (!characterSelectionOverlay) {
    return;
  }
  if (!keepSelections) {
    clearSelectedCharacters();
  }
  if (!keepSelections) {
    ["p1", "p2"].forEach((player) => {
      const defaultIndex = normalizeIndex(defaultSelectionIndices[player] ?? 0);
      setCharacterForPlayer(player, defaultIndex);
    });
  } else {
    ["p1", "p2"].forEach((player) => {
      const current = selectedCharacters[player];
      if (current) {
        const idx = characters.findIndex((option) => option.id === current.id);
        const index = idx >= 0 ? idx : normalizeIndex(defaultSelectionIndices[player] ?? 0);
        setCharacterForPlayer(player, index);
      } else {
        const defaultIndex = normalizeIndex(defaultSelectionIndices[player] ?? 0);
        setCharacterForPlayer(player, defaultIndex);
      }
    });
  }
  updateStartMatchAvailability();
  characterSelectionOverlay.classList.remove("hidden");
}

function hideCharacterSelection() {
  if (characterSelectionOverlay) {
    characterSelectionOverlay.classList.add("hidden");
  }
}

function startConfiguredMatch() {
  if (!selectedCharacters.p1 || !selectedCharacters.p2) {
    return;
  }
  hideCharacterSelection();
  const targetMode = pendingMode || "local";
  if (targetMode === "tournament") {
    startTournamentRound();
  } else if (targetMode === "ai") {
    enterAiMode();
  } else {
    pendingMode = "local";
    enterLocalMode();
  }
}

function prepareLocalMatch({ keepSelections = true } = {}) {
  pendingMode = "local";
  hideMenuScreen();
  disconnectSocket();
  resetMatch();
  resetPositions();
  if (menuAiOptions) {
    menuAiOptions.classList.add("hidden");
  }
  updateModeLabel("Local 2P");
  updateStatus("Selecciona tus personajes");
  showCharacterSelection({ keepSelections });
}

function prepareAiMatch({ keepSelections = false } = {}) {
  pendingMode = "ai";
  hideMenuScreen();
  disconnectSocket();
  resetMatch();
  resetPositions();
  cancelAiMessage();
  const difficultyLabel = AI_DIFFICULTIES[aiDifficulty]?.label ?? "Normal";
  updateModeLabel(`Vs IA (${difficultyLabel})`);
  updateStatus(`Selecciona tus personajes - Dificultad ${difficultyLabel}`);
  if (menuAiOptions) {
    menuAiOptions.classList.add("hidden");
  }
  showCharacterSelection({ keepSelections });
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
  if (mode === "ai") {
    aiController.jumpCooldown = Math.max(0, aiController.jumpCooldown - delta);
    aiController.reactionTimer = Math.max(0, aiController.reactionTimer - delta);
  }

  Object.entries(state.players).forEach(([key, player]) => {
    const control = playerControl[key];
    if (control) {
      control.bufferedJump = Math.max(0, control.bufferedJump - delta);
      control.coyoteTime = Math.max(0, control.coyoteTime - delta);
    }

    if (mode === "local") {
      applyLocalInput(key, player, control);
    } else if (mode === "ai") {
      if (key === "p1") {
        applyLocalInput(key, player, control);
      } else if (key === "p2") {
        applyAiControl(player, control, delta);
      }
    } else {
      player.vx = 0;
    }

    const gravityMultiplier =
      mode === "ai" && key === "p2" ? (getAiSettings().gravityMultiplier ?? 1) : 1;
    player.x += player.vx * delta;
    player.y += player.vy * delta;
    player.vy += GRAVITY * gravityMultiplier * delta;

    if (player.y > FLOOR_Y) {
      player.y = FLOOR_Y;
      player.vy = 0;
      if (control) {
        control.coyoteTime = COYOTE_TIME;
      }
    }

    const inset = PLAYER_WIDTH / 2 + 12;
    player.x = clamp(player.x, inset, canvas.width - inset);
    updateFacingFromVelocity(player);
    updatePlayerFoot(key, player, delta);
    handleFootBallCollision(player);
  });

  state.ball.x += state.ball.vx * delta;
  state.ball.y += state.ball.vy * delta;
  state.ball.vy += GRAVITY * delta;
  state.ball.rotation += state.ball.spin * delta;
  if (state.ball.rotation > Math.PI * 2 || state.ball.rotation < -Math.PI * 2) {
    state.ball.rotation %= Math.PI * 2;
  }
  state.ball.spin *= BALL_SPIN_DAMPING;
  state.ball.spin = clamp(state.ball.spin, -12, 12);

  const floorContact = FLOOR_Y - BALL_RADIUS;
  if (state.ball.y > floorContact) {
    state.ball.y = floorContact;
    state.ball.vy *= -BALL_DAMPING;
    state.ball.vx *= 0.96;
    if (Math.abs(state.ball.vy) < 8) {
      state.ball.vy = 0;
    }
    state.ball.spin *= 0.9;
    state.ball.spin += state.ball.vx * 0.0006;
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
  Object.values(state.players).forEach((player) => {
    handleFootBallCollision(player);
  });
  const collisionOrder = [state.players.p1, state.players.p2]
    .map((player) => ({
      player,
      distanceSq: playerBallDistanceSq(player),
    }))
    .sort((a, b) => {
      if (a.distanceSq === b.distanceSq) {
        const impactA = playerBallImpactMagnitude(a.player);
        const impactB = playerBallImpactMagnitude(b.player);
        if (impactA === impactB) {
          return 0;
        }
        return impactB - impactA;
      }
      return a.distanceSq - b.distanceSq;
    });
  collisionOrder.forEach(({ player }) => {
    handleBallPlayerCollision(player);
  });
  const wallLeft = BALL_RADIUS;
  const wallRight = canvas.width - BALL_RADIUS;
  if (state.ball.x < wallLeft) {
    state.ball.x = wallLeft;
    state.ball.vx = Math.abs(state.ball.vx) * WALL_DAMPING;
    state.ball.spin *= 0.9;
  }
  if (state.ball.x > wallRight) {
    state.ball.x = wallRight;
    state.ball.vx = -Math.abs(state.ball.vx) * WALL_DAMPING;
    state.ball.spin *= 0.9;
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

function applyLocalInput(playerKey, player, control) {
  player.vx = 0;
  const leftKey = playerKey === "p1" ? "KeyA" : "ArrowLeft";
  const rightKey = playerKey === "p1" ? "KeyD" : "ArrowRight";
  if (state.pressed[leftKey]) {
    player.vx = -PLAYER_SPEED;
    player.facing = -1;
  }
  if (state.pressed[rightKey]) {
    player.vx = PLAYER_SPEED;
    player.facing = 1;
  }
  if (control && control.bufferedJump > 0 && control.coyoteTime > 0) {
    player.vy = JUMP_VELOCITY;
    control.bufferedJump = 0;
    control.coyoteTime = 0;
  }
}

function setFootRaise(playerKey, pressed) {
  const player = state.players[playerKey];
  if (!player || !player.foot) {
    return;
  }
  player.foot.raising = pressed;
}

function getFootPivot(player) {
  const facing = player.facing >= 0 ? 1 : -1;
  return {
    x: player.x + facing * FOOT_PIVOT_OFFSET_X,
    y: player.y - FOOT_PIVOT_OFFSET_Y,
    facing,
  };
}

function computeFootGeometry(player, angleOverride) {
  const pivot = getFootPivot(player);
  const angle = clamp(
    typeof angleOverride === "number" ? angleOverride : player.foot?.angle ?? FOOT_MIN_ANGLE,
    FOOT_MIN_ANGLE,
    FOOT_MAX_ANGLE,
  );
  const sinA = Math.sin(angle);
  const cosA = Math.cos(angle);
  const x = pivot.x + pivot.facing * sinA * FOOT_SWING_RADIUS;
  const y = pivot.y + cosA * FOOT_SWING_RADIUS;
  return {
    x,
    y,
    angle,
    sin: sinA,
    cos: cosA,
    pivotX: pivot.x,
    pivotY: pivot.y,
    facing: pivot.facing,
  };
}

function updatePlayerFoot(playerKey, player, delta) {
  const foot = player.foot;
  if (!foot) {
    return;
  }
  const previousAngle = foot.angle;
  const previousGeometry =
    foot.worldX !== null && foot.worldY !== null
      ? { x: foot.worldX, y: foot.worldY }
      : computeFootGeometry(player, previousAngle);
  const speed = foot.raising ? FOOT_RAISE_SPEED : FOOT_LOWER_SPEED;
  const target = foot.raising ? FOOT_MAX_ANGLE : FOOT_MIN_ANGLE;
  const direction = foot.raising ? 1 : -1;
  foot.angle = clamp(previousAngle + direction * speed * delta, FOOT_MIN_ANGLE, FOOT_MAX_ANGLE);
  if ((foot.raising && foot.angle >= target) || (!foot.raising && foot.angle <= target)) {
    foot.angle = target;
  }
  const geometry = computeFootGeometry(player, foot.angle);
  foot.worldX = geometry.x;
  foot.worldY = geometry.y;

  if (delta > 0) {
    const deltaX = geometry.x - previousGeometry.x;
    const deltaY = geometry.y - previousGeometry.y;
    foot.velocityX = Number.isFinite(deltaX / delta) ? deltaX / delta : 0;
    foot.velocityY = Number.isFinite(deltaY / delta) ? deltaY / delta : 0;
    foot.velocity = foot.velocityY;
    if (!Number.isFinite(foot.velocity)) {
      foot.velocity = 0;
    }
  } else {
    foot.velocityX = 0;
    foot.velocityY = 0;
    foot.velocity = 0;
  }
  foot.hitCooldown = Math.max(0, (foot.hitCooldown || 0) - delta);
  if (!foot.raising && foot.angle <= FOOT_MIN_ANGLE + 0.001) {
    foot.angle = FOOT_MIN_ANGLE;
    foot.velocity = Math.min(foot.velocity, 0);
    foot.velocityX = 0;
    foot.velocityY = 0;
  }
}

function getFootWorldPosition(player) {
  if (!player?.foot) {
    return null;
  }
  return computeFootGeometry(player);
}

function handleFootBallCollision(player) {
  const foot = player.foot;
  if (!foot) {
    return;
  }
  const position = getFootWorldPosition(player);
  if (!position) {
    return;
  }
  const dx = state.ball.x - position.x;
  const dy = state.ball.y - position.y;
  const combined = FOOT_RADIUS + BALL_RADIUS;
  const distance = Math.hypot(dx, dy) || 0;
  if (distance >= combined) {
    return;
  }

  const nx = dx / (distance || 1);
  const ny = dy / (distance || 1);
  const overlap = combined - distance;
  state.ball.x += nx * overlap;
  state.ball.y += ny * overlap;

  const footVx = Number.isFinite(foot.velocityX) ? foot.velocityX : player.vx;
  const footVy = Number.isFinite(foot.velocityY) ? foot.velocityY : foot.velocity || 0;
  const relativeVx = state.ball.vx - footVx;
  const relativeVy = state.ball.vy - footVy;
  const impact = relativeVx * nx + relativeVy * ny;

  if (impact < 0) {
    const restitution = foot.raising ? 0.92 : 0.78;
    state.ball.vx -= (1 + restitution) * impact * nx;
    state.ball.vy -= (1 + restitution) * impact * ny;
    state.ball.spin += player.facing * -impact * 0.0018;
    if (foot.raising) {
      state.ball.vy -= Math.abs(impact) * 0.04;
    }
  }

  if (foot.velocity < -FOOT_KICK_THRESHOLD && foot.hitCooldown <= 0) {
    const strength = Math.min(
      Math.abs(foot.velocity) + Math.abs(Number.isFinite(foot.velocityX) ? foot.velocityX : player.vx) * 0.45,
      FOOT_MAX_KICK_SPEED,
    );
    const impulse = strength * FOOT_IMPULSE * 0.01;
    const verticalImpulse = Math.abs(impulse) * FOOT_VERTICAL_RATIO;
    const liftBoost = Math.max(0, -foot.velocity) * FOOT_UPWARD_LIFT;
    state.ball.vx += player.facing * impulse;
    state.ball.vy -= verticalImpulse + liftBoost;
    state.ball.spin += player.facing * impulse * 0.28;
    foot.hitCooldown = 0.2;
  } else {
    foot.hitCooldown = Math.max(foot.hitCooldown, 0.04);
  }
  const minExitSpeed = 60 + Math.abs(footVy) * 0.15;
  const exitRelativeVx = state.ball.vx - footVx;
  const exitRelativeVy = state.ball.vy - footVy;
  const exitSpeed = exitRelativeVx * nx + exitRelativeVy * ny;
  if (exitSpeed < minExitSpeed) {
    const boost = minExitSpeed - exitSpeed;
    state.ball.vx += nx * boost;
    state.ball.vy += ny * boost;
  }
}

function resetPlayerFoot(player) {
  if (player?.foot) {
    player.foot.angle = FOOT_MIN_ANGLE;
    player.foot.velocity = 0;
    player.foot.velocityX = 0;
    player.foot.velocityY = 0;
    player.foot.raising = false;
    player.foot.hitCooldown = 0;
    player.foot.worldX = null;
    player.foot.worldY = null;
  }
}

function ensureFootState(playerKey) {
  const player = state.players[playerKey];
  if (!player) {
    return;
  }
  if (!player.foot) {
    player.foot = createFootState();
  } else {
    player.foot.angle = clamp(player.foot.angle ?? FOOT_MIN_ANGLE, FOOT_MIN_ANGLE, FOOT_MAX_ANGLE);
    player.foot.raising = Boolean(player.foot.raising);
    player.foot.velocity = player.foot.velocity ?? 0;
    player.foot.velocityX = player.foot.velocityX ?? 0;
    player.foot.velocityY = player.foot.velocityY ?? 0;
    player.foot.hitCooldown = player.foot.hitCooldown ?? 0;
    player.foot.worldX = player.foot.worldX ?? null;
    player.foot.worldY = player.foot.worldY ?? null;
  }
}

function applyAiControl(player, control, delta) {
  const settings = getAiSettings();
  const inset = PLAYER_WIDTH / 2 + 12;
  if (aiController.reactionTimer <= 0) {
    const predictiveOffset = state.ball.vx * settings.predictFactor;
    const halfWidth = canvas.width * 0.5;
    const ballTarget = clamp(state.ball.x + predictiveOffset, inset, canvas.width - inset);
    let targetX = ballTarget;
    const ballTowardGoal = state.ball.vx > 14;
    const dangerZone = state.ball.x > canvas.width * 0.58;
    const ballBehind = state.ball.x > player.x + 18;
    if (dangerZone || ballTowardGoal) {
      targetX = Math.max(targetX, canvas.width - 190);
      targetX = Math.min(targetX, canvas.width - 90);
    }
    if (ballBehind) {
      targetX = Math.max(targetX, state.ball.x - 24);
    }
    if (state.ball.x < halfWidth * 0.9 && !ballTowardGoal) {
      targetX = Math.max(targetX, canvas.width - 260);
    }
    targetX = clamp(targetX, canvas.width * 0.46, canvas.width - inset);
    const chaseFactor = clamp(
      typeof settings.ballChaseFactor === "number" ? settings.ballChaseFactor : 0.5,
      0,
      1,
    );
    targetX = targetX * (1 - chaseFactor) + ballTarget * chaseFactor;
    const defenseBias = clamp(typeof settings.defenseBias === "number" ? settings.defenseBias : 0, 0, 1);
    const guardZone = Math.max(40, settings.goalGuardZone ?? 70);
    const holdDistance = Math.max(24, settings.goalHoldDistance ?? 40);
    const homeLine = canvas.width - GOAL_LINE_OFFSET;
    if (player === state.players.p2) {
      if (state.ball.x > canvas.width * 0.58) {
        const guardTarget = Math.max(homeLine - guardZone, state.ball.x + holdDistance);
        targetX = targetX * (1 - defenseBias) + guardTarget * defenseBias;
      }
      if (state.ball.x < player.x - 12) {
        const recovery = clamp(homeLine - guardZone * 0.5, canvas.width * 0.52, canvas.width - inset);
        targetX = targetX * 0.35 + recovery * 0.65;
      }
      const safetyLine = homeLine - 6;
      const aheadClamp = Math.max(state.ball.x + 18, homeLine - guardZone);
      targetX = Math.max(targetX, aheadClamp);
      if (state.ball.x > homeLine - 18 && state.ball.vx >= 0) {
        targetX = Math.max(targetX, state.ball.x + holdDistance * 0.6);
      }
      targetX = Math.min(targetX, safetyLine);
    }
    const smoothing = clamp(
      typeof settings.targetSmoothing === "number" ? settings.targetSmoothing : 0.5,
      0,
      0.95,
    );
    if (Number.isFinite(aiController.targetX)) {
      aiController.targetX = aiController.targetX * smoothing + targetX * (1 - smoothing);
    } else {
      aiController.targetX = targetX;
    }
    aiController.reactionTimer = settings.reaction;
  }
  const dx = aiController.targetX - player.x;
  const maxSpeed = PLAYER_SPEED * settings.speedMultiplier;
  const desiredVx = clamp(dx * settings.steering * PLAYER_SPEED, -maxSpeed, maxSpeed);
  const acceleration = settings.acceleration * delta;
  const velocityDelta = clamp(desiredVx - player.vx, -acceleration, acceleration);
  player.vx += velocityDelta;
  if (Math.abs(dx) < settings.moveThreshold && Math.abs(player.vx) < maxSpeed * 0.45) {
    player.vx *= settings.brake;
  }

  const onGround = player.y >= FLOOR_Y;
  const horizontalDistance = Math.abs(state.ball.x - player.x);
  const ballDescending = state.ball.vy > 60;
  const ballRising = state.ball.vy < -80;
  const ballAhead = state.ball.x > canvas.width / 2;
  const canJump = onGround && aiController.jumpCooldown <= 0;
  const aggressionReach = settings.aerialReach;
  const dangerZoneNow = state.ball.x > canvas.width * 0.58;
  const ballTowardGoalNow = state.ball.vx > 14;
  const defendHigh = dangerZoneNow && state.ball.y < player.y - 40;
  const blockLowShot =
    dangerZoneNow &&
    ballTowardGoalNow &&
    horizontalDistance < aggressionReach * 0.9 &&
    state.ball.y > player.y - 40 &&
    state.ball.y < player.y + 12;
  if (player.foot) {
    const ballAheadForKick = state.ball.x >= player.x - 6;
    const readyKick =
      dangerZoneNow &&
      ballAheadForKick &&
      horizontalDistance < aggressionReach * 0.92 &&
      state.ball.y < player.y + 12;
    player.foot.raising = readyKick;
    if (!ballAheadForKick) {
      player.foot.raising = false;
    }
  }
  const shouldJump =
    canJump &&
    ((horizontalDistance < aggressionReach && ballDescending && ballAhead) ||
      (horizontalDistance < aggressionReach * settings.jumpAggression && ballRising && state.ball.vx < 0) ||
      (horizontalDistance < aggressionReach * 0.8 && state.ball.y < player.y - 95) ||
      defendHigh ||
      blockLowShot);
  if (shouldJump) {
    player.vy = JUMP_VELOCITY * Math.min(settings.jumpAggression, 1.8);
    aiController.jumpCooldown = settings.jumpCooldown;
    if (control) {
      control.coyoteTime = 0;
      control.bufferedJump = 0;
    }
  }
}

/** Dibuja todos los elementos del juego en el canvas. */
function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawArena();
  drawBallSprite();
  drawPlayerFoot(state.players.p1);
  drawPlayerFoot(state.players.p2);
  drawPlayerSprite(state.players.p1, sprites.player1);
  drawPlayerSprite(state.players.p2, sprites.player2);
}

/** Vincula los eventos de la interfaz y del teclado. */
function setupUI() {
  if (openMainMenuButton) {
    openMainMenuButton.addEventListener("click", () => {
      showMenuScreen({ resetSelections: true });
    });
  }
  if (menuStartLocalButton) {
    menuStartLocalButton.addEventListener("click", () => {
      prepareLocalMatch({ keepSelections: false });
    });
  }
  if (menuStartAiButton) {
    menuStartAiButton.addEventListener("click", () => {
      if (menuAiOptions) {
        menuAiOptions.classList.remove("hidden");
      }
      highlightAiDifficulty();
    });
  }
  aiDifficultyButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const level = button.dataset.difficulty || "normal";
      setAiDifficulty(level);
      prepareAiMatch({ keepSelections: false });
    });
  });
  if (menuStartTournamentButton) {
    menuStartTournamentButton.addEventListener("click", () => {
      prepareTournament({ keepSelections: false });
    });
  }
  if (fullscreenToggle) {
    fullscreenToggle.addEventListener("click", toggleFullscreen);
  }
  document.addEventListener("fullscreenchange", updateFullscreenButton);
  updateFullscreenButton();

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
      if (event.code === FOOT_KEYS.p1) {
        event.preventDefault();
        setFootRaise("p1", true);
      }
      if (event.code === FOOT_KEYS.p2) {
        event.preventDefault();
        setFootRaise("p2", true);
      }
      state.pressed[event.code] = true;
      if (!event.repeat) {
        if (event.code === jumpKeys.p1) {
          queueJump("p1");
        }
        if (event.code === jumpKeys.p2) {
          queueJump("p2");
        }
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
      if (event.code === FOOT_KEYS.p1) {
        event.preventDefault();
        setFootRaise("p1", false);
      }
      if (event.code === FOOT_KEYS.p2) {
        event.preventDefault();
        setFootRaise("p2", false);
      }
      state.pressed[event.code] = false;
    },
    { passive: false },
  );

  if (restartButton) {
    restartButton.addEventListener("click", () => {
      if (tournamentState.active) {
        hideMatchEnd();
        resetMatch();
        resetPositions();
        startTournamentRound();
      } else if (mode === "ai") {
        prepareAiMatch({ keepSelections: true });
      } else {
        prepareLocalMatch({ keepSelections: true });
      }
    });
  }
  highlightAiDifficulty();
}

/** Cambia al modo local para dos jugadores. */
function enterLocalMode() {
  mode = "local";
  disconnectSocket();
  hideMenuScreen();
  resetMatch();
  resetPositions();
  playerControl.p1.bufferedJump = 0;
  playerControl.p1.coyoteTime = COYOTE_TIME;
  playerControl.p2.bufferedJump = 0;
  playerControl.p2.coyoteTime = COYOTE_TIME;
  aiController.jumpCooldown = 0;
  startTimer();
  updateModeLabel("Local 2P");
  updateStatus("Partida local en curso");
}

function enterAiMode({ label, status } = {}) {
  mode = "ai";
  disconnectSocket();
  hideMenuScreen();
  resetMatch();
  resetPositions();
  cancelAiMessage();
  playerControl.p1.bufferedJump = 0;
  playerControl.p1.coyoteTime = COYOTE_TIME;
  playerControl.p2.bufferedJump = 0;
  playerControl.p2.coyoteTime = COYOTE_TIME;
  aiController.jumpCooldown = 0;
  aiController.reactionTimer = 0;
  aiController.targetX = state.players.p2.x;
  startTimer();
  const difficultyLabel = AI_DIFFICULTIES[aiDifficulty]?.label ?? "Normal";
  updateModeLabel(label || `Vs IA (${difficultyLabel})`);
  updateStatus(status || `Partida contra IA (${difficultyLabel})`);
  aiSpeak("start", 800);
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
  timerInterval = null;
  Object.values(state.players).forEach((player) => resetPlayerFoot(player));
  state.ball.rotation = 0;
  state.ball.spin = 0;
  hideMatchEnd();
}

/** Actualiza la etiqueta de estado en la interfaz. */
function updateStatus(text) {
  if (connectionStatusLabel) {
    connectionStatusLabel.textContent = text;
  }
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
        ensureFootState("p1");
        ensureFootState("p2");
        resetPlayerFoot(state.players.p1);
        resetPlayerFoot(state.players.p2);
        state.ball.rotation = state.ball.rotation || 0;
        state.ball.spin = state.ball.spin || 0;
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
  playerControl.p1.bufferedJump = 0;
  playerControl.p1.coyoteTime = COYOTE_TIME;
  playerControl.p2.bufferedJump = 0;
  playerControl.p2.coyoteTime = COYOTE_TIME;
  resetPlayerFoot(state.players.p1);
  resetPlayerFoot(state.players.p2);
  aiController.targetX = state.players.p2.x;
  aiController.reactionTimer = 0;
  state.ball.x = canvas.width / 2;
  state.ball.y = FLOOR_Y - BALL_RADIUS;
  state.ball.vx = 0;
  state.ball.vy = 0;
  state.ball.rotation = 0;
  state.ball.spin = 0;
}

setupUI();
initializeCharacterSelection();
showMenuScreen({ resetSelections: true });
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

function drawBallSprite() {
  ctx.save();
  ctx.translate(state.ball.x, state.ball.y);
  ctx.rotate(state.ball.rotation);
  ctx.drawImage(
    sprites.ball,
    -BALL_RADIUS,
    -BALL_RADIUS,
    BALL_RADIUS * 2,
    BALL_RADIUS * 2,
  );
  ctx.restore();
}

function drawPlayerFoot(player) {
  if (!player?.foot) {
    return;
  }
  const sprite = sprites.foot;
  if (!sprite) {
    return;
  }
  const geometry = getFootWorldPosition(player);
  if (!geometry) {
    return;
  }
  const { x, y, pivotX, pivotY } = geometry;
  const width = 40;
  const height = 26;
  let rotation = Math.atan2(y - pivotY, x - pivotX);
  if (!Number.isFinite(rotation)) {
    rotation = 0;
  }
  ctx.save();
  ctx.translate(x, y);
  const facing = player.facing >= 0 ? 1 : -1;
  const drawRotation = facing > 0 ? Math.PI - rotation : rotation;
  ctx.rotate(drawRotation);
  ctx.scale(-1, 1);
  ctx.drawImage(sprite, -width / 2, -height / 2, width, height);
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

function playerBallDistanceSq(player) {
  const centerX = player.x;
  const centerY = player.y - PLAYER_HEIGHT / 2;
  const dx = state.ball.x - centerX;
  const dy = state.ball.y - centerY;
  return dx * dx + dy * dy;
}

function playerBallImpactMagnitude(player) {
  const centerX = player.x;
  const centerY = player.y - PLAYER_HEIGHT / 2;
  const dx = state.ball.x - centerX;
  const dy = state.ball.y - centerY;
  const distance = Math.hypot(dx, dy) || 1;
  const nx = dx / distance;
  const ny = dy / distance;
  const relativeVx = state.ball.vx - player.vx;
  const relativeVy = state.ball.vy - player.vy;
  return Math.abs(relativeVx * nx + relativeVy * ny);
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

  let nx = dx / distance;
  let ny = dy / distance;
  if (state.ball.y >= centerY) {
    ny = -Math.abs(ny) || -1;
  }
  const normalLength = Math.hypot(nx, ny) || 1;
  nx /= normalLength;
  ny /= normalLength;
  const overlap = minDistance - distance;
  state.ball.x += nx * overlap;
  state.ball.y += ny * overlap;
  if (ny >= -0.05) {
    state.ball.y = Math.min(state.ball.y, centerY - BALL_RADIUS * 0.4);
  }

  const relativeVx = state.ball.vx - player.vx;
  const relativeVy = state.ball.vy - player.vy;
  const impact = relativeVx * nx + relativeVy * ny;
  if (impact < 0) {
    const restitution = 0.92;
    state.ball.vx -= (1 + restitution) * impact * nx;
    state.ball.vy -= (1 + restitution) * impact * ny;
    state.ball.spin += player.facing * -impact * 0.002;
  }
  const minExitSpeed = 70 + Math.abs(player.vx) * 0.35;
  const exitRelativeVx = state.ball.vx - player.vx;
  const exitRelativeVy = state.ball.vy - player.vy;
  const exitSpeed = exitRelativeVx * nx + exitRelativeVy * ny;
  if (exitSpeed < minExitSpeed) {
    const boost = minExitSpeed - exitSpeed;
    state.ball.vx += nx * boost;
    state.ball.vy += ny * boost;
  }
  if (state.ball.vy > -120) {
    state.ball.vy = -120;
  }
  if (mode === "ai" && player === state.players.p2) {
    const slam = getAiSettings().slamImpulse;
    state.ball.vx += nx * slam * 0.045;
    state.ball.vy += ny * slam * 0.055;
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
  if (mode === "ai") {
    if (side === "right") {
      aiSpeak("score", 400);
    } else {
      aiSpeak("concede", 400);
    }
  }
  showGoalBanner();
  state.ball.rotation = 0;
  state.ball.spin = 0;
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
    if (typeof ball.spin === "number") {
      ball.spin += -relativeVelocity * 0.001;
    }
  } else {
    ball.vx += nx * overlap * 20;
    ball.vy += ny * overlap * 20;
    if (typeof ball.spin === "number") {
      ball.spin *= 0.95;
    }
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
  if (tournamentState.active) {
    const playerWon = state.score.left > state.score.right;
    concludeTournamentRound(playerWon);
  } else if (mode === "ai") {
    if (state.score.right > state.score.left) {
      aiSpeak("matchWin", 1600);
    } else if (state.score.left > state.score.right) {
      aiSpeak("matchLose", 1600);
    }
  }
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

