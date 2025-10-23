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
const FOOT_RAISE_SPEED = 10.0;
const FOOT_LOWER_SPEED = 13.8;
const FOOT_RADIUS = 18;
const FOOT_KICK_THRESHOLD = 45;
const FOOT_MAX_KICK_SPEED = 520;
const FOOT_IMPULSE = 4.8;
const FOOT_VERTICAL_RATIO = 0.74;
const FOOT_UPWARD_LIFT = 0.18;
const BALL_SPIN_DAMPING = 0.985;
const FOOT_PIVOT_OFFSET_X = PLAYER_WIDTH / 2 - 16;
const FOOT_PIVOT_OFFSET_Y = 38;
const COLAPINTO_ID = "Colapinto";
const COLAPINTO_SPEED_MULTIPLIER = 3.5;
const COLAPINTO_POWER_DURATION = 5;
const COLAPINTO_POWER_COOLDOWN = 15;
const CUERVO_ID = "Cuervo";
const CUERVO_SPEED_MULTIPLIER = 5;
const CUERVO_SCALE = 0.5;
const CUERVO_POWER_DURATION = 5;
const CUERVO_POWER_COOLDOWN = 15;
const FANTASMA_ID = "Fantasma";
const FANTASMA_SMOKE_DURATION = 2;
const FANTASMA_POWER_COOLDOWN = 14;
const POWER_KEYS = {
  p1: "Digit1",
  p2: "Digit7",
};
const CHARACTER_POWER_CONFIG = {
  [COLAPINTO_ID]: {
    cooldownKey: "speedBoostCooldown",
    timerKey: "speedBoostTimer",
    cooldownDuration: COLAPINTO_POWER_COOLDOWN,
  },
  [CUERVO_ID]: {
    cooldownKey: "sizeBoostCooldown",
    timerKey: "sizeBoostTimer",
    cooldownDuration: CUERVO_POWER_COOLDOWN,
  },
  [FANTASMA_ID]: {
    cooldownKey: "smokeCooldown",
    timerKey: "smokeActiveTimer",
    cooldownDuration: FANTASMA_POWER_COOLDOWN,
  },
};

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
const powerMeters = {
  p1: document.querySelector(".power-meter[data-player='p1']"),
  p2: document.querySelector(".power-meter[data-player='p2']"),
};
const powerMeterIcons = {
  p1: document.getElementById("power-icon-left"),
  p2: document.getElementById("power-icon-right"),
};

function setMatchEndHeading(text) {
  if (!matchEndOverlay) {
    return;
  }
  const heading = matchEndOverlay.querySelector("h3");
  if (heading && typeof text === "string") {
    heading.textContent = text;
  }
}
const characterSelectionOverlay = document.getElementById("character-selection");
const startMatchButton = document.getElementById("start-match-button");
const characterDisplays = {
  p1: document.getElementById("character-display-p1"),
  p2: document.getElementById("character-display-p2"),
};
const characterNavButtons = Array.from(document.querySelectorAll(".character-nav"));
const playerSelectionContainers = characterSelectionOverlay
  ? {
      p1: characterSelectionOverlay.querySelector(".player-selection[data-player='p1']"),
      p2: characterSelectionOverlay.querySelector(".player-selection[data-player='p2']"),
    }
  : { p1: null, p2: null };
const selectionTitleElement = characterSelectionOverlay
  ? characterSelectionOverlay.querySelector("h2")
  : null;
const selectionHintElement = characterSelectionOverlay
  ? characterSelectionOverlay.querySelector(".selection-hint")
  : null;
const defaultSelectionTitle = selectionTitleElement?.textContent ?? "";
const defaultSelectionHint = selectionHintElement?.textContent ?? "";
const defaultStartMatchLabel = startMatchButton?.textContent ?? "";
const defaultPlayerSelectionDisplay = {
  p1: playerSelectionContainers.p1?.style.display || "",
  p2: playerSelectionContainers.p2?.style.display || "",
};
const defaultPlayerSelectionMargin = {
  p1: playerSelectionContainers.p1?.style.margin || "",
  p2: playerSelectionContainers.p2?.style.margin || "",
};
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
  p1: "img/personajes/placeholder_player1.png",
  p2: "img/personajes/placeholder_player2.png",
};
const DEFAULT_AVATARS = {
  p1: "/static/img/personajes/placeholder_player1.png",
  p2: "/static/img/personajes/placeholder_player2.png",
};
const POWER_ICON_DEFAULTS = {
  p1: {
    src: DEFAULT_AVATARS.p1,
    alt: "Poder jugador 1",
  },
  p2: {
    src: DEFAULT_AVATARS.p2,
    alt: "Poder jugador 2",
  },
};
const FOOT_SPRITE_PATH = "img/botin.png";
const CHARACTERS_DATA_URL = "/static/data/characters.json";
let characters = [];
let charactersLoadPromise = null;
let characterMap = new Map();
let tournamentFillerCounter = 0;
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
    jumpCooldown: 0.6,
    jumpAggression: 1.0,
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
const TOURNAMENT_STRUCTURE = [
  { label: "Octavos", matchCount: 8, difficulty: "easy" },
  { label: "Cuartos", matchCount: 4, difficulty: "normal" },
  { label: "Semifinales", matchCount: 2, difficulty: "normal" },
  { label: "Final", matchCount: 1, difficulty: "god" },
];
const TOURNAMENT_PLAYER_COUNT = TOURNAMENT_STRUCTURE[0].matchCount * 2;
const BRACKET_PLACEHOLDER_IMAGE = "img/personajes/placeholder_character_08.png";
const TOURNAMENT_FILLER_NAMES = [
  "CPU Alpha",
  "CPU Beta",
  "CPU Gamma",
  "CPU Delta",
  "CPU Sigma",
  "CPU Omega",
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
  bracket: null,
  playerPath: [],
  playerCharacterId: null,
  eliminated: false,
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
  powers: {
    p1: {
      speedBoostTimer: 0,
      speedBoostCooldown: 0,
      sizeBoostTimer: 0,
      sizeBoostCooldown: 0,
      smokeCooldown: 0,
      smokeActiveTimer: 0,
      smokeAffectedTimer: 0,
    },
    p2: {
      speedBoostTimer: 0,
      speedBoostCooldown: 0,
      sizeBoostTimer: 0,
      sizeBoostCooldown: 0,
      smokeCooldown: 0,
      smokeActiveTimer: 0,
      smokeAffectedTimer: 0,
    },
  },
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

function getFallbackCharacters() {
  return [
    {
      id: CUERVO_ID,
      name: "Cuervo",
      sprite: "img/personajes/cuervo1.png",
      portrait: "img/personajes/cuervo1.png",
      powerIcon: "img/poderes/cuervo_power.png",
      tagline: "No gana nada desde que nacio.",
    },
    {
      id: COLAPINTO_ID,
      name: "Colapinto",
      sprite: "img/personajes/Colapinto.png",
      portrait: "img/personajes/Colapinto.png",
      powerIcon: "img/poderes/colapinto_power.png",
      tagline: "Lo sacan de la f1 el a?o que viene.",
    },
    {
      id: FANTASMA_ID,
      name: "Fantasma",
      sprite: "img/personajes/Fantasma.png",
      portrait: "img/personajes/Fantasma.png",
      powerIcon: "img/personajes/Fantasma.png",
      tagline: "Mas fantasma que el momo.",
    },
  ];
}

async function loadCharacters() {
  if (characters.length) {
    if (characterMap.size === 0) {
      characterMap = new Map();
      characters.forEach((entry) => {
        characterMap.set(entry.id, entry);
      });
    }
    return characters;
  }
  if (charactersLoadPromise) {
    return charactersLoadPromise;
  }
  charactersLoadPromise = fetch(CHARACTERS_DATA_URL, { cache: "no-store" })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`No se pudo cargar personajes: ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      if (!Array.isArray(data)) {
        throw new Error("Formato de personajes invalido.");
      }
      const normalized = data
        .filter((entry) => entry && typeof entry === "object")
        .map((entry) => {
          const id = typeof entry.id === "string" ? entry.id.trim() : "";
          const name =
            typeof entry.name === "string" && entry.name.trim().length > 0
              ? entry.name.trim()
              : id || "Personaje";
          const sprite =
            typeof entry.sprite === "string" && entry.sprite.trim().length > 0
              ? entry.sprite.trim()
              : "img/personajes/placeholder_character_01.png";
          const portrait =
            typeof entry.portrait === "string" && entry.portrait.trim().length > 0
              ? entry.portrait.trim()
              : sprite;
          const hasPowerIcon = typeof entry.powerIcon === "string" && entry.powerIcon.trim().length > 0;
          const tagline =
            typeof entry.tagline === "string" && entry.tagline.trim().length > 0
              ? entry.tagline.trim()
              : "Listo para la cancha.";
          const normalizedEntry = {
            ...entry,
            id,
            name,
            sprite,
            portrait,
            tagline,
          };
          if (hasPowerIcon) {
            normalizedEntry.powerIcon = entry.powerIcon.trim();
          } else {
            delete normalizedEntry.powerIcon;
          }
          return normalizedEntry;
        })
        .filter((entry) => entry.id && entry.name && entry.sprite);
      if (!normalized.length) {
        throw new Error("Lista de personajes vacia.");
      }
      characters = normalized;
      characterMap = new Map();
      normalized.forEach((entry) => {
        characterMap.set(entry.id, entry);
      });
      return characters;
    })
    .catch((error) => {
      console.error("Error al cargar personajes:", error);
      characters = getFallbackCharacters();
      characterMap = new Map();
      characters.forEach((entry) => {
        characterMap.set(entry.id, entry);
      });
      return characters;
    });
  return charactersLoadPromise;
}

function getCharacterDataById(id) {
  if (!id) {
    return null;
  }
  return characterMap.get(id) || null;
}

function ensureCharacterRegistered(character) {
  if (character && character.id && !characterMap.has(character.id)) {
    characterMap.set(character.id, character);
  }
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function createTournamentFillerCharacter() {
  const fillerIndex = tournamentFillerCounter + 1;
  tournamentFillerCounter += 1;
  const name =
    TOURNAMENT_FILLER_NAMES[(fillerIndex - 1) % TOURNAMENT_FILLER_NAMES.length] ||
    `CPU ${fillerIndex}`;
  const id = `cpu-${fillerIndex}`;
  const character = {
    id,
    name,
    sprite: BRACKET_PLACEHOLDER_IMAGE,
    portrait: BRACKET_PLACEHOLDER_IMAGE,
    tagline: "Listo para desafiarte.",
  };
  ensureCharacterRegistered(character);
  return character;
}

function cloneCharacterData(character) {
  if (!character) {
    return null;
  }
  return {
    id: character.id,
    name: character.name,
    sprite: character.sprite,
    portrait: character.portrait || character.sprite,
    powerIcon: character.powerIcon,
  };
}

function createBracketSlotFromCharacter(character, { isPlayer = false, source = null } = {}) {
  return {
    type: "character",
    character: cloneCharacterData(character),
    isPlayer,
    source,
  };
}

function createUpstreamSlot(roundIndex, matchIndex) {
  return {
    type: "upstream",
    source: { roundIndex, matchIndex },
  };
}

function createBracketMatch(roundIndex, matchIndex, slots, isPlayerMatch = false) {
  return {
    id: `r${roundIndex}m${matchIndex}`,
    roundIndex,
    matchIndex,
    slots,
    status: "pending",
    winner: null,
    isPlayerMatch,
    decidedBy: null,
  };
}

function buildTournamentParticipants(playerCharacter) {
  const pool = Array.from(characterMap.values()).filter(
    (character) => character.id !== playerCharacter.id,
  );
  shuffleArray(pool);
  const requiredOpponents = TOURNAMENT_PLAYER_COUNT - 1;
  const opponents = pool.slice(0, requiredOpponents).map(cloneCharacterData);
  while (opponents.length < requiredOpponents) {
    opponents.push(cloneCharacterData(createTournamentFillerCharacter()));
  }
  return [cloneCharacterData(playerCharacter), ...opponents];
}

function generateTournamentBracket(playerCharacter) {
  const participants = buildTournamentParticipants(playerCharacter);
  const rounds = [];
  const playerPath = [];
  const opponents = participants.slice(1);
  shuffleArray(opponents);
  TOURNAMENT_STRUCTURE.forEach((roundConfig, roundIndex) => {
    const matches = [];
    if (roundIndex === 0) {
      let cursor = 0;
      for (let matchIndex = 0; matchIndex < roundConfig.matchCount; matchIndex += 1) {
        let slots;
        const isPlayerMatch = matchIndex === 0;
        if (isPlayerMatch) {
          const opponent = opponents[cursor] ?? cloneCharacterData(createTournamentFillerCharacter());
          cursor += 1;
          slots = [
            createBracketSlotFromCharacter(participants[0], { isPlayer: true }),
            createBracketSlotFromCharacter(opponent),
          ];
          playerPath.push({ roundIndex, matchIndex });
        } else {
          const first = opponents[cursor] ?? cloneCharacterData(createTournamentFillerCharacter());
          cursor += 1;
          const second = opponents[cursor] ?? cloneCharacterData(createTournamentFillerCharacter());
          cursor += 1;
          slots = [
            createBracketSlotFromCharacter(first),
            createBracketSlotFromCharacter(second),
          ];
        }
        matches.push(createBracketMatch(roundIndex, matchIndex, slots, isPlayerMatch));
      }
    } else {
      const previousPlayerMatch = playerPath[roundIndex - 1];
      const playerMatchIndex = Math.floor(previousPlayerMatch.matchIndex / 2);
      for (let matchIndex = 0; matchIndex < roundConfig.matchCount; matchIndex += 1) {
        const slotA = createUpstreamSlot(roundIndex - 1, matchIndex * 2);
        const slotB = createUpstreamSlot(roundIndex - 1, matchIndex * 2 + 1);
        const isPlayerMatch = matchIndex === playerMatchIndex;
        if (isPlayerMatch) {
          playerPath.push({ roundIndex, matchIndex });
        }
        matches.push(createBracketMatch(roundIndex, matchIndex, [slotA, slotB], isPlayerMatch));
      }
    }
    rounds.push({
      label: roundConfig.label,
      difficulty: roundConfig.difficulty,
      matches,
    });
  });
  return {
    rounds,
    playerPath,
  };
}

function getTournamentRound(roundIndex) {
  return tournamentState.bracket?.rounds?.[roundIndex] ?? null;
}

function getTournamentMatch(roundIndex, matchIndex) {
  const round = getTournamentRound(roundIndex);
  return round?.matches?.[matchIndex] ?? null;
}

function getPlayerMatch(roundIndex) {
  const path = tournamentState.playerPath?.[roundIndex];
  if (!path) {
    return null;
  }
  return getTournamentMatch(path.roundIndex, path.matchIndex);
}

function propagateMatchWinner(roundIndex, matchIndex) {
  const currentMatch = getTournamentMatch(roundIndex, matchIndex);
  const nextRound = getTournamentRound(roundIndex + 1);
  if (!currentMatch || !currentMatch.winner || !nextRound) {
    return;
  }
  nextRound.matches.forEach((match) => {
    match.slots = match.slots.map((slot) => {
      if (
        slot.type === "upstream" &&
        slot.source.roundIndex === roundIndex &&
        slot.source.matchIndex === matchIndex
      ) {
        const replacement = createBracketSlotFromCharacter(currentMatch.winner.character, {
          isPlayer: currentMatch.winner.isPlayer,
          source: slot.source,
        });
        replacement.source = slot.source;
        return replacement;
      }
      return slot;
    });
  });
}

function propagateRoundWinners(roundIndex) {
  const round = getTournamentRound(roundIndex);
  if (!round) {
    return;
  }
  round.matches.forEach((match) => {
    if (match.winner) {
      propagateMatchWinner(roundIndex, match.matchIndex);
    }
  });
}

function simulateRemainingMatches(roundIndex, { excludePlayerMatch = true } = {}) {
  const round = getTournamentRound(roundIndex);
  if (!round) {
    return;
  }
  round.matches.forEach((match) => {
    if (match.status === "completed") {
      return;
    }
    if (excludePlayerMatch && match.isPlayerMatch) {
      return;
    }
    const eligibleSlots = match.slots.filter((slot) => slot.type === "character");
    if (eligibleSlots.length < 2) {
      return;
    }
    const winnerSlot = eligibleSlots[Math.random() < 0.5 ? 0 : 1];
    match.status = "completed";
    match.winner = {
      character: cloneCharacterData(winnerSlot.character),
      isPlayer: Boolean(winnerSlot.isPlayer),
      decidedBy: "auto",
    };
    match.decidedBy = "auto";
    propagateMatchWinner(roundIndex, match.matchIndex);
  });
}

function simulateTournamentRemainder(startRoundIndex) {
  if (!tournamentState.bracket) {
    return;
  }
  for (
    let roundIndex = startRoundIndex;
    roundIndex < TOURNAMENT_STRUCTURE.length;
    roundIndex += 1
  ) {
    simulateRemainingMatches(roundIndex, { excludePlayerMatch: false });
    propagateRoundWinners(roundIndex);
  }
}

function ensureTournamentBracket(playerCharacter) {
  if (!playerCharacter) {
    return null;
  }
  if (!tournamentState.bracket) {
    const bracket = generateTournamentBracket(playerCharacter);
    tournamentState.bracket = bracket;
    tournamentState.playerPath = bracket.playerPath;
    tournamentState.results = TOURNAMENT_STRUCTURE.map(() => "pending");
    tournamentState.playerCharacterId = playerCharacter.id;
    tournamentState.roundIndex = 0;
    tournamentState.eliminated = false;
  }
  return tournamentState.bracket;
}

function getRoundLabelByIndex(index) {
  return TOURNAMENT_STRUCTURE[index]?.label ?? `Ronda ${index + 1}`;
}

function describeUpstreamSlot(slot) {
  if (!slot || slot.type !== "upstream") {
    return "";
  }
  const roundLabel = getRoundLabelByIndex(slot.source.roundIndex);
  return `Ganador ${roundLabel} ${slot.source.matchIndex + 1}`;
}

function resolveMatchSlots(match) {
  if (!match) {
    return;
  }
  match.slots = match.slots.map((slot) => {
    if (slot.type === "upstream") {
      const upstreamMatch = getTournamentMatch(slot.source.roundIndex, slot.source.matchIndex);
      if (upstreamMatch && upstreamMatch.winner) {
        const replacement = createBracketSlotFromCharacter(upstreamMatch.winner.character, {
          isPlayer: upstreamMatch.winner.isPlayer,
          source: slot.source,
        });
        replacement.source = slot.source;
        return replacement;
      }
    }
    return slot;
  });
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
  if (player === "p1" && isTournamentSelectionMode()) {
    tournamentState.bracket = null;
    tournamentState.playerPath = [];
    tournamentState.results = [];
    tournamentState.playerCharacterId = null;
    tournamentState.eliminated = false;
    tournamentState.roundIndex = 0;
    if (character) {
      ensureTournamentBracket(character);
    }
    updateTournamentPanel();
  }
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
  const powerIconPath = character.powerIcon ? `/static/${character.powerIcon}` : portraitPath;
  if (state.players[player]) {
    state.players[player].characterId = character.id;
    state.players[player].scaleBoost = 0;
  }
  if (player === "p1") {
    sprites.player1 = sprite;
    setAvatarForPlayer("p1", portraitPath, character.name);
    setPowerIconForPlayer("p1", powerIconPath, `Poder de ${character.name}`);
  } else {
    sprites.player2 = sprite;
    setAvatarForPlayer("p2", portraitPath, character.name);
    setPowerIconForPlayer("p2", powerIconPath, `Poder de ${character.name}`);
  }
  updatePowerIndicators();
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

function setPowerIconForPlayer(player, src, altText) {
  const icon = powerMeterIcons[player];
  if (!icon) {
    return;
  }
  const fallback = POWER_ICON_DEFAULTS[player];
  const nextSrc = src || fallback?.src;
  if (nextSrc) {
    icon.src = nextSrc;
  }
  icon.alt = altText || fallback?.alt || `Poder ${player === "p1" ? "jugador 1" : "jugador 2"}`;
}

function applyCharacterDataToPlayer(player, character, { updateSelection = false } = {}) {
  if (!character) {
    return;
  }
  ensureCharacterRegistered(character);
  const sprite = getSprite(character.sprite);
  const portraitPath = `/static/${character.portrait || character.sprite}`;
  const powerIconPath = character.powerIcon ? `/static/${character.powerIcon}` : portraitPath;
  if (state.players[player]) {
    state.players[player].characterId = character.id;
    state.players[player].scaleBoost = 0;
  }
  if (player === "p1") {
    sprites.player1 = sprite;
    setAvatarForPlayer("p1", portraitPath, character.name);
  } else {
    sprites.player2 = sprite;
    setAvatarForPlayer("p2", portraitPath, character.name);
  }
  setPowerIconForPlayer(player, powerIconPath, `Poder de ${character.name || "Jugador"}`);
  if (updateSelection) {
    selectedCharacters[player] = cloneCharacterData(character);
    updateCharacterDisplay(player, selectedCharacters[player]);
  }
  updatePowerIndicators();
}

function updateStartMatchAvailability() {
  if (!startMatchButton) {
    return;
  }
  const requiresSecondSelection = pendingMode !== "tournament";
  const hasPlayerOne = Boolean(selectedCharacters.p1);
  const hasPlayerTwo = Boolean(selectedCharacters.p2);
  const ready = hasPlayerOne && (requiresSecondSelection ? hasPlayerTwo : true);
  startMatchButton.disabled = !ready;
}

function clearSelectedCharacters() {
  selectedCharacters.p1 = null;
  selectedCharacters.p2 = null;
  selectionState.p1 = null;
  selectionState.p2 = null;
  if (state.players.p1) {
    state.players.p1.characterId = null;
    state.players.p1.scaleBoost = 0;
  }
  if (state.players.p2) {
    state.players.p2.characterId = null;
    state.players.p2.scaleBoost = 0;
  }
  sprites.player1 = getSprite(DEFAULT_SPRITES.p1);
  sprites.player2 = getSprite(DEFAULT_SPRITES.p2);
  setAvatarForPlayer("p1", DEFAULT_AVATARS.p1, "Jugador 1");
  setAvatarForPlayer("p2", DEFAULT_AVATARS.p2, "Jugador 2");
  setPowerIconForPlayer("p1");
  setPowerIconForPlayer("p2");
  updateCharacterDisplay("p1", null);
  updateCharacterDisplay("p2", null);
  updatePowerIndicators();
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
  tournamentState.bracket = null;
  tournamentState.playerPath = [];
  tournamentState.playerCharacterId = null;
  tournamentState.eliminated = false;
  tournamentFillerCounter = 0;
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
  if (restartButton) {
    restartButton.textContent = "Jugar de nuevo";
    delete restartButton.dataset.action;
  }

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
  const bracket = tournamentState.bracket;
  const shouldShow =
    (tournamentState.active && bracket) ||
    (bracket && tournamentState.results.some((result) => result && result !== "pending"));
  if (!shouldShow) {
    tournamentPanel.classList.add("hidden");
    tournamentBracketList.innerHTML = "";
    if (tournamentTrophy) {
      tournamentTrophy.classList.add("hidden");
    }
    return;
  }
  tournamentPanel.classList.remove("hidden");
  tournamentBracketList.innerHTML = "";
  if (!bracket) {
    return;
  }
  bracket.rounds.forEach((round, roundIndex) => {
    const roundItem = document.createElement("li");
    roundItem.className = "bracket-round";
    if (roundIndex === tournamentState.roundIndex && tournamentState.active) {
      roundItem.classList.add("is-current");
    }
    const header = document.createElement("div");
    header.className = "bracket-round-header";
    header.textContent = round.label;
    const matchesContainer = document.createElement("div");
    matchesContainer.className = "bracket-match-list";
    round.matches.forEach((match) => {
      resolveMatchSlots(match);
      const matchElement = document.createElement("div");
      matchElement.className = "bracket-match";
      if (match.isPlayerMatch) {
        matchElement.classList.add("player-match");
      }
      if (match.status === "active") {
        matchElement.classList.add("active");
      }
      if (match.status === "completed") {
        matchElement.classList.add("completed");
        if (match.isPlayerMatch && !(match.winner?.isPlayer)) {
          matchElement.classList.add("lost");
        }
        if (match.decidedBy === "auto") {
          matchElement.classList.add("auto-decided");
        }
      }
      match.slots.forEach((slot) => {
        matchElement.appendChild(createBracketSlotElement(slot, match));
      });
      matchesContainer.appendChild(matchElement);
    });
    roundItem.appendChild(header);
    roundItem.appendChild(matchesContainer);
    tournamentBracketList.appendChild(roundItem);
  });
  if (tournamentTrophy) {
    const hasChampion =
      tournamentState.results.length === TOURNAMENT_STRUCTURE.length &&
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
  const roundConfig = TOURNAMENT_STRUCTURE[tournamentState.roundIndex];
  if (!roundConfig) {
    return null;
  }
  return {
    ...roundConfig,
    match: getPlayerMatch(tournamentState.roundIndex),
  };
}

function prepareTournament({ keepSelections = false } = {}) {
  pendingMode = "tournament";
  tournamentState.active = true;
  tournamentState.roundIndex = 0;
  tournamentState.results = TOURNAMENT_STRUCTURE.map(() => "pending");
  tournamentState.bracket = null;
  tournamentState.playerPath = [];
  tournamentState.playerCharacterId = selectedCharacters.p1?.id ?? null;
  tournamentState.eliminated = false;
  tournamentFillerCounter = 0;
  cancelAiMessage();
  setAiDifficulty(TOURNAMENT_STRUCTURE[0]?.difficulty || "easy");
  highlightAiDifficulty();
  hideMenuScreen();
  disconnectSocket();
  resetMatch();
  resetPositions();
  if (menuAiOptions) {
    menuAiOptions.classList.add("hidden");
  }
  if (!keepSelections) {
    selectionState.p2 = null;
    selectedCharacters.p2 = null;
    updateCharacterDisplay("p2", null);
    setPowerIconForPlayer("p2");
  }
  updateTournamentPanel();
  updateModeLabel("Torneo");
  updateStatus("Selecciona tu personaje para el torneo");
  showCharacterSelection({ keepSelections });
  updateStartMatchAvailability();
}

function assignTournamentOpponent(match) {
  if (!match) {
    return null;
  }
  resolveMatchSlots(match);
  const opponentSlot = match.slots.find((slot) => !slot.isPlayer);
  if (!opponentSlot || opponentSlot.type !== "character" || !opponentSlot.character) {
    return null;
  }
  applyCharacterDataToPlayer("p2", opponentSlot.character, { updateSelection: true });
  return opponentSlot.character;
}

function startTournamentRound() {
  pendingMode = "tournament";
  const playerCharacter =
    selectedCharacters.p1 || getCharacterDataById(tournamentState.playerCharacterId);
  if (!playerCharacter) {
    updateStatus("Selecciona tu personaje para el torneo");
    showCharacterSelection({ keepSelections: false });
    return;
  }
  const bracket = ensureTournamentBracket(playerCharacter);
  const roundInfo = currentTournamentRound();
  if (!bracket || !roundInfo) {
    return;
  }
  applyCharacterDataToPlayer("p1", playerCharacter, { updateSelection: true });
  const match = roundInfo.match;
  if (!match) {
    return;
  }
  setAiDifficulty(roundInfo.difficulty || "normal");
  highlightAiDifficulty();
  const opponent = assignTournamentOpponent(match);
  const opponentName = opponent?.name || "Rival misterioso";
  match.status = "active";
  match.decidedBy = null;
  tournamentState.results[tournamentState.roundIndex] = "active";
  if (restartButton) {
    restartButton.textContent = "Reintentar ronda";
    delete restartButton.dataset.action;
  }
  updateTournamentPanel();
  const difficultyLabel = AI_DIFFICULTIES[aiDifficulty]?.label ?? "Normal";
  logChat("Narrador", `Ronda ${roundInfo.label}: ${opponentName} (${difficultyLabel})`);
  enterAiMode({
    label: `Torneo - ${roundInfo.label}`,
    status: `${opponentName} - Dificultad ${difficultyLabel}`,
  });
}

function concludeTournamentRound(playerWon) {
  const roundInfo = currentTournamentRound();
  if (!roundInfo) {
    return;
  }
  const match = roundInfo.match;
  if (!match) {
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
  resolveMatchSlots(match);
  const playerSlot = match.slots.find((slot) => slot.type === "character" && slot.isPlayer);
  const opponentSlot = match.slots.find((slot) => slot.type === "character" && !slot.isPlayer);
  const winnerSlot = playerWon ? playerSlot : opponentSlot;
  if (!winnerSlot) {
    return;
  }
  match.status = "completed";
  match.winner = {
    character: cloneCharacterData(winnerSlot.character),
    isPlayer: Boolean(winnerSlot.isPlayer),
  };
  match.decidedBy = playerWon ? "player" : "opponent";
  tournamentState.results[tournamentState.roundIndex] = playerWon ? "won" : "lost";
  simulateRemainingMatches(tournamentState.roundIndex, { excludePlayerMatch: true });
  propagateRoundWinners(tournamentState.roundIndex);
  if (playerWon) {
    setMatchEndHeading(`Ronda ${roundInfo.label} superada`);
    if (tournamentState.roundIndex >= TOURNAMENT_STRUCTURE.length - 1) {
      updateTournamentPanel();
      handleTournamentVictory();
    } else {
      tournamentState.roundIndex += 1;
      tournamentState.results[tournamentState.roundIndex] = "pending";
      updateTournamentPanel();
      scheduleTournamentContinuation(() => {
        hideMatchEnd();
        resetMatch();
        resetPositions();
        startTournamentRound();
      }, 2400);
    }
  } else {
    simulateTournamentRemainder(tournamentState.roundIndex + 1);
    updateTournamentPanel();
    handleTournamentDefeat();
  }
}

function handleTournamentVictory() {
  tournamentState.active = false;
  pendingMode = null;
  updateTournamentPanel();
  setMatchEndHeading("Campeon del torneo!");
  updateStatus("Campeon del torneo");
  aiSpeak("defeat", 1200);
  if (restartButton) {
    restartButton.textContent = "Volver al menu principal";
    restartButton.dataset.action = "return-menu";
  }
}

function handleTournamentDefeat() {
  tournamentState.active = false;
  tournamentState.eliminated = true;
  pendingMode = null;
  updateTournamentPanel();
  setMatchEndHeading("Eliminado del torneo");
  aiSpeak("champion", 1200);
  updateStatus("Quedaste eliminado del torneo");
  if (restartButton) {
    restartButton.textContent = "Volver al menu principal";
    restartButton.dataset.action = "return-menu";
  }
}

function scheduleTournamentContinuation(callback, delay = 2200) {
  setTimeout(() => {
    callback();
  }, delay);
}

function queueJump(playerKey) {
  const control = playerControl[playerKey];
  if (isPlayerStunned(playerKey)) {
    if (control) {
      control.bufferedJump = 0;
    }
    return;
  }
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

function isTournamentSelectionMode() {
  return pendingMode === "tournament";
}

function configureCharacterSelectionUi(isTournamentSelection) {
  if (!characterSelectionOverlay) {
    return;
  }
  if (isTournamentSelection) {
    characterSelectionOverlay.classList.add("single-player");
    if (playerSelectionContainers.p2) {
      playerSelectionContainers.p2.style.display = "none";
    }
    if (playerSelectionContainers.p1) {
      playerSelectionContainers.p1.style.margin = "0 auto";
    }
    if (selectionTitleElement) {
      selectionTitleElement.textContent = "Elegi tu personaje para el torneo";
    }
    if (selectionHintElement) {
      selectionHintElement.textContent =
        "Elegi solo tu personaje. El rival se asigna automaticamente.";
    }
    characterNavButtons.forEach((button) => {
      if (button.dataset.player === "p2") {
        button.disabled = true;
      }
    });
    if (startMatchButton) {
      startMatchButton.textContent = "Comenzar torneo";
    }
    return;
  }
  characterSelectionOverlay.classList.remove("single-player");
  if (playerSelectionContainers.p2) {
    playerSelectionContainers.p2.style.display = defaultPlayerSelectionDisplay.p2;
  }
  if (playerSelectionContainers.p1) {
    playerSelectionContainers.p1.style.margin = defaultPlayerSelectionMargin.p1;
  }
  if (selectionTitleElement) {
    selectionTitleElement.textContent = defaultSelectionTitle;
  }
  if (selectionHintElement) {
    selectionHintElement.textContent = defaultSelectionHint;
  }
  characterNavButtons.forEach((button) => {
    if (button.dataset.player === "p2") {
      button.disabled = false;
    }
  });
  if (startMatchButton) {
    startMatchButton.textContent = defaultStartMatchLabel;
  }
}

function showCharacterSelection({ keepSelections = true } = {}) {
  if (!characterSelectionOverlay) {
    return;
  }
  const isTournamentSelection = isTournamentSelectionMode();
  configureCharacterSelectionUi(isTournamentSelection);
  const selectablePlayers = isTournamentSelection ? ["p1"] : ["p1", "p2"];
  if (!keepSelections) {
    clearSelectedCharacters();
  }
  if (!keepSelections) {
    selectablePlayers.forEach((player) => {
      const defaultIndex = normalizeIndex(defaultSelectionIndices[player] ?? 0);
      setCharacterForPlayer(player, defaultIndex);
    });
  } else {
    selectablePlayers.forEach((player) => {
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
  if (isTournamentSelection) {
    selectedCharacters.p2 = null;
    selectionState.p2 = null;
    updateCharacterDisplay("p2", null);
    setPowerIconForPlayer("p2");
    setAvatarForPlayer("p2", DEFAULT_AVATARS.p2, "Jugador 2");
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
  const targetMode = pendingMode || "local";
  const requiresSecondSelection = targetMode !== "tournament";
  if (!selectedCharacters.p1 || (requiresSecondSelection && !selectedCharacters.p2)) {
    return;
  }
  hideCharacterSelection();
  if (targetMode === "tournament") {
    const bracket = ensureTournamentBracket(selectedCharacters.p1);
    if (bracket) {
      updateTournamentPanel();
    }
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
  updatePowers(delta);
  updatePowerIndicators();
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
        applyAiControl(key, player, control, delta);
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
  if (isPlayerStunned(playerKey)) {
    if (player.foot) {
      player.foot.raising = false;
    }
    if (control) {
      control.bufferedJump = 0;
    }
    return;
  }
  const leftKey = playerKey === "p1" ? "KeyA" : "ArrowLeft";
  const rightKey = playerKey === "p1" ? "KeyD" : "ArrowRight";
  const moveSpeed = PLAYER_SPEED * getPlayerSpeedMultiplier(playerKey);
  if (state.pressed[leftKey]) {
    player.vx = -moveSpeed;
    player.facing = -1;
  }
  if (state.pressed[rightKey]) {
    player.vx = moveSpeed;
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
  if (isPlayerStunned(playerKey)) {
    player.foot.raising = false;
    return;
  }
  player.foot.raising = pressed;
}

function getPlayerCharacterId(playerKey) {
  const player = state.players[playerKey];
  if (player && player.characterId) {
    return player.characterId;
  }
  const selected = selectedCharacters[playerKey];
  return selected?.id ?? null;
}

function isPlayerColapinto(playerKey) {
  return getPlayerCharacterId(playerKey) === COLAPINTO_ID;
}

function isPlayerCuervo(playerKey) {
  return getPlayerCharacterId(playerKey) === CUERVO_ID;
}

function isPlayerFantasma(playerKey) {
  return getPlayerCharacterId(playerKey) === FANTASMA_ID;
}

function getOpponentKey(playerKey) {
  return playerKey === "p1" ? "p2" : "p1";
}

function isPlayerStunned(playerKey) {
  const powers = state.powers?.[playerKey];
  return Boolean(powers && powers.smokeAffectedTimer > 0);
}

function getPlayerPowerConfig(playerKey) {
  const characterId = getPlayerCharacterId(playerKey);
  if (!characterId) {
    return null;
  }
  return CHARACTER_POWER_CONFIG[characterId] || null;
}

function updatePowerIndicators() {
  if (!powerMeters.p1 && !powerMeters.p2) {
    return;
  }
  ["p1", "p2"].forEach((playerKey) => {
    const meter = powerMeters[playerKey];
    if (!meter) {
      return;
    }
    const config = getPlayerPowerConfig(playerKey);
    const powerState = state.powers?.[playerKey];
    if (!config || !powerState) {
      meter.style.setProperty("--progress-angle", "0deg");
      meter.classList.add("is-disabled");
      meter.classList.remove("is-ready");
      meter.classList.remove("is-active");
      return;
    }
    const cooldownDuration = Number(config.cooldownDuration) || 0;
    const cooldownRemaining = Math.max(0, Number(powerState[config.cooldownKey]) || 0);
    const activeTimer = Math.max(0, Number(powerState[config.timerKey]) || 0);
    const progress =
      cooldownDuration > 0 ? Math.min(1, Math.max(0, 1 - cooldownRemaining / cooldownDuration)) : 1;
    const ready = cooldownRemaining <= 0.05;
    const active = activeTimer > 0.05;
    const angle = ready ? 359.9 : progress * 360;
    meter.style.setProperty("--progress-angle", `${angle.toFixed(2)}deg`);
    meter.classList.remove("is-disabled");
    meter.classList.toggle("is-ready", ready);
    meter.classList.toggle("is-active", active);
  });
}

function getPlayerSpeedMultiplier(playerKey) {
  const power = state.powers?.[playerKey];
  if (!power) {
    return 1;
  }
  if (power.speedBoostTimer > 0 && isPlayerColapinto(playerKey)) {
    return COLAPINTO_SPEED_MULTIPLIER;
  }
  if (power.sizeBoostTimer > 0 && isPlayerCuervo(playerKey)) {
    return CUERVO_SPEED_MULTIPLIER;
  }
  return 1;
}

function getPlayerScale(playerKey) {
  const power = state.powers?.[playerKey];
  if (!power) {
    return 1;
  }
  if (power.sizeBoostTimer > 0 && isPlayerCuervo(playerKey)) {
    return CUERVO_SCALE;
  }
  return 1;
}

function updatePowers(delta) {
  if (!state.powers) {
    return;
  }
  Object.entries(state.powers).forEach(([playerKey, power]) => {
    if (!power) {
      return;
    }
    if (power.speedBoostTimer > 0) {
      power.speedBoostTimer = Math.max(0, power.speedBoostTimer - delta);
    }
    if (power.speedBoostCooldown > 0) {
      power.speedBoostCooldown = Math.max(0, power.speedBoostCooldown - delta);
    }
    if (power.sizeBoostTimer > 0) {
      power.sizeBoostTimer = Math.max(0, power.sizeBoostTimer - delta);
      const player = state.players[playerKey];
      if (player) {
        player.scaleBoost = CUERVO_SCALE;
      }
    }
    if (power.sizeBoostCooldown > 0) {
      power.sizeBoostCooldown = Math.max(0, power.sizeBoostCooldown - delta);
    }
    if (power.sizeBoostTimer <= 0) {
      const player = state.players[playerKey];
      if (player) {
        player.scaleBoost = 0;
      }
    }
    if (power.speedBoostTimer <= 0 && power.speedBoostCooldown <= COLAPINTO_POWER_COOLDOWN - delta) {
      // no-op, placeholder for potential effects
    }
    if (power.smokeCooldown > 0) {
      power.smokeCooldown = Math.max(0, power.smokeCooldown - delta);
    }
    if (power.smokeActiveTimer > 0) {
      power.smokeActiveTimer = Math.max(0, power.smokeActiveTimer - delta);
    }
    if (power.smokeAffectedTimer > 0) {
      power.smokeAffectedTimer = Math.max(0, power.smokeAffectedTimer - delta);
      const stunnedPlayer = state.players[playerKey];
      if (stunnedPlayer) {
        stunnedPlayer.vx = 0;
        if (stunnedPlayer.foot) {
          stunnedPlayer.foot.raising = false;
        }
      }
    }
  });
}

function activateCharacterPower(playerKey) {
  if (mode === "menu") {
    return false;
  }
  if (isPlayerColapinto(playerKey)) {
    return activateColapintoSpeedPower(playerKey);
  }
  if (isPlayerCuervo(playerKey)) {
    return activateCuervoSpeedPower(playerKey);
  }
  if (isPlayerFantasma(playerKey)) {
    return activateFantasmaSmokePower(playerKey);
  }
  return false;
}

function activateColapintoSpeedPower(playerKey) {
  const powers = state.powers?.[playerKey];
  if (!powers) {
    return false;
  }
  if (!isPlayerColapinto(playerKey)) {
    return false;
  }
  if (powers.speedBoostCooldown > 0 || powers.speedBoostTimer > 0) {
    return false;
  }
  powers.speedBoostTimer = COLAPINTO_POWER_DURATION;
  powers.speedBoostCooldown = COLAPINTO_POWER_COOLDOWN;
  const label = playerKey === "p1" ? "Jugador 1" : "Jugador 2";
  logChat("Sistema", `${label} activa Sobrevuelo de Colapinto!`);
  return true;
}

function activateCuervoSpeedPower(playerKey) {
  const powers = state.powers?.[playerKey];
  if (!powers) {
    return false;
  }
  if (!isPlayerCuervo(playerKey)) {
    return false;
  }
  if (powers.sizeBoostCooldown > 0 || powers.sizeBoostTimer > 0) {
    return false;
  }
  powers.sizeBoostTimer = CUERVO_POWER_DURATION;
  powers.sizeBoostCooldown = CUERVO_POWER_COOLDOWN;
  const player = state.players[playerKey];
  if (player) {
    player.scaleBoost = CUERVO_SCALE;
  }
  const label = playerKey === "p1" ? "Jugador 1" : "Jugador 2";
  logChat("Sistema", `${label} activa Garras del Cuervo!`);
  return true;
}

function activateFantasmaSmokePower(playerKey) {
  const powers = state.powers?.[playerKey];
  if (!powers) {
    return false;
  }
  if (!isPlayerFantasma(playerKey)) {
    return false;
  }
  if (powers.smokeCooldown > 0) {
    return false;
  }
  powers.smokeCooldown = FANTASMA_POWER_COOLDOWN;
  powers.smokeActiveTimer = FANTASMA_SMOKE_DURATION;
  const opponentKey = getOpponentKey(playerKey);
  const opponentPowers = state.powers?.[opponentKey];
  if (opponentPowers) {
    opponentPowers.smokeAffectedTimer = FANTASMA_SMOKE_DURATION;
  }
  const opponentPlayer = state.players[opponentKey];
  if (opponentPlayer) {
    opponentPlayer.vx = 0;
    if (opponentPlayer.foot) {
      opponentPlayer.foot.raising = false;
    }
  }
  const label = playerKey === "p1" ? "Jugador 1" : "Jugador 2";
  logChat("Sistema", `${label} invoca Niebla Fantasma!`);
  return true;
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

function applyAiControl(playerKey, player, control, delta) {
  if (isPlayerStunned(playerKey)) {
    player.vx = 0;
    if (player.foot) {
      player.foot.raising = false;
    }
    if (control) {
      control.bufferedJump = 0;
    }
    aiController.targetX = player.x;
    return;
  }
  const settings = getAiSettings();
  const inset = PLAYER_WIDTH / 2 + 12;
  const speedBoost = getPlayerSpeedMultiplier(playerKey);
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
  const baseSpeed = PLAYER_SPEED * speedBoost;
  const maxSpeed = baseSpeed * settings.speedMultiplier;
  const desiredVx = clamp(dx * settings.steering * baseSpeed, -maxSpeed, maxSpeed);
  const acceleration = settings.acceleration * speedBoost * delta;
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
  drawSmokeEffects();
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
        if (event.code === POWER_KEYS.p1) {
          event.preventDefault();
          activateCharacterPower("p1");
        }
        if (event.code === POWER_KEYS.p2) {
          event.preventDefault();
          activateCharacterPower("p2");
        }
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
      if (restartButton.dataset.action === "return-menu") {
        hideMatchEnd();
        showMenuScreen({ resetSelections: false });
        return;
      }
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
  updatePowerIndicators();
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
  if (state.powers) {
    Object.values(state.powers).forEach((power) => {
      if (!power) {
        return;
      }
      power.speedBoostTimer = 0;
      power.speedBoostCooldown = 0;
      power.sizeBoostTimer = 0;
      power.sizeBoostCooldown = 0;
       power.smokeCooldown = 0;
       power.smokeActiveTimer = 0;
       power.smokeAffectedTimer = 0;
    });
    updatePowerIndicators();
  }
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

async function bootstrap() {
  try {
    await loadCharacters();
  } catch (error) {
    console.error("Fallo al inicializar personajes:", error);
    characters = getFallbackCharacters();
  }
  setupUI();
  initializeCharacterSelection();
  showMenuScreen({ resetSelections: true });
  startLoop();
}

bootstrap().catch((error) => {
  console.error("Error inesperado al iniciar el juego:", error);
});

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
  const { x, y } = geometry;
  const width = 40;
  const height = 26;
  ctx.save();
  ctx.translate(x, y);
  const facing = player.facing >= 0 ? 1 : -1;
  if (facing > 0) {
    ctx.scale(-1, 1);
  }
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
  setMatchEndHeading("Fin del partido");
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
  const scale = getPlayerScale(player === state.players.p1 ? "p1" : "p2");
  const width = PLAYER_WIDTH * scale;
  const height = PLAYER_HEIGHT * scale;
  if (player.facing > 0) {
    ctx.scale(-1, 1);
  }
  ctx.drawImage(
    sprite,
    -width / 2,
    -height,
    width,
    height,
  );
  ctx.restore();
}

function drawSmokeEffects() {
  if (!state.powers) {
    return;
  }
  ["p1", "p2"].forEach((playerKey) => {
    const player = state.players[playerKey];
    const power = state.powers[playerKey];
    if (!player || !power || power.smokeAffectedTimer <= 0) {
      return;
    }
    const duration = Math.max(FANTASMA_SMOKE_DURATION, 0.001);
    const progress = clamp(power.smokeAffectedTimer / duration, 0, 1);
    const radius = 70 + 40 * progress;
    const centerX = player.x;
    const centerY = player.y - PLAYER_HEIGHT * 0.6;
    const innerAlpha = 0.32 + 0.18 * progress;
    const midAlpha = 0.18 + 0.12 * progress;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const gradient = ctx.createRadialGradient(centerX, centerY, 10, centerX, centerY, radius);
    gradient.addColorStop(0, `rgba(180, 190, 220, ${innerAlpha.toFixed(3)})`);
    gradient.addColorStop(0.55, `rgba(180, 190, 220, ${midAlpha.toFixed(3)})`);
    gradient.addColorStop(1, "rgba(180, 190, 220, 0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
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

