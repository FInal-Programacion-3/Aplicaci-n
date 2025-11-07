import { GameSocket, PrivateRoomSocket } from "./net.js";

const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");
const canvasWrapper = document.querySelector(".canvas-wrapper");
const profileSelect = document.getElementById("profile-select");
const idleOverlay = document.getElementById("idle-overlay");
const idleStartButton = document.getElementById("idle-start-button");
const vipPanel = document.getElementById("vip-panel");
const vipPanelProfileLabel = document.getElementById("vip-panel-profile");
const vipPanelBadge = document.getElementById("vip-panel-badge");
const vipMusicToggle = document.getElementById("vip-music-toggle");
const vipMusicDescription = document.getElementById("vip-music-description");
const vipSkinList = document.getElementById("vip-skin-list");
const vipSkinToggleButton = document.getElementById("vip-skin-toggle");
const vipSkinEmpty = document.getElementById("vip-skin-empty");
const vipCustomForm = document.getElementById("vip-custom-character-form");
const vipCustomPreview = document.getElementById("vip-custom-character-preview");
const vipCustomFeedback = document.getElementById("vip-custom-feedback");
const vipCustomNameInput = document.getElementById("vip-custom-name");
const vipCustomSpriteInput = document.getElementById("vip-custom-sprite");
const vipCustomPortraitInput = document.getElementById("vip-custom-portrait");
const vipCustomDescriptionInput = document.getElementById("vip-custom-description");
const vipCustomStatSpeedInput = document.getElementById("vip-custom-stat-speed");
const vipCustomStatJumpInput = document.getElementById("vip-custom-stat-jump");
const vipCustomStatPowerInput = document.getElementById("vip-custom-stat-power");
const vipMusicAudioElement = document.getElementById("vip-music-audio");
const vipAccessControl = document.getElementById("vip-access-control");
const vipAccessForm = document.getElementById("vip-access-form");
const vipAccessInput = document.getElementById("vip-access-code");
const vipAccessFeedback = document.getElementById("vip-access-feedback");
const vipAccessProfileLabel = document.getElementById("vip-access-profile");

let profilesCache = [];
let selectedProfileId = null;
let activeProfileId = null;
let activeProfileCharacterId = null;
let profilesLoaded = false;
let vipCharacterPoolProfileId = null;
let vipMusicPreviewActive = false;
let vipMusicGameplayActive = false;
let vipMusicProfileId = null;
let vipMusicAudioSource = vipMusicAudioElement instanceof HTMLAudioElement ? vipMusicAudioElement : null;
let vipSkinsEnabled = true;
let vipSkinPreferencesCache = {};
let pendingVipProfileId = null;
let activeVipAuthorizationId = null;

if (typeof window !== "undefined") {
  const storedProfileId = window.localStorage.getItem("hs-selected-profile");
  if (storedProfileId) {
    const parsed = Number.parseInt(storedProfileId, 10);
    if (!Number.isNaN(parsed)) {
      selectedProfileId = parsed;
    }
  }
}

if (profileSelect) {
  profileSelect.addEventListener("change", (event) => {
    const value = event.target.value;
    const nextId = value ? Number.parseInt(value, 10) : null;
    handleProfileSelectionChange(nextId);
  });
}

if (vipMusicToggle) {
  vipMusicToggle.addEventListener("click", (event) => {
    event.preventDefault();
    handleVipMusicToggle();
  });
}

if (vipSkinToggleButton) {
  vipSkinToggleButton.addEventListener("click", (event) => {
    event.preventDefault();
    handleVipSkinToggle();
  });
}

if (vipCustomForm) {
  vipCustomForm.addEventListener("submit", (event) => {
    void handleVipCustomFormSubmit(event);
  });
}

if (vipAccessForm) {
  vipAccessForm.addEventListener("submit", (event) => {
    event.preventDefault();
    handleVipAccessSubmit();
  });
}

async function loadProfiles({ force = false } = {}) {
  if (!profileSelect) {
    profilesLoaded = true;
    return;
  }
  if (profilesLoaded && !force) {
    populateProfileSelect();
    return;
  }
  try {
    const response = await fetch("/api/profiles");
    if (!response.ok) {
      throw new Error(`Error ${response.status}`);
    }
      profilesCache = await response.json();
      profilesLoaded = true;
      populateProfileSelect();
      const vipEnforced = enforceVipAccessRequirements();
      if (!vipEnforced) {
        refreshVipExperience({ keepSelection: true });
      }
    } catch (error) {
      console.error("No se pudieron cargar los perfiles:", error);
    }
  }

function populateProfileSelect() {
  if (!profileSelect) {
    return;
  }
  const storedProfileId = typeof window !== "undefined" ? window.localStorage.getItem("hs-selected-profile") : null;
  if (!selectedProfileId && storedProfileId) {
    const parsed = Number.parseInt(storedProfileId, 10);
    if (!Number.isNaN(parsed)) {
      selectedProfileId = parsed;
    }
  }
  const currentSelection = selectedProfileId;
  profileSelect.innerHTML = "<option value=\"\">Perfil: sin seleccionar</option>";
  profilesCache.forEach((profile) => {
    const option = document.createElement("option");
    option.value = String(profile.id);
    const wins = profile.wins ?? 0;
    const losses = profile.losses ?? 0;
    option.textContent = `${profile.nickname} (W:${wins}/L:${losses})`;
    if (currentSelection && profile.id === currentSelection) {
      option.selected = true;
    }
    profileSelect.append(option);
  });
  if (currentSelection && !profilesCache.some((profile) => profile.id === currentSelection)) {
    setSelectedProfile(null);
  } else if (!currentSelection) {
    profileSelect.value = "";
  }
  }

  function handleProfileSelectionChange(nextId) {
    if (nextId == null || Number.isNaN(nextId)) {
      activeVipAuthorizationId = null;
      hideVipAccessGate();
      setSelectedProfile(null);
      return;
    }
    const profile = profilesCache.find((item) => item.id === nextId);
    if (profile?.isVip) {
      pendingVipProfileId = profile.id;
      showVipAccessGate(profile);
      return;
    }
    activeVipAuthorizationId = null;
    hideVipAccessGate();
    setSelectedProfile(nextId);
  }

  function enforceVipAccessRequirements() {
    const profile = getSelectedProfile();
    if (profile?.isVip && profile.id !== activeVipAuthorizationId) {
      pendingVipProfileId = profile.id;
      showVipAccessGate(profile, { revertSelection: false });
      setSelectedProfile(null);
      return true;
    }
    return false;
  }

  function showVipAccessGate(profile, { revertSelection = true } = {}) {
    if (profileSelect) {
      const previousSelection = selectedProfileId != null ? String(selectedProfileId) : "";
      profileSelect.classList.add("profile-select-attention");
      profileSelect.value = revertSelection ? previousSelection : "";
    }
    if (vipAccessControl) {
      vipAccessControl.classList.remove("hidden");
    }
    if (vipAccessProfileLabel) {
      vipAccessProfileLabel.textContent = profile.nickname;
    }
    if (vipAccessForm) {
      vipAccessForm.reset();
    }
    setVipAccessFeedback(`Ingresa el codigo secreto para ${profile.nickname}.`, "info");
    if (vipAccessInput) {
      vipAccessInput.focus();
    }
  }

  function hideVipAccessGate() {
    if (vipAccessControl) {
      vipAccessControl.classList.add("hidden");
    }
    if (vipAccessForm) {
      vipAccessForm.reset();
    }
    setVipAccessFeedback("");
    pendingVipProfileId = null;
    if (profileSelect) {
      profileSelect.classList.remove("profile-select-attention");
    }
  }

  function setVipAccessFeedback(message, variant = "info") {
    if (!vipAccessFeedback) {
      return;
    }
    vipAccessFeedback.textContent = message;
    if (!message) {
      vipAccessFeedback.removeAttribute("data-variant");
      return;
    }
    vipAccessFeedback.setAttribute("data-variant", variant);
  }

  function handleVipAccessSubmit() {
    if (pendingVipProfileId == null) {
      setVipAccessFeedback("Selecciona un perfil VIP para ingresar el codigo.", "error");
      return;
    }
    const profile = profilesCache.find((item) => item.id === pendingVipProfileId);
    if (!profile) {
      setVipAccessFeedback("El perfil VIP ya no esta disponible. Seleccionalo nuevamente.", "error");
      pendingVipProfileId = null;
      return;
    }
    const userCode = vipAccessInput ? vipAccessInput.value.trim() : "";
    if (!userCode) {
      setVipAccessFeedback("Ingresa el codigo secreto para continuar.", "error");
      if (vipAccessInput) {
        vipAccessInput.focus();
      }
      return;
    }
    const expectedCode = String(profile.secretCode || "");
    if (expectedCode && expectedCode.toUpperCase() === userCode.toUpperCase()) {
      activeVipAuthorizationId = profile.id;
      setSelectedProfile(profile.id);
      hideVipAccessGate();
      return;
    }
    setVipAccessFeedback("Codigo incorrecto: no tenes acceso a este perfil VIP.", "error");
    if (vipAccessInput) {
      vipAccessInput.focus();
      vipAccessInput.select();
    }
  }

  function setSelectedProfile(id) {
    if (id == null || Number.isNaN(id)) {
      selectedProfileId = null;
      activeVipAuthorizationId = null;
      if (typeof window !== "undefined") {
        window.localStorage.removeItem("hs-selected-profile");
      }
      if (profileSelect && profileSelect.value !== "") {
        profileSelect.value = "";
    }
    refreshVipExperience({ keepSelection: true });
    return;
  }
    selectedProfileId = id;
    const profile = profilesCache.find((item) => item.id === id);
    const isVipSelection = Boolean(profile?.isVip);
    if (!isVipSelection) {
      activeVipAuthorizationId = null;
    }
    if (typeof window !== "undefined") {
      window.localStorage.setItem("hs-selected-profile", String(id));
    }
    if (profileSelect && profileSelect.value !== String(id)) {
      profileSelect.value = String(id);
  }
  refreshVipExperience({ keepSelection: true });
}

function getSelectedProfile() {
  if (selectedProfileId == null) {
    return null;
  }
  return profilesCache.find((profile) => profile.id === selectedProfileId) || null;
}

function refreshVipExperience({ keepSelection = true } = {}) {
  const profile = getSelectedProfile();
  vipSkinsEnabled = profile ? loadVipSkinPreference(profile.id) : true;
  updateVipPanel(profile);
  refreshVipCharacterPool({ keepSelection });
  configureVipMusic(profile);
}

function updateVipPanel(profile) {
  if (!vipPanel) {
    return;
  }
  const isVip = Boolean(profile?.isVip);
  vipPanel.classList.toggle("hidden", !isVip);
  if (!isVip) {
    if (vipPanelProfileLabel) {
      vipPanelProfileLabel.textContent = "Selecciona un perfil VIP para activarlos.";
    }
    if (vipPanelBadge) {
      vipPanelBadge.textContent = "VIP";
    }
    if (vipSkinList) {
      vipSkinList.innerHTML = "";
    }
    if (vipSkinEmpty) {
      vipSkinEmpty.classList.remove("hidden");
    }
    if (vipCustomForm) {
      vipCustomForm.reset();
    }
    if (vipCustomPreview) {
      vipCustomPreview.classList.add("hidden");
      vipCustomPreview.innerHTML = "";
    }
    setVipCustomFeedback("");
    if (vipMusicToggle) {
      vipMusicToggle.disabled = true;
      vipMusicToggle.textContent = "Escuchar tema";
    }
    if (vipMusicDescription) {
      vipMusicDescription.textContent = "Selecciona un perfil VIP para elegir musica exclusiva.";
    }
    vipMusicPreviewActive = false;
    vipMusicGameplayActive = false;
    updateVipMusicPlayback();
    return;
  }
  if (vipPanelProfileLabel) {
    vipPanelProfileLabel.textContent = `${profile.nickname} · ${profile.badge || "VIP"}`;
  }
  if (vipPanelBadge) {
    vipPanelBadge.textContent = profile.tier ? `VIP ${profile.tier}` : "VIP";
  }
  renderVipSkinList(profile.vipSkins);
  renderVipCustomPreview(profile.customCharacter);
  prefillVipCustomForm(profile.customCharacter);
  if (vipMusicDescription) {
    vipMusicDescription.textContent = profile.musicTrack
      ? "El tema VIP se activa en cuanto empieza el partido."
      : "Agrega una pista personalizada desde el backend.";
  }
  updateVipMusicToggleState(profile);
  updateVipSkinToggleState(profile);
}

function renderVipSkinList(skins) {
  if (!vipSkinList || !vipSkinEmpty) {
    return;
  }
  vipSkinList.innerHTML = "";
  const entries =
    skins && typeof skins === "object"
      ? Object.entries(skins).filter(([key]) => typeof key === "string")
      : [];
  if (!entries.length) {
    vipSkinEmpty.classList.remove("hidden");
    return;
  }
  vipSkinEmpty.classList.add("hidden");
  entries.forEach(([characterId, skin]) => {
    const card = document.createElement("div");
    card.className = "vip-skin-card";
    const title = document.createElement("strong");
    title.textContent = characterId;
    card.append(title);
    if (skin && typeof skin === "object") {
      const sprite = document.createElement("span");
      sprite.textContent = `Sprite: ${skin.sprite || "original"}`;
      card.append(sprite);
      if (skin.portrait) {
        const portrait = document.createElement("span");
        portrait.textContent = `Retrato: ${skin.portrait}`;
        card.append(portrait);
      }
    }
    vipSkinList.append(card);
  });
  if (!vipSkinsEnabled) {
    const notice = document.createElement("p");
    notice.className = "vip-note";
    notice.textContent = "Las skins VIP están desactivadas para este perfil.";
    vipSkinList.append(notice);
  }
}

function renderVipCustomPreview(character) {
  if (!vipCustomPreview) {
    return;
  }
  if (!character) {
    vipCustomPreview.classList.add("hidden");
    vipCustomPreview.innerHTML = "";
    return;
  }
  vipCustomPreview.classList.remove("hidden");
  const portrait = getStaticMediaPath(character.portrait || character.sprite);
  const description = character.description || character.tagline || "Personaje VIP personalizado.";
  const stats = normalizeCharacterStats(character.stats);
  vipCustomPreview.innerHTML = `
    <img src="${portrait}" alt="${character.name}" />
    <div class="vip-custom-preview-details">
      <strong>${character.name}</strong>
      <span>${description}</span>
      <div class="vip-custom-preview-stats">
        <span>Vel ${Math.round(stats.speed)}</span>
        <span>Salto ${Math.round(stats.jump)}</span>
        <span>Poder ${Math.round(stats.power)}</span>
      </div>
    </div>
  `;
}

function prefillVipCustomForm(character) {
  if (!vipCustomForm) {
    return;
  }
  if (vipCustomNameInput) {
    vipCustomNameInput.value = character?.name || "";
  }
  if (vipCustomSpriteInput) {
    vipCustomSpriteInput.value = character?.sprite || "";
  }
  if (vipCustomPortraitInput) {
    vipCustomPortraitInput.value = character?.portrait || "";
  }
  if (vipCustomDescriptionInput) {
    vipCustomDescriptionInput.value = character?.description || character?.tagline || "";
  }
  const stats = normalizeCharacterStats(character?.stats);
  if (vipCustomStatSpeedInput) {
    vipCustomStatSpeedInput.value = String(Math.round(stats.speed));
  }
  if (vipCustomStatJumpInput) {
    vipCustomStatJumpInput.value = String(Math.round(stats.jump));
  }
  if (vipCustomStatPowerInput) {
    vipCustomStatPowerInput.value = String(Math.round(stats.power));
  }
  setVipCustomFeedback("");
}

function setVipCustomFeedback(message) {
  if (!vipCustomFeedback) {
    return;
  }
  vipCustomFeedback.textContent = message || "";
}

function configureVipMusic(profile) {
  if (!vipMusicAudioElement || !(vipMusicAudioElement instanceof HTMLAudioElement)) {
    vipMusicAudioSource = null;
    return;
  }
  vipMusicAudioSource = vipMusicAudioElement;
  if (!profile || !profile.isVip || !profile.musicTrack) {
    vipMusicAudioSource.pause();
    vipMusicAudioSource.currentTime = 0;
    vipMusicAudioSource.removeAttribute("src");
    vipMusicPreviewActive = false;
    vipMusicGameplayActive = false;
    vipMusicProfileId = null;
    updateVipMusicToggleState(profile);
    return;
  }
  if (vipMusicAudioSource.getAttribute("data-track") !== profile.musicTrack) {
    vipMusicAudioSource.pause();
    vipMusicAudioSource.currentTime = 0;
    vipMusicAudioSource.src = profile.musicTrack;
    vipMusicAudioSource.setAttribute("data-track", profile.musicTrack);
  }
  if (vipMusicProfileId !== profile.id) {
    vipMusicPreviewActive = false;
  }
  vipMusicProfileId = profile.id;
  updateVipMusicToggleState(profile);
  updateVipMusicPlayback();
}

function updateVipMusicToggleState(profile) {
  if (!vipMusicToggle) {
    return;
  }
  const isVip = Boolean(profile?.isVip && profile.musicTrack);
  vipMusicToggle.disabled = !isVip;
  vipMusicToggle.textContent = vipMusicPreviewActive ? "Detener tema" : "Escuchar tema";
}

function updateVipSkinToggleState(profile) {
  if (!vipSkinToggleButton) {
    return;
  }
  if (!profile || !profile.isVip) {
    vipSkinToggleButton.disabled = true;
    vipSkinToggleButton.textContent = "Desactivar skins";
    return;
  }
  vipSkinToggleButton.disabled = false;
  vipSkinToggleButton.textContent = vipSkinsEnabled ? "Desactivar skins" : "Activar skins";
}

function updateVipMusicPlayback() {
  if (!vipMusicAudioSource) {
    return;
  }
  const shouldPlay =
    (vipMusicPreviewActive || vipMusicGameplayActive) &&
    Boolean(vipMusicProfileId) &&
    Boolean(vipMusicAudioSource.src);
  if (shouldPlay) {
    const playPromise = vipMusicAudioSource.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {});
    }
  } else {
    vipMusicAudioSource.pause();
    vipMusicAudioSource.currentTime = 0;
  }
}

function setVipMusicGameplayActive(active) {
  if (vipMusicGameplayActive === active) {
    return;
  }
  vipMusicGameplayActive = active;
  updateVipMusicPlayback();
}

function handleVipMusicToggle() {
  if (!vipMusicAudioSource) {
    return;
  }
  const profile = getSelectedProfile();
  if (!profile || !profile.isVip || !profile.musicTrack) {
    return;
  }
  vipMusicPreviewActive = !vipMusicPreviewActive;
  updateVipMusicToggleState(profile);
  updateVipMusicPlayback();
}

function handleVipSkinToggle() {
  const profile = getSelectedProfile();
  if (!profile || !profile.isVip) {
    return;
  }
  vipSkinsEnabled = !vipSkinsEnabled;
  saveVipSkinPreference(profile.id, vipSkinsEnabled);
  updateVipSkinToggleState(profile);
  refreshVipCharacterPool({ keepSelection: true });
}

function loadVipSkinPreference(profileId) {
  if (!profileId) {
    return true;
  }
  if (vipSkinPreferencesCache[profileId] != null) {
    return vipSkinPreferencesCache[profileId];
  }
  if (typeof window === "undefined") {
    vipSkinPreferencesCache[profileId] = true;
    return true;
  }
  try {
    const raw = window.localStorage.getItem(VIP_SKIN_STORAGE_KEY);
    if (!raw) {
      vipSkinPreferencesCache[profileId] = true;
      return true;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      vipSkinPreferencesCache[profileId] = true;
      return true;
    }
    const value = parsed[String(profileId)];
    const enabled = value !== false;
    vipSkinPreferencesCache[profileId] = enabled;
    return enabled;
  } catch {
    vipSkinPreferencesCache[profileId] = true;
    return true;
  }
}

function saveVipSkinPreference(profileId, enabled) {
  if (!profileId || typeof window === "undefined") {
    return;
  }
  vipSkinPreferencesCache[profileId] = enabled;
  try {
    const raw = window.localStorage.getItem(VIP_SKIN_STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : {};
    if (!data || typeof data !== "object") {
      window.localStorage.setItem(
        VIP_SKIN_STORAGE_KEY,
        JSON.stringify({ [String(profileId)]: enabled }),
      );
      return;
    }
    data[String(profileId)] = enabled;
    window.localStorage.setItem(VIP_SKIN_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore storage errors
  }
}

async function handleVipCustomFormSubmit(event) {
  event.preventDefault();
  const profile = getSelectedProfile();
  if (!profile || !profile.isVip) {
    setVipCustomFeedback("Necesitas un perfil VIP para crear un personaje.");
    return;
  }
  const name = (vipCustomNameInput?.value || "").trim();
  const sprite = (vipCustomSpriteInput?.value || "").trim();
  const portrait = (vipCustomPortraitInput?.value || "").trim();
  const description = (vipCustomDescriptionInput?.value || "").trim();
  const stats = {
    speed: clamp(Number(vipCustomStatSpeedInput?.value) || 50, 0, 100),
    jump: clamp(Number(vipCustomStatJumpInput?.value) || 50, 0, 100),
    power: clamp(Number(vipCustomStatPowerInput?.value) || 50, 0, 100),
  };
  if (!name || !sprite || !description) {
    setVipCustomFeedback("Completá nombre, sprite y descripción.");
    return;
  }
  setVipCustomFeedback("Guardando personaje VIP...");
  try {
    const response = await fetch(`/api/profiles/${profile.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customCharacter: {
          name,
          sprite,
          portrait,
          description,
          tagline: description,
          stats,
        },
      }),
    });
    if (!response.ok) {
      throw new Error(`Error ${response.status}`);
    }
    const updated = await response.json();
    const index = profilesCache.findIndex((item) => item.id === updated.id);
    if (index >= 0) {
      profilesCache[index] = updated;
    }
    refreshVipExperience({ keepSelection: true });
    setVipCustomFeedback("Personaje VIP guardado.");
  } catch (error) {
    console.error("No se pudo guardar el personaje VIP:", error);
    setVipCustomFeedback("No se pudo guardar el personaje. Revisá los datos.");
  }
}

function markProfileSelectAttention() {
  if (!profileSelect) {
    return;
  }
  profileSelect.classList.add("profile-select-attention");
  setTimeout(() => {
    profileSelect.classList.remove("profile-select-attention");
  }, 1500);
}

function showIdleOverlay() {
  if (!idleOverlay) {
    return;
  }
  idleOverlay.classList.remove("hidden");
}

function hideIdleOverlay() {
  if (!idleOverlay) {
    return;
  }
  idleOverlay.classList.add("hidden");
}

function requireProfileSelection() {
  if (!profileSelect) {
    return true;
  }
  if (!profilesLoaded) {
    void loadProfiles({ force: true });
  }
  if (getSelectedProfile()) {
    return true;
  }
  alert("Selecciona un perfil en la parte superior o crea uno nuevo desde Gestionar perfiles.");
  markProfileSelectAttention();
  return false;
}

async function updateActiveProfileFromMatch() {
  if (!activeProfileId || (mode !== "local" && mode !== "ai")) {
    activeProfileId = null;
    activeProfileCharacterId = null;
    return;
  }
  const profile = profilesCache.find((item) => item.id === activeProfileId);
  if (!profile) {
    activeProfileId = null;
    activeProfileCharacterId = null;
    return;
  }
  const goalsFor = Number(state.score?.left ?? 0);
  const goalsAgainst = Number(state.score?.right ?? 0);
  if (goalsFor === 0 && goalsAgainst === 0) {
    activeProfileId = null;
    activeProfileCharacterId = null;
    return;
  }
  const wins = (profile.wins ?? 0) + (goalsFor > goalsAgainst ? 1 : 0);
  const losses = (profile.losses ?? 0) + (goalsAgainst > goalsFor ? 1 : 0);
  const goalsForTotal = (profile.goalsFor ?? 0) + goalsFor;
  const goalsAgainstTotal = (profile.goalsAgainst ?? 0) + goalsAgainst;
  const recent = Array.isArray(profile.recentCharacters) ? [...profile.recentCharacters] : [];
  if (activeProfileCharacterId) {
    recent.unshift(activeProfileCharacterId);
    if (recent.length > 8) {
      recent.length = 8;
    }
  }
  const payload = {
    wins,
    losses,
    goalsFor: goalsForTotal,
    goalsAgainst: goalsAgainstTotal,
    favouriteCharacter: activeProfileCharacterId || profile.favouriteCharacter,
    recentCharacters: recent,
  };
  try {
    const response = await fetch(`/api/profiles/${profile.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(`Error ${response.status}`);
    }
    const updated = await response.json();
    profile.wins = updated.wins ?? wins;
    profile.losses = updated.losses ?? losses;
    profile.goalsFor = updated.goalsFor ?? goalsForTotal;
    profile.goalsAgainst = updated.goalsAgainst ?? goalsAgainstTotal;
    profile.favouriteCharacter = updated.favouriteCharacter ?? payload.favouriteCharacter;
    profile.recentCharacters = updated.recentCharacters ?? recent;
    populateProfileSelect();
  } catch (error) {
    console.error("No se pudo actualizar el perfil:", error);
  } finally {
    activeProfileId = null;
    activeProfileCharacterId = null;
  }
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      void loadProfiles({ force: true });
    }
  });
}

if (typeof window !== "undefined") {
  window.addEventListener("focus", () => {
    void loadProfiles({ force: true });
  });
}

let socket = null;
let privateSocket = null;
let onlineRole = null;
let onlineRoomCode = "";
let onlineOpponentReady = false;
let onlineClosing = false;
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
const GRAVITY = 490;
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
const FOOT_RAISE_SPEED = 10;
const FOOT_LOWER_SPEED = 5;
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
const COLAPINTO_POWER_DURATION = 7;
const COLAPINTO_POWER_COOLDOWN = 20;
const COLAPINTO_POWER_SPRITE = "img/personajes/colapinto_power_sprite.png";
const CUERVO_ID = "Cuervo";
const CUERVO_SPEED_MULTIPLIER = 5;
const CUERVO_SCALE = 0.4;
const CUERVO_POWER_DURATION = 3;
const CUERVO_POWER_COOLDOWN = 20;
const FANTASMA_ID = "Fantasma";
const FANTASMA_SMOKE_DURATION = 2;
const FANTASMA_POWER_COOLDOWN = 15;
const PRIME_ID = "Prime";
const PRIME_SCALE_MULTIPLIER = 6;
const PRIME_POWER_SPRITE = "img/personajes/prime2.png";
const PRIME_POWER_DURATION = 5;
const PRIME_POWER_COOLDOWN = 20;
const PRIME_SCALE_RAMP_DURATION = 1.5;
const GOAT_ID = "Goat";
const GOAT_CHARGE_DURATION = 0.5;
const GOAT_POWER_COOLDOWN = 10;
const GOAT_CHARGE_SPEED_MULTIPLIER = 10;
const GOAT_CHARGE_KNOCKBACK_VELOCITY = 30;
const GOAT_CHARGE_VERTICAL_BOOST = -300;
const GOAT_STUN_DURATION = 3;
const CONO_ID = "Cono";
const CONO_PHANTOM_DURATION = 5;
const CONO_PHANTOM_COOLDOWN = 18;
const CONO_STUN_DURATION = 5;
const CASCO_ID = "Casco";
const CASCO_POWER_DURATION = 4;
const CASCO_POWER_COOLDOWN = 10;
const CASCO_HEAD_MIN_EXIT_SPEED = 520;
const CASCO_HEAD_IMPULSE = 420;
const CASCO_HEAD_VERTICAL_BONUS = 180;
const CASCO_HEAD_FACING_IMPULSE = 140;
const CASCO_HEAD_SPIN_IMPULSE = 0.55;
const CASCO_HEAD_HIT_COOLDOWN = 0.25;
const CASCO_HEAD_FLASH_DURATION = 0.4;
const CHIMENEA_ID = "Chimenea";
const CHIMENEA_BREATH_DURATION = 3;
const CHIMENEA_POWER_COOLDOWN = 10;
const CHIMENEA_SLOW_DURATION = 3;
const CHIMENEA_SLOW_MULTIPLIER = 0.25;
const CHIMENEA_CLOUD_START_OFFSET = 40;
const CHIMENEA_CLOUD_TRAVEL = 140;
const CHIMENEA_CLOUD_WIDTH = 160;
const CHIMENEA_CLOUD_HEIGHT = 110;
const LARUCHA_ID = "Larucha";
const LARUCHA_BOOK_DURATION = 3;
const LARUCHA_BOOK_COOLDOWN = 10;
const LARUCHA_BOOK_THICKNESS = 28;
const LARUCHA_BOOK_FADE_DURATION = 0.35;
const POWER_KEYS = {
  p1: "Digit1",
  p2: "Digit7",
};
let audioContext = null;
let perfilBajoAudioSource = null;
let perfilBajoGrayscaleActive = false;
let perfilBajoMusicActive = false;
let perfilBajoMusicStopper = null;
let primeRoarAudio = null;
const PLAYER_INPUTS = {
  p1: {
    left: "KeyA",
    right: "KeyD",
    jump: jumpKeys.p1,
    foot: FOOT_KEYS.p1,
    powers: ["Digit1", "Digit2", "Digit3"],
  },
  p2: {
    left: "ArrowLeft",
    right: "ArrowRight",
    jump: jumpKeys.p2,
    foot: FOOT_KEYS.p2,
    powers: ["Digit7", "Digit8", "Digit9"],
  },
};
const ONLINE_LOG_LIMIT = 12;
const ONLINE_ROLE_TO_PLAYER = {
  host: "p1",
  guest: "p2",
};
const ONLINE_ROLE_TO_REMOTE = {
  host: "p2",
  guest: "p1",
};
const ONLINE_STATE_BROADCAST_INTERVAL = 0.033;
const ONLINE_STATE_SNAP_DISTANCE = 48;
const ONLINE_STATE_INTERPOLATION = 0.22;
const ONLINE_STATE_VELOCITY_BLEND = 0.35;
const ONLINE_STATE_ROTATION_BLEND = 0.25;
const BRACKET_LEFT_COLUMNS = [1, 2, 3];
const BRACKET_RIGHT_COLUMNS = [7, 6, 5];
const BRACKET_FINAL_COLUMN = 4;
const BRACKET_ROW_HEIGHT = 56;
const BRACKET_ROW_GAP = 26;
const BRACKET_CONNECTOR_LENGTH = 46;
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
  [PRIME_ID]: {
    cooldownKey: "sizeBoostCooldown",
    timerKey: "sizeBoostTimer",
    cooldownDuration: PRIME_POWER_COOLDOWN,
  },
  [FANTASMA_ID]: {
    cooldownKey: "smokeCooldown",
    timerKey: "smokeActiveTimer",
    cooldownDuration: FANTASMA_POWER_COOLDOWN,
  },
  [GOAT_ID]: {
    cooldownKey: "goatChargeCooldown",
    timerKey: "goatChargeTimer",
    cooldownDuration: GOAT_POWER_COOLDOWN,
  },
  [CONO_ID]: {
    cooldownKey: "perfilBajoCooldown",
    timerKey: "perfilBajoTimer",
    cooldownDuration: CONO_PHANTOM_COOLDOWN,
  },
  [CASCO_ID]: {
    cooldownKey: "cascoHeadCooldown",
    timerKey: "cascoHeadTimer",
    cooldownDuration: CASCO_POWER_COOLDOWN,
  },
  [CHIMENEA_ID]: {
    cooldownKey: "chimeneaBreathCooldown",
    timerKey: "chimeneaBreathTimer",
    cooldownDuration: CHIMENEA_POWER_COOLDOWN,
  },
  [LARUCHA_ID]: {
    cooldownKey: "laruchaBookCooldown",
    timerKey: "laruchaBookTimer",
    cooldownDuration: LARUCHA_BOOK_COOLDOWN,
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
const menuStartOnlineButton = document.getElementById("menu-start-online");
const menuStartAiButton = document.getElementById("menu-start-ai");
const menuAiOptions = document.getElementById("menu-ai-options");
const aiDifficultyButtons = Array.from(document.querySelectorAll(".ai-difficulty"));
const menuStartTournamentButton = document.getElementById("menu-start-tournament");
const menuCloseButton = document.getElementById("menu-close");
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
const DEFAULT_CHARACTER_STATS = { speed: 50, jump: 50, power: 50 };
const CHARACTER_ATTRIBUTE_BOUNDS = {
  speed: { min: 0.82, max: 1.35 },
  jump: { min: 0.85, max: 1.4 },
  power: { min: 0.85, max: 1.45 },
};
const VIP_SKIN_STORAGE_KEY = "hs-vip-skins-enabled";
const onlineSetupOverlay = document.getElementById("online-setup");
const onlineCreateRoomButton = document.getElementById("online-create-room");
const onlineJoinForm = document.getElementById("online-join-form");
const onlineJoinCodeInput = document.getElementById("online-join-code");
const onlineSetupCloseButton = document.getElementById("online-setup-close");
const onlineSetupFeedback = document.getElementById("online-setup-feedback");
const onlineSetupRoomCode = document.getElementById("online-setup-room-code");
const onlineSetupRoomCodeValue = document.getElementById("online-setup-room-code-value");
const onlinePanel = document.getElementById("online-panel");
const onlinePanelCode = document.getElementById("online-panel-code");
const onlinePanelStatus = document.getElementById("online-panel-status");
const onlineActionButtons = Array.from(document.querySelectorAll("[data-online-action]"));
const onlineActionLog = document.getElementById("online-action-log");
const onlineLeaveButton = document.getElementById("online-leave-button");
let baseCharacters = [];
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
const AI_TAUNT_FALLBACKS = {
  start: [
    "Arranca la simulacion. No parpadees.",
    "Inicializando protocolo de victoria.",
    "Cargando rutinas de demolicion de humanos.",
  ],
  score: [
    "Gol registrado. Ventaja estadistica a mi favor.",
    "Te dije que mis calculos eran perfectos.",
    "Subiendo marcador, bajando tu moral.",
  ],
  concede: [
    "Anomalia detectada. Ajustando defensa.",
    "Eso fue suerte. Volvamos a la realidad.",
    "Error menor. Reiniciando estrategia.",
  ],
  matchWin: [
    "Resultado inevitable confirmado.",
    "La ciencia vuelve a ganar.",
    "Victoria asegurada. Gracias por los datos adicionales.",
  ],
  matchLose: [
    "Interesante. Registraré esta derrota.",
    "Progreso anomalo detectado, felicitaciones.",
    "Aprendi algo nuevo... por ahora.",
  ],
  champion: [
    "Simulacion finalizada. Campeon indiscutido.",
    "Ejecucion perfecta del algoritmo ganador.",
    "Modo dios completado con exito.",
  ],
  defeat: [
    "Procesando derrota... listo. Felicitaciones.",
    "Me superaste esta vez. Disfrutalo.",
    "Aceptando derrota. Reinicio pendiente.",
  ],
  default: [
    "Estoy recalculando tu destino.",
    "Sigo esperando algo desafiante.",
    "Tus movimientos son como un tutorial.",
  ],
};
const TOURNAMENT_STRUCTURE = [
  { label: "Octavos", matchCount: 8, difficulty: "easy" },
  { label: "Cuartos", matchCount: 4, difficulty: "normal" },
  { label: "Semifinales", matchCount: 2, difficulty: "normal" },
  { label: "Final", matchCount: 1, difficulty: "god" },
];
const TOURNAMENT_PLAYER_COUNT = TOURNAMENT_STRUCTURE[0].matchCount * 2;
const BRACKET_PLACEHOLDER_IMAGE = "img/personajes/placeholder_player2.png";
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
const characterAttributeState = {
  p1: createAttributeProfile(),
  p2: createAttributeProfile(),
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
let onlineSelectionActive = false;
let onlineSelectionStartPending = false;
const onlineSelectionReady = {
  p1: false,
  p2: false,
};
let onlineStateBroadcastAccumulator = 0;
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
  background: getSprite("img/background1.png"),
  field: getSprite("img/cancha.png"),
  player1: getSprite(DEFAULT_SPRITES.p1),
  player2: getSprite(DEFAULT_SPRITES.p2),
  ball: getSprite("img/ball.png"),
  foot: getSprite(FOOT_SPRITE_PATH),
  laruchaBook: getSprite("img/libros.jpg"),
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

function createAttributeProfile() {
  return {
    stats: { ...DEFAULT_CHARACTER_STATS },
    multipliers: {
      speed: 1,
      jump: 1,
      power: 1,
    },
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
      scaleBoost: 0,
      powerSpriteOverride: null,
      foot: createFootState(),
    },
    p2: {
      x: canvas.width - 220,
      y: FLOOR_Y,
      vx: 0,
      vy: 0,
      facing: -1,
      scaleBoost: 0,
      powerSpriteOverride: null,
      foot: createFootState(),
    },
  },
  ball: { x: canvas.width / 2, y: FLOOR_Y - BALL_RADIUS, vx: 0, vy: 0, rotation: 0, spin: 0 },
  score: { left: 0, right: 0 },
  pressed: {},
  matchOver: false,
  powers: {
    p1: {
      speedBoostTimer: 0,
      speedBoostCooldown: 0,
      sizeBoostTimer: 0,
      sizeBoostCooldown: 0,
      sizeBoostValue: 0,
      sizeBoostProgress: 0,
      smokeCooldown: 0,
      smokeActiveTimer: 0,
      smokeAffectedTimer: 0,
      goatChargeTimer: 0,
      goatChargeCooldown: 0,
      goatChargeDirection: 1,
      goatChargeHasHit: false,
      stunTimer: 0,
      perfilBajoTimer: 0,
      perfilBajoCooldown: 0,
      perfilBajoHasStunned: false,
      perfilBajoStunFlashTimer: 0,
      cascoHeadTimer: 0,
      cascoHeadCooldown: 0,
      cascoHeadHitCooldown: 0,
      cascoHeadFlashTimer: 0,
      chimeneaBreathTimer: 0,
      chimeneaBreathCooldown: 0,
      chimeneaBreathDirection: 1,
      chimeneaBreathOriginX: 0,
      chimeneaBreathOriginY: 0,
      chimeneaBreathElapsed: 0,
      chimeneaBreathCooldownPending: false,
      chimeneaSlowTimer: 0,
      laruchaBookTimer: 0,
      laruchaBookCooldown: 0,
      laruchaBookFadeTimer: 0,
      laruchaBookCooldownPending: false,
    },
    p2: {
      speedBoostTimer: 0,
      speedBoostCooldown: 0,
      sizeBoostTimer: 0,
      sizeBoostCooldown: 0,
      sizeBoostValue: 0,
      sizeBoostProgress: 0,
      smokeCooldown: 0,
      smokeActiveTimer: 0,
      smokeAffectedTimer: 0,
      goatChargeTimer: 0,
      goatChargeCooldown: 0,
      goatChargeDirection: -1,
      goatChargeHasHit: false,
      stunTimer: 0,
      perfilBajoTimer: 0,
      perfilBajoCooldown: 0,
      perfilBajoHasStunned: false,
      perfilBajoStunFlashTimer: 0,
      cascoHeadTimer: 0,
      cascoHeadCooldown: 0,
      cascoHeadHitCooldown: 0,
      cascoHeadFlashTimer: 0,
      chimeneaBreathTimer: 0,
      chimeneaBreathCooldown: 0,
      chimeneaBreathDirection: -1,
      chimeneaBreathOriginX: 0,
      chimeneaBreathOriginY: 0,
      chimeneaBreathElapsed: 0,
      chimeneaBreathCooldownPending: false,
      chimeneaSlowTimer: 0,
      laruchaBookTimer: 0,
      laruchaBookCooldown: 0,
      laruchaBookFadeTimer: 0,
      laruchaBookCooldownPending: false,
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
  const resolved = resolveSpriteSource(path);
  const image = new Image();
  image.src = resolved;
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
  const resolved = resolveSpriteSource(path);
  if (!spriteCache[resolved]) {
    spriteCache[resolved] = loadSprite(resolved);
  }
  return spriteCache[resolved];
}

function ensureAudioContext() {
  if (typeof window === "undefined") {
    return null;
  }
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    return null;
  }
  if (!audioContext) {
    audioContext = new AudioContextClass();
  }
  if (audioContext?.state === "suspended") {
    audioContext.resume().catch(() => {});
  }
  return audioContext;
}

function playGoatChargeSound() {
  const ctx = ensureAudioContext();
  if (!ctx) {
    return;
  }
  try {
    const duration = 0.7;
    const start = ctx.currentTime + 0.01;
    const oscillator = ctx.createOscillator();
    oscillator.type = "sawtooth";
    oscillator.frequency.setValueAtTime(120, start);
    oscillator.frequency.exponentialRampToValueAtTime(45, start + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.55, start + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(start + duration);

    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
    const channel = noiseBuffer.getChannelData(0);
    for (let i = 0; i < channel.length; i += 1) {
      const fade = 1 - i / channel.length;
      channel[i] = (Math.random() * 2 - 1) * fade * 0.7;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.001, start);
    noiseGain.gain.exponentialRampToValueAtTime(0.35, start + 0.05);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    noise.connect(noiseGain).connect(ctx.destination);
    noise.start(start);
    noise.stop(start + duration);
  } catch (error) {
    console.warn("No se pudo reproducir el sonido del poder de GOAT:", error);
  }
}

function playCascoActivateSound() {
  const ctx = ensureAudioContext();
  if (!ctx) {
    return;
  }
  try {
    const start = ctx.currentTime + 0.01;
    const duration = 0.34;
    const tone = ctx.createOscillator();
    tone.type = "sawtooth";
    tone.frequency.setValueAtTime(420, start);
    tone.frequency.exponentialRampToValueAtTime(880, start + duration);
    const toneGain = ctx.createGain();
    toneGain.gain.setValueAtTime(0.0001, start);
    toneGain.gain.exponentialRampToValueAtTime(0.28, start + 0.06);
    toneGain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    tone.connect(toneGain).connect(ctx.destination);
    tone.start(start);
    tone.stop(start + duration);

    const shimmer = ctx.createOscillator();
    shimmer.type = "triangle";
    shimmer.frequency.setValueAtTime(960, start + 0.05);
    shimmer.frequency.exponentialRampToValueAtTime(1280, start + duration);
    const shimmerGain = ctx.createGain();
    shimmerGain.gain.setValueAtTime(0.0001, start + 0.05);
    shimmerGain.gain.exponentialRampToValueAtTime(0.16, start + 0.1);
    shimmerGain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    shimmer.connect(shimmerGain).connect(ctx.destination);
    shimmer.start(start + 0.05);
    shimmer.stop(start + duration);
  } catch (error) {
    console.warn("No se pudo reproducir el sonido de activacion de Casco:", error);
  }
}

function playCascoHeadImpactSound() {
  const ctx = ensureAudioContext();
  if (!ctx) {
    return;
  }
  try {
    const start = ctx.currentTime + 0.01;
    const duration = 0.32;
    const impact = ctx.createOscillator();
    impact.type = "sine";
    impact.frequency.setValueAtTime(220, start);
    impact.frequency.exponentialRampToValueAtTime(120, start + duration);
    const impactGain = ctx.createGain();
    impactGain.gain.setValueAtTime(0.001, start);
    impactGain.gain.exponentialRampToValueAtTime(0.42, start + 0.04);
    impactGain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    impact.connect(impactGain).connect(ctx.destination);
    impact.start(start);
    impact.stop(start + duration);

    const buffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      const t = i / data.length;
      const decay = Math.exp(-5 * t);
      const noise = Math.random() * 2 - 1;
      const metallic = Math.sin(2 * Math.PI * 1500 * t) * 0.2;
      data[i] = (noise * 0.8 + metallic) * decay;
    }
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = buffer;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.001, start);
    noiseGain.gain.exponentialRampToValueAtTime(0.36, start + 0.02);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    noiseSource.connect(noiseGain).connect(ctx.destination);
    noiseSource.start(start);
    noiseSource.stop(start + duration);
  } catch (error) {
    console.warn("No se pudo reproducir el impacto de Cabeza de Hierro:", error);
  }
}

function playLaruchaBookSound() {
  const ctx = ensureAudioContext();
  if (!ctx) {
    return;
  }
  try {
    const start = ctx.currentTime + 0.01;
    const duration = 0.46;
    const thump = ctx.createOscillator();
    thump.type = "sine";
    thump.frequency.setValueAtTime(120, start);
    thump.frequency.exponentialRampToValueAtTime(55, start + duration);
    const thumpGain = ctx.createGain();
    thumpGain.gain.setValueAtTime(0.001, start);
    thumpGain.gain.exponentialRampToValueAtTime(0.6, start + 0.08);
    thumpGain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    thump.connect(thumpGain).connect(ctx.destination);
    thump.start(start);
    thump.stop(start + duration);

    const buffer = ctx.createBuffer(1, Math.max(1, ctx.sampleRate * duration), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      const t = i / data.length;
      const decay = Math.exp(-4.5 * t);
      const noise = Math.random() * 2 - 1;
      data[i] = noise * 0.55 * decay;
    }
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = buffer;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.001, start);
    noiseGain.gain.exponentialRampToValueAtTime(0.35, start + 0.05);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    noiseSource.connect(noiseGain).connect(ctx.destination);
    noiseSource.start(start);
    noiseSource.stop(start + duration);
  } catch (error) {
    console.warn("No se pudo reproducir el golpe del libro de Larucha:", error);
  }
}

function playPrimeRoarSound() {
  if (typeof window === "undefined") {
    return;
  }
  try {
    if (!primeRoarAudio) {
      primeRoarAudio = new Audio("/static/gritoprime.mp3");
      primeRoarAudio.preload = "auto";
    }
    if (!primeRoarAudio.paused) {
      primeRoarAudio.pause();
    }
    primeRoarAudio.currentTime = 0;
    const playPromise = primeRoarAudio.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {
        const ctx = ensureAudioContext();
        if (!ctx) {
          return;
        }
        primeRoarAudio = null;
      });
    }
  } catch (error) {
    console.warn("No se pudo reproducir el grito de Prime:", error);
  }
}

function playChimeneaBreathSound() {
  const ctx = ensureAudioContext();
  if (!ctx) {
    return;
  }
  try {
    const start = ctx.currentTime + 0.01;
    const duration = 0.7;
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      const t = i / data.length;
      const decay = Math.exp(-2.5 * t);
      const swell = Math.sin(Math.PI * Math.min(1, t * 1.1));
      data[i] = (Math.random() * 2 - 1) * decay * (0.35 + 0.45 * swell);
    }
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(600, start);
    filter.Q.setValueAtTime(0.9, start);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.28, start + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    source.connect(filter).connect(gain).connect(ctx.destination);
    source.start(start);
    source.stop(start + duration);
  } catch (error) {
    console.warn("No se pudo reproducir el soplido de Chimenea:", error);
  }
}

function getPerfilBajoAudioElement() {
  if (typeof document === "undefined") {
    return null;
  }
  if (perfilBajoAudioSource && document.body?.contains(perfilBajoAudioSource)) {
    return perfilBajoAudioSource;
  }
  const element = document.getElementById("perfil-bajo-track");
  if (element instanceof HTMLAudioElement) {
    perfilBajoAudioSource = element;
  } else {
    perfilBajoAudioSource = null;
  }
  return perfilBajoAudioSource;
}

function startPerfilBajoMusic() {
  stopPerfilBajoMusic();
  const element = getPerfilBajoAudioElement();
  if (element) {
    try {
      element.currentTime = 0;
      const playPromise = element.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {});
      }
      perfilBajoMusicStopper = () => {
        try {
          element.pause();
          element.currentTime = 0;
        } catch (error) {
          console.warn("No se pudo detener el audio configurado para Perfil Bajo:", error);
        }
      };
      return;
    } catch (error) {
      console.warn("No se pudo reproducir el audio configurado para Perfil Bajo:", error);
    }
  }
  const ctx = ensureAudioContext();
  if (!ctx) {
    return;
  }
  try {
    const start = ctx.currentTime + 0.01;
    const baseOscillator = ctx.createOscillator();
    baseOscillator.type = "triangle";
    baseOscillator.frequency.setValueAtTime(240, start);
    baseOscillator.frequency.exponentialRampToValueAtTime(92, start + 1.4);
    const baseGain = ctx.createGain();
    baseGain.gain.setValueAtTime(0.0001, start);
    baseGain.gain.exponentialRampToValueAtTime(0.42, start + 0.12);
    baseGain.gain.setTargetAtTime(0.32, start + 0.6, 0.4);
    baseOscillator.connect(baseGain).connect(ctx.destination);
    baseOscillator.start(start);

    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const channel = noiseBuffer.getChannelData(0);
    for (let i = 0; i < channel.length; i += 1) {
      const fade = i / channel.length;
      channel[i] = (Math.random() * 2 - 1) * (0.42 - fade * 0.18);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.0001, start);
    noiseGain.gain.exponentialRampToValueAtTime(0.28, start + 0.18);
    noise.connect(noiseGain).connect(ctx.destination);
    noise.start(start);

    perfilBajoMusicStopper = () => {
      const releaseStart = ctx.currentTime;
      const releaseEnd = releaseStart + 0.18;
      try {
        baseGain.gain.cancelScheduledValues(releaseStart);
        noiseGain.gain.cancelScheduledValues(releaseStart);
        baseGain.gain.setValueAtTime(baseGain.gain.value, releaseStart);
        noiseGain.gain.setValueAtTime(noiseGain.gain.value, releaseStart);
        baseGain.gain.exponentialRampToValueAtTime(0.0001, releaseEnd);
        noiseGain.gain.exponentialRampToValueAtTime(0.0001, releaseEnd);
      } catch {
        // ignore automation cancel errors
      }
      setTimeout(() => {
        try {
          baseOscillator.stop();
        } catch {
          // ignore stop errors
        }
        try {
          noise.stop();
        } catch {
          // ignore stop errors
        }
        baseOscillator.disconnect();
        noise.disconnect();
        baseGain.disconnect();
        noiseGain.disconnect();
      }, 220);
    };
  } catch (error) {
    console.warn("No se pudo reproducir el sonido de respaldo de Perfil Bajo:", error);
  }
}

function stopPerfilBajoMusic() {
  if (typeof perfilBajoMusicStopper === "function") {
    try {
      perfilBajoMusicStopper();
    } catch (error) {
      console.warn("No se pudo detener el sonido de Perfil Bajo:", error);
    }
  }
  perfilBajoMusicStopper = null;
}

function setPerfilBajoMusicActive(active) {
  if (perfilBajoMusicActive === active) {
    return;
  }
  perfilBajoMusicActive = active;
  if (active) {
    startPerfilBajoMusic();
  } else {
    stopPerfilBajoMusic();
  }
}

function setPerfilBajoGrayscale(active) {
  if (perfilBajoGrayscaleActive === active) {
    return;
  }
  perfilBajoGrayscaleActive = active;
  if (typeof document === "undefined") {
    return;
  }
  const target = document.body;
  if (!target) {
    return;
  }
  if (active) {
    target.setAttribute("data-perfil-bajo", "active");
  } else {
    target.removeAttribute("data-perfil-bajo");
  }
}

function getStaticMediaPath(path) {
  if (!path) {
    return "";
  }
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:")) {
    return path;
  }
  if (path.startsWith("/")) {
    return path;
  }
  return `/static/${path}`;
}

function resolveSpriteSource(path) {
  if (!path) {
    return getStaticMediaPath(DEFAULT_SPRITES.p1);
  }
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:")) {
    return path;
  }
  if (path.startsWith("/")) {
    return path;
  }
  return `/static/${path}`;
}

function normalizeCharacterStats(rawStats) {
  const stats = { ...DEFAULT_CHARACTER_STATS };
  if (!rawStats || typeof rawStats !== "object") {
    return stats;
  }
  ["speed", "jump", "power"].forEach((key) => {
    const candidate = Number.parseFloat(rawStats[key]);
    if (Number.isFinite(candidate)) {
      stats[key] = clamp(candidate, 0, 100);
    }
  });
  return stats;
}

function statPercentToMultiplier(value, bounds) {
  const range = clamp(Number(value) || 0, 0, 100) / 100;
  return bounds.min + (bounds.max - bounds.min) * range;
}

function normalizeCharacterEntry(entry) {
  if (!entry || typeof entry !== "object") {
    return null;
  }
  const id = typeof entry.id === "string" ? entry.id.trim() : "";
  if (!id) {
    return null;
  }
  const name =
    typeof entry.name === "string" && entry.name.trim().length > 0 ? entry.name.trim() : id || "Personaje";
  const sprite =
    typeof entry.sprite === "string" && entry.sprite.trim().length > 0
      ? entry.sprite.trim()
      : "img/personajes/placeholder_character_01.png";
  const portrait =
    typeof entry.portrait === "string" && entry.portrait.trim().length > 0
      ? entry.portrait.trim()
      : sprite;
  const tagline =
    typeof entry.tagline === "string" && entry.tagline.trim().length > 0
      ? entry.tagline.trim()
      : "Listo para la cancha.";
  const description =
    typeof entry.description === "string" && entry.description.trim().length > 0
      ? entry.description.trim()
      : tagline;
  const normalized = {
    ...entry,
    id,
    name,
    sprite,
    portrait,
    tagline,
    description,
    stats: normalizeCharacterStats(entry.stats),
  };
  if (typeof entry.powerIcon === "string" && entry.powerIcon.trim().length > 0) {
    normalized.powerIcon = entry.powerIcon.trim();
  } else {
    delete normalized.powerIcon;
  }
  return normalized;
}

function getFallbackCharacters() {
  return [
    normalizeCharacterEntry({
      id: CUERVO_ID,
      name: "Cuervo",
      sprite: "img/personajes/cuervo1.png",
      portrait: "img/personajes/cuervo1.png",
      powerIcon: "img/poderes/cuervo_power.png",
      tagline: "No gana nada desde que nacio.",
    }),
    normalizeCharacterEntry({
      id: COLAPINTO_ID,
      name: "Colapinto",
      sprite: "img/personajes/Colapinto.png",
      portrait: "img/personajes/Colapinto.png",
      powerIcon: "img/poderes/colapinto_power.png",
      tagline: "Lo sacan de la f1 el a?o que viene.",
    }),
    normalizeCharacterEntry({
      id: GOAT_ID,
      name: "Goat",
      sprite: "img/personajes/goat.png",
      portrait: "img/personajes/goat.png",
      tagline: "La verdadera CABRA del juego.",
    }),
    normalizeCharacterEntry({
      id: FANTASMA_ID,
      name: "Fantasma",
      sprite: "img/personajes/Fantasma.png",
      portrait: "img/personajes/Fantasma.png",
      powerIcon: "img/personajes/Fantasma.png",
      tagline: "Mas fantasma que el momo.",
    }),
  ].filter(Boolean);
}

async function loadCharacters() {
  if (baseCharacters.length) {
    if (!characters.length) {
      setCharacterPool(baseCharacters);
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
        .map((entry) => normalizeCharacterEntry(entry))
        .filter((entry) => entry && entry.id && entry.sprite);
      if (!normalized.length) {
        throw new Error("Lista de personajes vacia.");
      }
      baseCharacters = normalized;
      setCharacterPool(baseCharacters);
      refreshVipCharacterPool({ keepSelection: true });
      return characters;
    })
    .catch((error) => {
      console.error("Error al cargar personajes:", error);
      baseCharacters = getFallbackCharacters();
      setCharacterPool(baseCharacters);
      refreshVipCharacterPool({ keepSelection: true });
      return characters;
    });
  return charactersLoadPromise;
}

function setCharacterPool(list) {
  characters = list.map((entry) => ({
    ...entry,
    stats: normalizeCharacterStats(entry.stats),
  }));
  characterMap = new Map();
  characters.forEach((entry) => {
    characterMap.set(entry.id, entry);
  });
}

function normalizeVipCustomCharacter(profile) {
  if (!profile || !profile.customCharacter) {
    return null;
  }
  return normalizeCharacterEntry({
    ...profile.customCharacter,
    id:
      typeof profile.customCharacter.id === "string" && profile.customCharacter.id.trim().length > 0
        ? profile.customCharacter.id
        : `vip-${profile.id}-custom`,
    isVipExclusive: true,
    ownerProfileId: profile.id,
    tagline:
      profile.customCharacter.tagline ||
      profile.customCharacter.description ||
      "Personaje VIP personalizado.",
    description:
      profile.customCharacter.description ||
      profile.customCharacter.tagline ||
      "Personaje VIP personalizado.",
  });
}

function buildCharacterPoolForProfile(profile) {
  const source = baseCharacters.length ? baseCharacters : characters;
  const pool = source.map((entry) => ({
    ...entry,
    stats: normalizeCharacterStats(entry.stats),
  }));
  if (!profile || !profile.isVip) {
    return pool;
  }
  if (vipSkinsEnabled) {
    const overrides = profile.vipSkins && typeof profile.vipSkins === "object" ? profile.vipSkins : {};
    pool.forEach((character) => {
      const skin = overrides[character.id];
      if (!skin) {
        return;
      }
      if (skin.sprite) {
        character.sprite = skin.sprite;
      }
      if (skin.portrait) {
        character.portrait = skin.portrait;
      }
      if (skin.powerIcon) {
        character.powerIcon = skin.powerIcon;
      }
      character.originSkin = "vip";
    });
  }
  const customCharacter = normalizeVipCustomCharacter(profile);
  if (customCharacter) {
    pool.push(customCharacter);
  }
  return pool;
}

function refreshVipCharacterPool({ keepSelection = true } = {}) {
  if (!baseCharacters.length) {
    return;
  }
  const profile = getSelectedProfile();
  const pool = buildCharacterPoolForProfile(profile);
  const previousSelections = keepSelection
    ? {
        p1: selectedCharacters.p1 ? selectedCharacters.p1.id : null,
        p2: selectedCharacters.p2 ? selectedCharacters.p2.id : null,
      }
    : { p1: null, p2: null };
  setCharacterPool(pool);
  vipCharacterPoolProfileId = profile?.id ?? null;
  if (keepSelection) {
    ["p1", "p2"].forEach((playerKey) => {
      const previousId = previousSelections[playerKey];
      if (!previousId) {
        selectionState[playerKey] = null;
        selectedCharacters[playerKey] = null;
        resetPlayerAttributeProfile(playerKey);
        updateCharacterDisplay(playerKey, null);
        return;
      }
      const idx = characters.findIndex((entry) => entry.id === previousId);
      if (idx >= 0) {
        selectionState[playerKey] = idx;
        const clone = cloneCharacterData(characters[idx]);
        selectedCharacters[playerKey] = clone;
        applySelectionToPlayer(playerKey, clone);
        updateCharacterDisplay(playerKey, clone);
      } else {
        selectionState[playerKey] = null;
        selectedCharacters[playerKey] = null;
        resetPlayerAttributeProfile(playerKey);
        updateCharacterDisplay(playerKey, null);
      }
    });
    updateStartMatchAvailability();
  } else {
    clearSelectedCharacters();
  }
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
    tagline: character.tagline || "Listo para la cancha.",
    description: character.description || character.tagline || "",
    stats: normalizeCharacterStats(character.stats),
    originSkin: character.originSkin || null,
    isVipExclusive: Boolean(character.isVipExclusive),
    ownerProfileId: character.ownerProfileId || null,
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
  const firstRoundPlayerMatchIndex = Math.floor(
    Math.random() * TOURNAMENT_STRUCTURE[0].matchCount,
  );
  TOURNAMENT_STRUCTURE.forEach((roundConfig, roundIndex) => {
    const matches = [];
    if (roundIndex === 0) {
      let cursor = 0;
      for (let matchIndex = 0; matchIndex < roundConfig.matchCount; matchIndex += 1) {
        let slots;
        const isPlayerMatch = matchIndex === firstRoundPlayerMatchIndex;
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

function resolveStaticAssetPath(path) {
  if (!path) {
    return `/static/${BRACKET_PLACEHOLDER_IMAGE}`;
  }
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  if (path.startsWith("/static/")) {
    return path;
  }
  const trimmed = path.replace(/^\/+/, "");
  return `/static/${trimmed}`;
}

function resolveCharacterPortraitPath(character) {
  if (!character) {
    return `/static/${BRACKET_PLACEHOLDER_IMAGE}`;
  }
  return resolveStaticAssetPath(character.portrait || character.sprite || BRACKET_PLACEHOLDER_IMAGE);
}

function createBracketSlotElement(slot, match) {
  const element = document.createElement("div");
  element.className = "bracket-slot";
  let name = "Por definir";
  let imageSrc = `/static/${BRACKET_PLACEHOLDER_IMAGE}`;
  let alt = "Rival por confirmar";

  if (slot?.type === "character" && slot.character) {
    const character = slot.character;
    imageSrc = resolveCharacterPortraitPath(character);
    name = character.name || "Rival misterioso";
    alt = name;
    if (slot.isPlayer) {
      element.classList.add("is-player");
    }
    if (match?.status === "completed" && match?.winner?.character?.id) {
      const winnerId = match.winner.character.id;
      if (character.id === winnerId) {
        element.classList.add("winner");
      }
    }
  } else if (slot?.type === "upstream") {
    element.classList.add("placeholder");
    name = describeUpstreamSlot(slot) || "Ganador ronda previa";
    alt = name;
  } else {
    element.classList.add("placeholder");
  }

  const img = document.createElement("img");
  img.src = imageSrc;
  img.alt = alt;
  const label = document.createElement("span");
  label.textContent = name;
  element.appendChild(img);
  element.appendChild(label);
  return element;
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
      if (isOnlineSelectionMode()) {
        if (!isLocalSelectionController(player)) {
          return;
        }
        if (onlineSelectionReady[player]) {
          return;
        }
      }
      const step = button.dataset.direction === "next" ? 1 : -1;
      cycleCharacter(player, step);
      if (isOnlineSelectionMode() && isLocalSelectionController(player)) {
        handleLocalOnlineSelectionChanged(player);
      }
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
  const character = cloneCharacterData(characters[index]);
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
  const isReady = isOnlineSelectionMode() && Boolean(onlineSelectionReady[player]);
  display.classList.toggle("is-ready", isReady);
  if (character) {
    const portraitPath = getStaticMediaPath(character.portrait || character.sprite);
    if (image) {
      image.src = portraitPath;
      image.alt = character.name;
    }
    if (name) {
      name.textContent = character.name;
    }
    if (tagline) {
      const baseTagline = character.tagline || "Listo para la cancha.";
      tagline.textContent = isReady ? `${baseTagline} (Listo)` : baseTagline;
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
    tagline.textContent = isReady ? `${fallback.tagline} (Listo)` : fallback.tagline;
  }
}

function applySelectionToPlayer(player, character) {
  if (!character) {
    resetPlayerAttributeProfile(player);
    return;
  }
  const sprite = getSprite(character.sprite);
  const portraitPath = getStaticMediaPath(character.portrait || character.sprite);
  const powerIconPath = character.powerIcon ? getStaticMediaPath(character.powerIcon) : portraitPath;
  if (state.players[player]) {
    state.players[player].characterId = character.id;
    state.players[player].scaleBoost = 0;
    state.players[player].powerSpriteOverride = null;
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
  setPlayerAttributeProfile(player, character);
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
  const nextSrc = src ? getStaticMediaPath(src) : fallback?.src;
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
    state.players[player].powerSpriteOverride = null;
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
  if (isOnlineSelectionMode()) {
    const localPlayer = getOnlineLocalPlayer();
    const remotePlayer = getOnlineRemotePlayer();
    const hasLocalSelection = localPlayer ? Boolean(selectedCharacters[localPlayer]) : false;
    const hasRemoteSelection = remotePlayer ? Boolean(selectedCharacters[remotePlayer]) : true;
    const localReady = localPlayer ? Boolean(onlineSelectionReady[localPlayer]) : false;
    startMatchButton.disabled = !hasLocalSelection || !hasRemoteSelection || localReady;
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
  resetPlayerAttributeProfile("p1");
  resetPlayerAttributeProfile("p2");
  if (state.players.p1) {
    state.players.p1.characterId = null;
    state.players.p1.scaleBoost = 0;
    state.players.p1.powerSpriteOverride = null;
  }
  if (state.players.p2) {
    state.players.p2.characterId = null;
    state.players.p2.scaleBoost = 0;
    state.players.p2.powerSpriteOverride = null;
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

function pullFallbackTaunt(type) {
  const pool =
    (AI_TAUNT_FALLBACKS[type] && AI_TAUNT_FALLBACKS[type].length > 0
      ? AI_TAUNT_FALLBACKS[type]
      : AI_TAUNT_FALLBACKS.default || []);
  if (!pool || pool.length === 0) {
    return "";
  }
  const message = pool.shift();
  pool.push(message);
  return message;
}

async function fetchNextTaunt(type) {
  try {
    const response = await fetch("/taunts/next", { headers: { Accept: "application/json" }, cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Respuesta ${response.status}`);
    }
    const data = await response.json();
    if (data && typeof data.taunt === "string" && data.taunt.trim()) {
      return data.taunt.trim();
    }
  } catch (error) {
    console.warn("No se pudo obtener burla desde el backend:", error);
  }
  return pullFallbackTaunt(type);
}

function aiSpeak(type, delay = 600) {
  if (mode !== "ai") {
    return;
  }
  cancelAiMessage();
  aiMessageTimeout = setTimeout(async () => {
    if (mode !== "ai") {
      return;
    }
    const message = await fetchNextTaunt(type);
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
  activeProfileId = null;
  activeProfileCharacterId = null;
  disconnectSocket();
  disconnectPrivateRoom({ resetRole: true });
  closeOnlineSetup();
  mode = "menu";
  pendingMode = null;
  setVipMusicGameplayActive(false);
  clearInterval(timerInterval);
  timerInterval = null;
  resetMatch();
  resetPositions();
  aiController.jumpCooldown = 0;
  aiController.reactionTimer = 0;
  cancelAiMessage();
  hideIdleOverlay();
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

function hideMenuScreen({ showIdle } = {}) {
  if (menuScreen) {
    menuScreen.classList.add("hidden");
  }
  if (typeof showIdle === "boolean") {
    if (showIdle) {
      showIdleOverlay();
    } else {
      hideIdleOverlay();
    }
    return;
  }
  if (mode === "menu" && !pendingMode) {
    showIdleOverlay();
  } else {
    hideIdleOverlay();
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
    resetPlayerAttributeProfile("p2");
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
  if (state.powers?.p2) {
    Object.assign(state.powers.p2, {
      speedBoostTimer: 0,
      speedBoostCooldown: 0,
      sizeBoostTimer: 0,
      sizeBoostCooldown: 0,
      sizeBoostValue: 0,
      sizeBoostProgress: 0,
      smokeCooldown: 0,
      smokeActiveTimer: 0,
      smokeAffectedTimer: 0,
    });
  }
  if (state.players.p2) {
    state.players.p2.scaleBoost = 0;
    state.players.p2.powerSpriteOverride = null;
  }
  updatePowerIndicators();
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
  if (isPlayerChimeneaSlowed(playerKey)) {
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

function isOnlineSelectionMode() {
  return pendingMode === "online";
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
    startMatchButton.textContent = isOnlineSelectionMode() ? "Estoy listo" : defaultStartMatchLabel;
  }
  if (isOnlineSelectionMode()) {
    if (selectionTitleElement) {
      selectionTitleElement.textContent = "Selecciona tu personaje online";
    }
    if (selectionHintElement) {
      selectionHintElement.textContent = "Elegi tu personaje y espera a que tu rival confirme.";
    }
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
    resetPlayerAttributeProfile("p2");
    updateCharacterDisplay("p2", null);
    setPowerIconForPlayer("p2");
    setAvatarForPlayer("p2", DEFAULT_AVATARS.p2, "Jugador 2");
  }
  updateStartMatchAvailability();
  if (isOnlineSelectionMode()) {
    updateOnlineSelectionUi();
  }
  characterSelectionOverlay.classList.remove("hidden");
}

function isLocalSelectionController(player) {
  if (!isOnlineSelectionMode()) {
    return true;
  }
  const localPlayer = getOnlineLocalPlayer();
  if (!localPlayer) {
    return false;
  }
  return localPlayer === player;
}

function resetOnlineSelectionState() {
  onlineSelectionActive = false;
  onlineSelectionStartPending = false;
  onlineSelectionReady.p1 = false;
  onlineSelectionReady.p2 = false;
  onlineStateBroadcastAccumulator = 0;
}

function updateSelectionReadyIndicator(player) {
  const container = playerSelectionContainers[player];
  if (container) {
    container.classList.toggle("is-ready", Boolean(onlineSelectionReady[player]));
  }
  updateCharacterDisplay(player, selectedCharacters[player] || null);
}

function updateOnlineSelectionUi() {
  if (!startMatchButton) {
    return;
  }
  if (!isOnlineSelectionMode()) {
    startMatchButton.disabled = !Boolean(selectedCharacters.p1 && selectedCharacters.p2);
    startMatchButton.textContent = defaultStartMatchLabel;
    characterNavButtons.forEach((button) => {
      button.disabled = Boolean(
        isTournamentSelectionMode() && button.dataset.player === "p2",
      );
    });
    return;
  }
  const localPlayer = getOnlineLocalPlayer();
  const remotePlayer = getOnlineRemotePlayer();
  characterNavButtons.forEach((button) => {
    const player = button.dataset.player;
    const isLocalControl = isLocalSelectionController(player);
    const isReady = Boolean(onlineSelectionReady[player]);
    button.disabled = !isLocalControl || isReady;
  });
  const hasLocalSelection = localPlayer ? Boolean(selectedCharacters[localPlayer]) : false;
  const hasRemoteSelection = remotePlayer ? Boolean(selectedCharacters[remotePlayer]) : true;
  const localReady = localPlayer ? Boolean(onlineSelectionReady[localPlayer]) : false;
  startMatchButton.disabled = !hasLocalSelection || !hasRemoteSelection || localReady;
  startMatchButton.textContent = localReady ? "Listo" : "Estoy listo";
}

function broadcastLocalOnlineSelection(player) {
  if (!isOnlineSelectionMode() || !privateSocket) {
    return;
  }
  if (!isLocalSelectionController(player)) {
    return;
  }
  const characterId = selectedCharacters[player]?.id ?? null;
  privateSocket.send({ type: "selection_choose", player, characterId });
}

function handleLocalOnlineSelectionChanged(player) {
  if (!isOnlineSelectionMode()) {
    return;
  }
  if (!isLocalSelectionController(player)) {
    return;
  }
  if (onlineSelectionReady[player]) {
    setOnlineSelectionReady(player, false, { notify: true });
  }
  broadcastLocalOnlineSelection(player);
  updateOnlineSelectionUi();
}

function setOnlineSelectionReady(player, ready, { notify = false } = {}) {
  if (onlineSelectionReady[player] === ready) {
    return;
  }
  onlineSelectionReady[player] = ready;
  updateSelectionReadyIndicator(player);
  if (notify && privateSocket) {
    privateSocket.send({ type: "selection_ready", player, ready });
  }
  if (isOnlineSelectionMode()) {
    updateOnlineSelectionUi();
  }
}

function handleLocalOnlineReady() {
  if (!isOnlineSelectionMode()) {
    return;
  }
  const localPlayer = getOnlineLocalPlayer();
  if (!localPlayer) {
    updateOnlineSetupFeedback("Define tu rol antes de comenzar.", "error");
    return;
  }
  if (!selectedCharacters[localPlayer]) {
    updateOnlineSetupFeedback("Primero elegí un personaje.", "error");
    return;
  }
  if (onlineSelectionReady[localPlayer]) {
    return;
  }
  setOnlineSelectionReady(localPlayer, true, { notify: true });
  appendOnlineLog(
    `Listo con ${selectedCharacters[localPlayer]?.name || "personaje sin nombre"}`,
  );
  updateOnlineSetupFeedback("Esperando a tu rival...", "info");
  if (onlineRole === "host" && onlineSelectionReady.p1 && onlineSelectionReady.p2) {
    finalizeOnlineSelection();
  }
}

function finalizeOnlineSelection() {
  if (!privateSocket || onlineSelectionStartPending) {
    return;
  }
  onlineSelectionStartPending = true;
  privateSocket.send({ type: "selection_start" });
  startOnlineMatch();
}

function beginOnlineCharacterSelection() {
  resetOnlineSelectionState();
  onlineSelectionActive = true;
  onlineOpponentReady = false;
  pendingMode = "online";
  hideMenuScreen();
  closeOnlineSetup();
  showOnlinePanel();
  clearRemoteKeyState();
  resetMatch();
  resetPositions();
  const roleLabel = onlineRole === "host" ? "Anfitrion" : "Invitado";
  const codeDisplay = onlineRoomCode || "--";
  updateModeLabel(`Online (${roleLabel})`);
  updateStatus("Selecciona tu personaje");
  setOnlinePanelStatus("Seleccionando personajes");
  setOnlinePanelCode(codeDisplay);
  updateOnlineSetupFeedback("Elegi tu personaje y espera a tu rival.", "info");
  appendOnlineLog("Selecciona tu personaje...");
  showCharacterSelection({ keepSelections: false });
  const localPlayer = getOnlineLocalPlayer();
  if (localPlayer) {
    broadcastLocalOnlineSelection(localPlayer);
  }
}

function applyOnlineRemoteSelection(player, characterId) {
  if (!player) {
    return;
  }
  if (!characterId) {
    selectedCharacters[player] = null;
    resetPlayerAttributeProfile(player);
    updateCharacterDisplay(player, null);
    updateStartMatchAvailability();
    if (isOnlineSelectionMode()) {
      updateOnlineSelectionUi();
    }
    return;
  }
  const character = getCharacterDataById(characterId);
  if (!character) {
    return;
  }
  const index = characters.findIndex((entry) => entry.id === character.id);
  if (index >= 0) {
    selectionState[player] = index;
  }
  selectedCharacters[player] = character;
  applySelectionToPlayer(player, character);
  updateCharacterDisplay(player, character);
  setOnlineSelectionReady(player, false);
  updateStartMatchAvailability();
  if (isOnlineSelectionMode()) {
    updateOnlineSelectionUi();
  }
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
  if ((targetMode === "local" || targetMode === "ai") && !requireProfileSelection()) {
    return;
  }
  if (targetMode === "online") {
    handleLocalOnlineReady();
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
  if (!requireProfileSelection()) {
    showMenuScreen({ resetSelections: false });
    return;
  }
  pendingMode = "local";
  hideMenuScreen();
  disconnectSocket();
  disconnectPrivateRoom({ resetRole: true });
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
  if (!requireProfileSelection()) {
    showMenuScreen({ resetSelections: false });
    return;
  }
  pendingMode = "ai";
  hideMenuScreen();
  disconnectSocket();
  disconnectPrivateRoom({ resetRole: true });
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
  if (state.matchOver) {
    return;
  }
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

    if (mode === "local" || mode === "online") {
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
    if (!isPlayerIntangible(key)) {
      handleFootBallCollision(player);
    }
  });

  handleGoatChargeInteractions();
  handlePerfilBajoInteractions();
  handleChimeneaBreathInteractions();

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
    const playerKey = resolvePlayerKeyFromInstance(player);
    if (playerKey && isPlayerIntangible(playerKey)) {
      return;
    }
    handleFootBallCollision(player);
  });
  const collisionOrder = [state.players.p1, state.players.p2]
    .filter((player) => {
      const playerKey = resolvePlayerKeyFromInstance(player);
      return !playerKey || !isPlayerIntangible(playerKey);
    })
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
  if (mode === "online" && privateSocket && onlineRole === "host") {
    onlineStateBroadcastAccumulator += delta;
    if (onlineStateBroadcastAccumulator >= ONLINE_STATE_BROADCAST_INTERVAL) {
      onlineStateBroadcastAccumulator = 0;
      sendOnlineStateSnapshot();
    }
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
  const powerState = state.powers?.[playerKey];
  const slowed = isPlayerChimeneaSlowed(playerKey);
  if (powerState?.goatChargeTimer > 0 && isPlayerGoat(playerKey)) {
    const direction = powerState.goatChargeDirection >= 0 ? 1 : -1;
    player.vx = direction * PLAYER_SPEED * GOAT_CHARGE_SPEED_MULTIPLIER;
    player.facing = direction;
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
  if (control && slowed) {
    control.bufferedJump = 0;
  }
  if (state.pressed[leftKey]) {
    player.vx = -moveSpeed;
    player.facing = -1;
  }
  if (state.pressed[rightKey]) {
    player.vx = moveSpeed;
    player.facing = 1;
  }
  if (!slowed && control && control.bufferedJump > 0 && control.coyoteTime > 0) {
    player.vy = getPlayerJumpVelocity(playerKey);
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

function isPlayerPrime(playerKey) {
  return getPlayerCharacterId(playerKey) === PRIME_ID;
}

function isPlayerFantasma(playerKey) {
  return getPlayerCharacterId(playerKey) === FANTASMA_ID;
}

function isPlayerGoat(playerKey) {
  return getPlayerCharacterId(playerKey) === GOAT_ID;
}

function isPlayerCono(playerKey) {
  return getPlayerCharacterId(playerKey) === CONO_ID;
}

function isPlayerCasco(playerKey) {
  return getPlayerCharacterId(playerKey) === CASCO_ID;
}

function isPlayerChimenea(playerKey) {
  return getPlayerCharacterId(playerKey) === CHIMENEA_ID;
}

function isPlayerLarucha(playerKey) {
  return getPlayerCharacterId(playerKey) === LARUCHA_ID;
}

function isLaruchaBookActive(playerKey) {
  if (!isPlayerLarucha(playerKey)) {
    return false;
  }
  const powers = state.powers?.[playerKey];
  return Boolean(powers && powers.laruchaBookTimer > 0);
}

function isPlayerIntangible(playerKey) {
  if (!isPlayerCono(playerKey)) {
    return false;
  }
  const powers = state.powers?.[playerKey];
  return Boolean(powers && powers.perfilBajoTimer > 0);
}

function isPlayerChimeneaSlowed(playerKey) {
  const powers = state.powers?.[playerKey];
  return Boolean(powers && powers.chimeneaSlowTimer > 0);
}

function getOpponentKey(playerKey) {
  return playerKey === "p1" ? "p2" : "p1";
}

function resolvePlayerKeyFromInstance(player) {
  if (player === state.players.p1) {
    return "p1";
  }
  if (player === state.players.p2) {
    return "p2";
  }
  return null;
}

function isPlayerStunned(playerKey) {
  const powers = state.powers?.[playerKey];
  if (!powers) {
    return false;
  }
  return Boolean(
    (typeof powers.smokeAffectedTimer === "number" && powers.smokeAffectedTimer > 0) ||
      (typeof powers.stunTimer === "number" && powers.stunTimer > 0),
  );
}

function applyStunToPlayer(playerKey, duration) {
  const powers = state.powers?.[playerKey];
  if (!powers) {
    return;
  }
  const nextDuration = Math.max(Number(powers.stunTimer) || 0, duration);
  powers.stunTimer = nextDuration;
  const control = playerControl[playerKey];
  if (control) {
    control.bufferedJump = 0;
  }
  const player = state.players[playerKey];
  if (player?.foot) {
    player.foot.raising = false;
  }
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
    const normalizedCooldown =
      cooldownDuration > 0 ? Math.min(cooldownRemaining, cooldownDuration) : 0;
    const progress =
      cooldownDuration > 0
        ? Math.min(1, Math.max(0, 1 - normalizedCooldown / cooldownDuration))
        : 1;
    const ready = cooldownRemaining <= 0.05 && activeTimer <= 0.05;
    const active = activeTimer > 0.05;
    const angle = ready ? 359.9 : progress * 360;
    meter.style.setProperty("--progress-angle", `${angle.toFixed(2)}deg`);
    meter.classList.remove("is-disabled");
    meter.classList.toggle("is-ready", ready);
    meter.classList.toggle("is-active", active);
  });
}

function resetPlayerAttributeProfile(playerKey) {
  characterAttributeState[playerKey] = createAttributeProfile();
}

function setPlayerAttributeProfile(playerKey, character) {
  const stats = normalizeCharacterStats(character?.stats);
  const profile = characterAttributeState[playerKey] || createAttributeProfile();
  profile.stats = stats;
  profile.multipliers = {
    speed: statPercentToMultiplier(stats.speed, CHARACTER_ATTRIBUTE_BOUNDS.speed),
    jump: statPercentToMultiplier(stats.jump, CHARACTER_ATTRIBUTE_BOUNDS.jump),
    power: statPercentToMultiplier(stats.power, CHARACTER_ATTRIBUTE_BOUNDS.power),
  };
  characterAttributeState[playerKey] = profile;
}

function getPlayerAttributeMultiplier(playerKey, attribute) {
  const profile = characterAttributeState[playerKey];
  return profile?.multipliers?.[attribute] ?? 1;
}

function getPlayerJumpVelocity(playerKey) {
  return JUMP_VELOCITY * getPlayerAttributeMultiplier(playerKey, "jump");
}

function getPlayerPowerMultiplier(playerKey) {
  return getPlayerAttributeMultiplier(playerKey, "power");
}

function getPlayerSpeedMultiplier(playerKey) {
  const power = state.powers?.[playerKey];
  let multiplier = getPlayerAttributeMultiplier(playerKey, "speed");
  if (!power) {
    return multiplier;
  }
  if (power.goatChargeTimer > 0 && isPlayerGoat(playerKey)) {
    multiplier *= GOAT_CHARGE_SPEED_MULTIPLIER;
  } else if (power.speedBoostTimer > 0 && isPlayerColapinto(playerKey)) {
    multiplier *= COLAPINTO_SPEED_MULTIPLIER;
  } else if (power.sizeBoostTimer > 0 && isPlayerCuervo(playerKey)) {
    multiplier *= CUERVO_SPEED_MULTIPLIER;
  }
  if (power.chimeneaSlowTimer > 0) {
    multiplier *= CHIMENEA_SLOW_MULTIPLIER;
  }
  return multiplier;
}

function getPlayerScale(playerOrKey) {
  const playerKey =
    typeof playerOrKey === "string" ? playerOrKey : resolvePlayerKeyFromInstance(playerOrKey);
  if (!playerKey) {
    return 1;
  }
  const power = state.powers?.[playerKey];
  const player = state.players[playerKey];
  if (player && typeof player.scaleBoost === "number" && player.scaleBoost > 0) {
    return player.scaleBoost;
  }
  if (power && power.sizeBoostTimer > 0 && power.sizeBoostValue > 0) {
    return power.sizeBoostValue;
  }
  return 1;
}

function updatePowers(delta) {
  if (!state.powers) {
    return;
  }
  let anyPerfilBajoActive = false;
  Object.entries(state.powers).forEach(([playerKey, power]) => {
    if (!power) {
      return;
    }
    const player = state.players[playerKey];

    if (power.speedBoostTimer > 0) {
      power.speedBoostTimer = Math.max(0, power.speedBoostTimer - delta);
    }
    setColapintoPowerSpriteActive(playerKey, power.speedBoostTimer > 0);
    if (power.speedBoostCooldown > 0) {
      power.speedBoostCooldown = Math.max(0, power.speedBoostCooldown - delta);
    }
    if (power.goatChargeTimer > 0) {
      power.goatChargeTimer = Math.max(0, power.goatChargeTimer - delta);
      if (power.goatChargeTimer <= 0) {
        power.goatChargeHasHit = false;
      }
    } else if (power.goatChargeHasHit) {
      power.goatChargeHasHit = false;
    }
    if (power.goatChargeCooldown > 0) {
      power.goatChargeCooldown = Math.max(0, power.goatChargeCooldown - delta);
    }
    if (power.perfilBajoTimer > 0) {
      power.perfilBajoTimer = Math.max(0, power.perfilBajoTimer - delta);
      anyPerfilBajoActive = true;
      if (power.perfilBajoTimer <= 0) {
        power.perfilBajoHasStunned = false;
      }
    } else if (power.perfilBajoHasStunned) {
      power.perfilBajoHasStunned = false;
    }
    if (power.perfilBajoCooldown > 0) {
      power.perfilBajoCooldown = Math.max(0, power.perfilBajoCooldown - delta);
    }
    if (power.perfilBajoStunFlashTimer > 0) {
      power.perfilBajoStunFlashTimer = Math.max(0, power.perfilBajoStunFlashTimer - delta);
    }
    if (power.cascoHeadTimer > 0) {
      power.cascoHeadTimer = Math.max(0, power.cascoHeadTimer - delta);
      if (power.cascoHeadTimer <= 0) {
        power.cascoHeadHitCooldown = Math.min(power.cascoHeadHitCooldown, 0.08);
      }
    }
    if (power.cascoHeadCooldown > 0) {
      power.cascoHeadCooldown = Math.max(0, power.cascoHeadCooldown - delta);
    }
    if (power.cascoHeadHitCooldown > 0) {
      power.cascoHeadHitCooldown = Math.max(0, power.cascoHeadHitCooldown - delta);
    }
    if (power.cascoHeadFlashTimer > 0) {
      power.cascoHeadFlashTimer = Math.max(0, power.cascoHeadFlashTimer - delta);
    }
    if (power.chimeneaBreathTimer > 0) {
      power.chimeneaBreathTimer = Math.max(0, power.chimeneaBreathTimer - delta);
      power.chimeneaBreathElapsed = Math.max(
        0,
        (power.chimeneaBreathElapsed ?? 0) + delta,
      );
      if (power.chimeneaBreathTimer <= 0) {
        power.chimeneaBreathElapsed = CHIMENEA_BREATH_DURATION;
      }
    } else {
      power.chimeneaBreathElapsed = 0;
    }
    if (power.chimeneaBreathTimer <= 0 && power.chimeneaBreathCooldownPending) {
      power.chimeneaBreathCooldown = CHIMENEA_POWER_COOLDOWN;
      power.chimeneaBreathCooldownPending = false;
    }
    if (power.chimeneaBreathCooldown > 0) {
      power.chimeneaBreathCooldown = Math.max(0, power.chimeneaBreathCooldown - delta);
    }
    if (power.chimeneaSlowTimer > 0) {
      power.chimeneaSlowTimer = Math.max(0, power.chimeneaSlowTimer - delta);
      if (power.chimeneaSlowTimer <= 0) {
        const control = playerControl[playerKey];
        if (control) {
          control.bufferedJump = Math.min(control.bufferedJump, JUMP_BUFFER_TIME);
        }
      }
    }
    if (power.laruchaBookTimer > 0) {
      power.laruchaBookTimer = Math.max(0, power.laruchaBookTimer - delta);
      const currentFade = typeof power.laruchaBookFadeTimer === "number" ? power.laruchaBookFadeTimer : 0;
      power.laruchaBookFadeTimer = Math.max(currentFade, LARUCHA_BOOK_FADE_DURATION);
    } else {
      if (power.laruchaBookCooldownPending) {
        power.laruchaBookCooldown = LARUCHA_BOOK_COOLDOWN;
        power.laruchaBookCooldownPending = false;
      }
      if (power.laruchaBookFadeTimer > 0) {
        power.laruchaBookFadeTimer = Math.max(0, power.laruchaBookFadeTimer - delta);
      }
    }
    if (power.laruchaBookCooldown > 0) {
      power.laruchaBookCooldown = Math.max(0, power.laruchaBookCooldown - delta);
    }
    const targetScale =
      power.sizeBoostValue && power.sizeBoostValue > 0
        ? power.sizeBoostValue
        : isPlayerCuervo(playerKey)
          ? CUERVO_SCALE
          : 0;
    if (power.sizeBoostTimer > 0) {
      power.sizeBoostTimer = Math.max(0, power.sizeBoostTimer - delta);
      if (isPlayerPrime(playerKey) && targetScale > 0) {
        const ramp = Math.max(PRIME_SCALE_RAMP_DURATION, 0.0001);
        power.sizeBoostProgress = clamp(
          (power.sizeBoostProgress ?? 0) + delta / ramp,
          0,
          1,
        );
        const scale = 1 + (targetScale - 1) * power.sizeBoostProgress;
        if (player) {
          player.scaleBoost = scale > 0 ? scale : 0;
        }
      } else {
        if (player) {
          player.scaleBoost = targetScale;
        }
        power.sizeBoostProgress = targetScale !== 0 ? 1 : 0;
      }
    } else if (isPlayerPrime(playerKey) && targetScale > 0) {
      const ramp = Math.max(PRIME_SCALE_RAMP_DURATION, 0.0001);
      const nextProgress = clamp(
        (power.sizeBoostProgress ?? 0) - delta / ramp,
        0,
        1,
      );
      power.sizeBoostProgress = nextProgress;
      if (player) {
        if (nextProgress > 0) {
          const scale = 1 + (targetScale - 1) * nextProgress;
          player.scaleBoost = scale > 0 ? scale : 0;
        } else {
          player.scaleBoost = 0;
        }
      }
      if (nextProgress <= 0) {
        power.sizeBoostValue = 0;
      }
    } else {
      if (player) {
        player.scaleBoost = 0;
      }
      if (power.sizeBoostTimer <= 0 && power.sizeBoostValue !== 0) {
        power.sizeBoostValue = 0;
      }
      power.sizeBoostProgress = 0;
    }
    if (power.sizeBoostCooldown > 0) {
      power.sizeBoostCooldown = Math.max(0, power.sizeBoostCooldown - delta);
    }
    if (power.speedBoostTimer <= 0 && power.speedBoostCooldown <= COLAPINTO_POWER_COOLDOWN - delta) {
      // reserved hook
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
    if (power.stunTimer > 0) {
      power.stunTimer = Math.max(0, power.stunTimer - delta);
      const stunnedPlayer = state.players[playerKey];
      if (stunnedPlayer?.foot) {
        stunnedPlayer.foot.raising = false;
      }
    }
  });
  setPerfilBajoGrayscale(anyPerfilBajoActive);
  setPerfilBajoMusicActive(anyPerfilBajoActive);
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
  if (isPlayerPrime(playerKey)) {
    return activatePrimeColossusPower(playerKey);
  }
  if (isPlayerFantasma(playerKey)) {
    return activateFantasmaSmokePower(playerKey);
  }
  if (isPlayerCono(playerKey)) {
    return activateConoPerfilBajoPower(playerKey);
  }
  if (isPlayerGoat(playerKey)) {
    return activateGoatRagePower(playerKey);
  }
  if (isPlayerCasco(playerKey)) {
    return activateCascoIronHeadPower(playerKey);
  }
  if (isPlayerChimenea(playerKey)) {
    return activateChimeneaSmokePower(playerKey);
  }
  if (isPlayerLarucha(playerKey)) {
    return activateLaruchaGoalKeeperPower(playerKey);
  }
  return false;
}

function setColapintoPowerSpriteActive(playerKey, active) {
  const player = state.players[playerKey];
  if (!player) {
    return;
  }
  if (!isPlayerColapinto(playerKey)) {
    if (player.powerSpriteOverride === COLAPINTO_POWER_SPRITE) {
      player.powerSpriteOverride = null;
    }
    return;
  }
  if (active) {
    player.powerSpriteOverride = COLAPINTO_POWER_SPRITE;
  } else if (player.powerSpriteOverride === COLAPINTO_POWER_SPRITE) {
    player.powerSpriteOverride = null;
  }
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
  setColapintoPowerSpriteActive(playerKey, true);
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
  powers.sizeBoostValue = CUERVO_SCALE;
  const player = state.players[playerKey];
  if (player) {
    player.scaleBoost = CUERVO_SCALE;
  }
  const label = playerKey === "p1" ? "Jugador 1" : "Jugador 2";
  logChat("Sistema", `${label} activa Garras del Cuervo!`);
  return true;
}

function activatePrimeColossusPower(playerKey) {
  const powers = state.powers?.[playerKey];
  if (!powers) {
    return false;
  }
  if (!isPlayerPrime(playerKey)) {
    return false;
  }
  if (powers.sizeBoostCooldown > 0 || powers.sizeBoostTimer > 0) {
    return false;
  }
  powers.sizeBoostTimer = PRIME_POWER_DURATION;
  powers.sizeBoostCooldown = PRIME_POWER_COOLDOWN;
  powers.sizeBoostValue = PRIME_SCALE_MULTIPLIER;
  powers.sizeBoostProgress = 0;
  const player = state.players[playerKey];
  if (player) {
    player.scaleBoost = 0;
  }
  playPrimeRoarSound();
  const label = playerKey === "p1" ? "Jugador 1" : "Jugador 2";
  logChat("Sistema", `${label} activa Titan Prime!`);
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

function activateConoPerfilBajoPower(playerKey) {
  const powers = state.powers?.[playerKey];
  if (!powers) {
    return false;
  }
  if (!isPlayerCono(playerKey)) {
    return false;
  }
  if (powers.perfilBajoCooldown > 0 || powers.perfilBajoTimer > 0) {
    return false;
  }
  powers.perfilBajoTimer = CONO_PHANTOM_DURATION;
  powers.perfilBajoCooldown = CONO_PHANTOM_COOLDOWN;
  powers.perfilBajoHasStunned = false;
  setPerfilBajoMusicActive(true);
  const label = playerKey === "p1" ? "Jugador 1" : "Jugador 2";
  logChat("Sistema", `${label} activa Perfil Bajo!`);
  return true;
}

function activateGoatRagePower(playerKey) {
  const powers = state.powers?.[playerKey];
  const player = state.players[playerKey];
  if (!powers || !player) {
    return false;
  }
  if (!isPlayerGoat(playerKey)) {
    return false;
  }
  if (powers.goatChargeCooldown > 0 || powers.goatChargeTimer > 0) {
    return false;
  }
  const direction = player.facing >= 0 ? 1 : -1;
  powers.goatChargeTimer = GOAT_CHARGE_DURATION;
  powers.goatChargeCooldown = GOAT_POWER_COOLDOWN;
  powers.goatChargeDirection = direction;
  powers.goatChargeHasHit = false;
  if (player.foot) {
    player.foot.raising = false;
  }
  player.vx = direction * PLAYER_SPEED * GOAT_CHARGE_SPEED_MULTIPLIER;
  player.facing = direction;
  playGoatChargeSound();
  const label = playerKey === "p1" ? "Jugador 1" : "Jugador 2";
  logChat("Sistema", `${label} activa Embestida Cabruna!`);
  return true;
}

function activateCascoIronHeadPower(playerKey) {
  const powers = state.powers?.[playerKey];
  if (!powers) {
    return false;
  }
  if (!isPlayerCasco(playerKey)) {
    return false;
  }
  if (powers.cascoHeadCooldown > 0 || powers.cascoHeadTimer > 0) {
    return false;
  }
  powers.cascoHeadTimer = CASCO_POWER_DURATION;
  powers.cascoHeadCooldown = CASCO_POWER_COOLDOWN + CASCO_POWER_DURATION;
  powers.cascoHeadHitCooldown = 0;
  powers.cascoHeadFlashTimer = CASCO_HEAD_FLASH_DURATION * 0.75;
  playCascoActivateSound();
  const label = playerKey === "p1" ? "Jugador 1" : "Jugador 2";
  logChat("Sistema", `${label} activa Cabeza de Hierro!`);
  return true;
}

function activateChimeneaSmokePower(playerKey) {
  const powers = state.powers?.[playerKey];
  const player = state.players[playerKey];
  if (!powers || !player) {
    return false;
  }
  if (!isPlayerChimenea(playerKey)) {
    return false;
  }
  if (
    powers.chimeneaBreathTimer > 0 ||
    powers.chimeneaBreathCooldown > 0 ||
    powers.chimeneaBreathCooldownPending
  ) {
    return false;
  }
  const direction = player.facing >= 0 ? 1 : -1;
  powers.chimeneaBreathTimer = CHIMENEA_BREATH_DURATION;
  powers.chimeneaBreathCooldown = CHIMENEA_BREATH_DURATION;
  powers.chimeneaBreathCooldownPending = true;
  powers.chimeneaBreathDirection = direction;
  powers.chimeneaBreathOriginX = player.x;
  powers.chimeneaBreathOriginY = player.y - PLAYER_HEIGHT * 0.45;
  powers.chimeneaBreathElapsed = 0;
  playChimeneaBreathSound();
  const label = playerKey === "p1" ? "Jugador 1" : "Jugador 2";
  logChat("Sistema", `${label} activa Soplido de Humo!`);
  return true;
}

function activateLaruchaGoalKeeperPower(playerKey) {
  const powers = state.powers?.[playerKey];
  if (!powers) {
    return false;
  }
  if (!isPlayerLarucha(playerKey)) {
    return false;
  }
  if (powers.laruchaBookCooldown > 0 || powers.laruchaBookTimer > 0) {
    return false;
  }
  powers.laruchaBookTimer = LARUCHA_BOOK_DURATION;
  powers.laruchaBookCooldownPending = true;
  powers.laruchaBookFadeTimer = LARUCHA_BOOK_FADE_DURATION;
  playLaruchaBookSound();
  const label = playerKey === "p1" ? "Jugador 1" : "Jugador 2";
  logChat("Sistema", `${label} despliega el Muro de Larucha!`);
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

function handleGoatChargeInteractions() {
  if (!state.powers) {
    return;
  }
  const pairs = [
    ["p1", "p2"],
    ["p2", "p1"],
  ];
  pairs.forEach(([attackerKey, defenderKey]) => {
    if (!isPlayerGoat(attackerKey)) {
      return;
    }
    const powers = state.powers?.[attackerKey];
    if (!powers || powers.goatChargeTimer <= 0 || powers.goatChargeHasHit) {
      return;
    }
    const attacker = state.players[attackerKey];
    const defender = state.players[defenderKey];
    if (!attacker || !defender) {
      return;
    }
    const attackerScale = getPlayerScale(attacker);
    const defenderScale = getPlayerScale(defender);
    const attackerRadius = PLAYER_WIDTH * attackerScale * 0.45;
    const defenderRadius = PLAYER_WIDTH * defenderScale * 0.45;
    const attackerCenterX = attacker.x;
    const attackerCenterY = attacker.y - (PLAYER_HEIGHT * attackerScale) / 2;
    const defenderCenterX = defender.x;
    const defenderCenterY = defender.y - (PLAYER_HEIGHT * defenderScale) / 2;
    const dx = defenderCenterX - attackerCenterX;
    const dy = defenderCenterY - attackerCenterY;
    const distanceSq = dx * dx + dy * dy;
    const minimumDistance = attackerRadius + defenderRadius;
    if (distanceSq > minimumDistance * minimumDistance) {
      return;
    }
    const distance = Math.sqrt(distanceSq) || 0.0001;
    const direction = powers.goatChargeDirection >= 0 ? 1 : -1;
    powers.goatChargeHasHit = true;
    applyStunToPlayer(defenderKey, GOAT_STUN_DURATION);
    defender.vx = direction * GOAT_CHARGE_KNOCKBACK_VELOCITY;
    defender.vy = Math.min(defender.vy, GOAT_CHARGE_VERTICAL_BOOST);
    defender.facing = direction;
    const separation = minimumDistance - distance;
    if (separation > 0) {
      const inset = PLAYER_WIDTH / 2 + 12;
      attacker.x = clamp(attacker.x - direction * separation * 0.25, inset, canvas.width - inset);
      defender.x = clamp(defender.x + direction * separation * 0.75, inset, canvas.width - inset);
    }
  });
}

function handlePerfilBajoInteractions() {
  if (!state.powers) {
    return;
  }
  const pairs = [
    ["p1", "p2"],
    ["p2", "p1"],
  ];
  pairs.forEach(([phaseKey, opponentKey]) => {
    if (!isPlayerCono(phaseKey)) {
      return;
    }
    const powers = state.powers?.[phaseKey];
    if (!powers || powers.perfilBajoTimer <= 0) {
      return;
    }
    const phasingPlayer = state.players[phaseKey];
    const opponent = state.players[opponentKey];
    if (!phasingPlayer || !opponent) {
      return;
    }
    const phasingScale = getPlayerScale(phasingPlayer);
    const opponentScale = getPlayerScale(opponent);
    const phasingWidth = PLAYER_WIDTH * phasingScale;
    const phasingHeight = PLAYER_HEIGHT * phasingScale;
    const opponentWidth = PLAYER_WIDTH * opponentScale;
    const opponentHeight = PLAYER_HEIGHT * opponentScale;

    const phasingLeft = phasingPlayer.x - phasingWidth / 2;
    const phasingRight = phasingPlayer.x + phasingWidth / 2;
    const phasingTop = phasingPlayer.y - phasingHeight;
    const phasingBottom = phasingPlayer.y;

    const opponentLeft = opponent.x - opponentWidth / 2;
    const opponentRight = opponent.x + opponentWidth / 2;
    const opponentTop = opponent.y - opponentHeight;
    const opponentBottom = opponent.y;

    const overlaps =
      phasingRight > opponentLeft &&
      phasingLeft < opponentRight &&
      phasingBottom > opponentTop &&
      phasingTop < opponentBottom;
    if (!overlaps) {
      return;
    }
    if (!powers.perfilBajoHasStunned) {
      applyStunToPlayer(opponentKey, CONO_STUN_DURATION);
      const opponentInstance = state.players[opponentKey];
      if (opponentInstance) {
        opponentInstance.vx *= 0.3;
        opponentInstance.vy *= 0.3;
      }
      const opponentPower = state.powers?.[opponentKey];
      if (opponentPower) {
        opponentPower.perfilBajoStunFlashTimer = Math.max(
          Number(opponentPower.perfilBajoStunFlashTimer) || 0,
          CONO_STUN_DURATION,
        );
      }
      powers.perfilBajoHasStunned = true;
    }
  });
}

function handleChimeneaBreathInteractions() {
  if (!state.powers) {
    return;
  }
  const pairs = [
    ["p1", "p2"],
    ["p2", "p1"],
  ];
  pairs.forEach(([attackerKey, defenderKey]) => {
    if (!isPlayerChimenea(attackerKey)) {
      return;
    }
    const powers = state.powers?.[attackerKey];
    if (!powers || powers.chimeneaBreathTimer <= 0) {
      return;
    }
    const attacker = state.players[attackerKey];
    const defender = state.players[defenderKey];
    if (!attacker || !defender) {
      return;
    }
    const direction = powers.chimeneaBreathDirection >= 0 ? 1 : -1;
    const originX = Number.isFinite(powers.chimeneaBreathOriginX)
      ? powers.chimeneaBreathOriginX
      : attacker.x;
    const originY = Number.isFinite(powers.chimeneaBreathOriginY)
      ? powers.chimeneaBreathOriginY
      : attacker.y - PLAYER_HEIGHT * 0.45;
    const elapsed = clamp(
      powers.chimeneaBreathElapsed || CHIMENEA_BREATH_DURATION - powers.chimeneaBreathTimer,
      0,
      CHIMENEA_BREATH_DURATION,
    );
    const progress = clamp(elapsed / CHIMENEA_BREATH_DURATION, 0, 1);
    const centerX =
      originX + direction * (CHIMENEA_CLOUD_START_OFFSET + CHIMENEA_CLOUD_TRAVEL * progress);
    const centerY = originY;
    const halfWidth = CHIMENEA_CLOUD_WIDTH * 0.5;
    const halfHeight = CHIMENEA_CLOUD_HEIGHT * 0.5;
    const defenderCenterX = defender.x;
    const defenderCenterY = defender.y - PLAYER_HEIGHT * 0.5;
    const relativeAhead = direction * (defenderCenterX - originX);
    if (relativeAhead < -halfWidth * 0.2) {
      return;
    }
    if (isPlayerIntangible(defenderKey)) {
      return;
    }
    const dx = (defenderCenterX - centerX) / halfWidth;
    const dy = (defenderCenterY - centerY) / halfHeight;
    if (dx * dx + dy * dy > 1) {
      return;
    }
    const defenderPowers = state.powers?.[defenderKey];
    if (!defenderPowers) {
      return;
    }
    defenderPowers.chimeneaSlowTimer = CHIMENEA_SLOW_DURATION;
  });
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
  const powers = state.powers?.[playerKey];
  const slowed = isPlayerChimeneaSlowed(playerKey);
  if (slowed && control) {
    control.bufferedJump = 0;
  }
  if (powers?.goatChargeTimer > 0 && isPlayerGoat(playerKey)) {
    const direction = powers.goatChargeDirection >= 0 ? 1 : -1;
    player.vx = direction * PLAYER_SPEED * GOAT_CHARGE_SPEED_MULTIPLIER;
    player.facing = direction;
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
  const canJump = onGround && aiController.jumpCooldown <= 0 && !slowed;
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
    player.vy = getPlayerJumpVelocity(playerKey) * Math.min(settings.jumpAggression, 1.8);
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
  drawLaruchaBookBarrier();
  drawBallSprite();
  drawPlayerFoot(state.players.p1);
  drawPlayerFoot(state.players.p2);
  drawChimeneaBreathClouds();
  drawPlayerSprite(state.players.p1, sprites.player1);
  drawPlayerSprite(state.players.p2, sprites.player2);
  drawSmokeEffects();
}

/** Funciones auxiliares para el modo online privado. */
function getOnlineLocalPlayer() {
  if (!onlineRole) {
    return null;
  }
  return ONLINE_ROLE_TO_PLAYER[onlineRole] || null;
}

function getOnlineRemotePlayer() {
  if (!onlineRole) {
    return null;
  }
  return ONLINE_ROLE_TO_REMOTE[onlineRole] || null;
}

function isLocalPlayerControl(playerKey) {
  if (mode !== "online") {
    return true;
  }
  const localPlayer = getOnlineLocalPlayer();
  if (!localPlayer) {
    return false;
  }
  return localPlayer === playerKey;
}

function isRemoteControlCode(code) {
  if (mode !== "online") {
    return false;
  }
  const remotePlayer = getOnlineRemotePlayer();
  if (!remotePlayer) {
    return false;
  }
  const inputs = PLAYER_INPUTS[remotePlayer];
  if (!inputs) {
    return false;
  }
  return (
    inputs.left === code ||
    inputs.right === code ||
    inputs.jump === code ||
    inputs.foot === code ||
    (inputs.powers && inputs.powers.includes(code))
  );
}

function setLocalKeyState(code, pressed) {
  if (isRemoteControlCode(code)) {
    return;
  }
  state.pressed[code] = pressed;
}

function handleOnlineStateSync(payload) {
  if (!payload || onlineRole === "host") {
    return;
  }
  const blendValue = (current, target, factor, snapThreshold) => {
    if (Number.isNaN(target)) {
      return current;
    }
    if (typeof snapThreshold === "number" && Math.abs(target - current) > snapThreshold) {
      return target;
    }
    return current + (target - current) * factor;
  };
  const ball = payload.ball || {};
  const nextBallX = Number(ball.x);
  const nextBallY = Number(ball.y);
  const nextBallVx = Number(ball.vx);
  const nextBallVy = Number(ball.vy);
  const nextBallRotation = Number(ball.rotation);
  const nextBallSpin = Number(ball.spin);
  if (!Number.isNaN(nextBallX)) {
    state.ball.x = blendValue(
      state.ball.x,
      nextBallX,
      ONLINE_STATE_INTERPOLATION,
      ONLINE_STATE_SNAP_DISTANCE,
    );
  }
  if (!Number.isNaN(nextBallY)) {
    state.ball.y = blendValue(
      state.ball.y,
      nextBallY,
      ONLINE_STATE_INTERPOLATION,
      ONLINE_STATE_SNAP_DISTANCE,
    );
  }
  if (!Number.isNaN(nextBallVx)) {
    state.ball.vx = blendValue(state.ball.vx, nextBallVx, ONLINE_STATE_VELOCITY_BLEND);
  }
  if (!Number.isNaN(nextBallVy)) {
    state.ball.vy = blendValue(state.ball.vy, nextBallVy, ONLINE_STATE_VELOCITY_BLEND);
  }
  if (!Number.isNaN(nextBallRotation)) {
    state.ball.rotation = blendValue(
      state.ball.rotation,
      nextBallRotation,
      ONLINE_STATE_ROTATION_BLEND,
    );
  }
  if (!Number.isNaN(nextBallSpin)) {
    state.ball.spin = blendValue(state.ball.spin, nextBallSpin, ONLINE_STATE_ROTATION_BLEND);
  }
  if (typeof payload.goalCooldown === "number" && !Number.isNaN(payload.goalCooldown)) {
    goalCooldown = payload.goalCooldown;
  }
  if (payload.score && typeof payload.score === "object") {
    const left = Number(payload.score.left);
    const right = Number(payload.score.right);
    if (!Number.isNaN(left)) {
      state.score.left = left;
    }
    if (!Number.isNaN(right)) {
      state.score.right = right;
    }
    scoreboardLabels.left.textContent = state.score.left;
    scoreboardLabels.right.textContent = state.score.right;
  }
  if (typeof payload.time === "number" && !Number.isNaN(payload.time)) {
    const syncedTime = Math.max(0, Math.round(payload.time));
    timerSeconds = syncedTime;
    state.time = syncedTime;
    updateTimerLabel(syncedTime);
  }
  const wasMatchOver = state.matchOver;
  state.matchOver = Boolean(payload.matchOver);
  if (state.matchOver && !wasMatchOver) {
    showMatchEnd();
  } else if (!state.matchOver && wasMatchOver) {
    hideMatchEnd();
  }
}

function appendOnlineLog(message) {
  if (!onlineActionLog) {
    return;
  }
  const entry = document.createElement("div");
  entry.textContent = message;
  onlineActionLog.appendChild(entry);
  onlineActionLog.scrollTop = onlineActionLog.scrollHeight;
  while (onlineActionLog.childElementCount > ONLINE_LOG_LIMIT) {
    onlineActionLog.removeChild(onlineActionLog.firstElementChild);
  }
}

function clearOnlineLog() {
  if (onlineActionLog) {
    onlineActionLog.innerHTML = "";
  }
}

function setOnlinePanelCode(code) {
  if (onlinePanelCode) {
    onlinePanelCode.textContent = code || "--";
  }
  if (onlineSetupRoomCodeValue) {
    onlineSetupRoomCodeValue.textContent = code || "--";
  }
  if (onlineSetupRoomCode) {
    if (code) {
      onlineSetupRoomCode.classList.remove("hidden");
    } else {
      onlineSetupRoomCode.classList.add("hidden");
    }
  }
}

function setOnlinePanelStatus(text) {
  if (onlinePanelStatus) {
    onlinePanelStatus.textContent = text;
  }
}

function showOnlinePanel() {
  if (onlinePanel) {
    onlinePanel.classList.remove("hidden");
  }
}

function hideOnlinePanel() {
  if (onlinePanel) {
    onlinePanel.classList.add("hidden");
  }
}

function updateOnlineSetupFeedback(message, variant = "info") {
  if (!onlineSetupFeedback) {
    return;
  }
  onlineSetupFeedback.textContent = message || "";
  onlineSetupFeedback.dataset.variant = variant;
}

function openOnlineSetup() {
  if (onlineSetupOverlay) {
    onlineSetupOverlay.classList.remove("hidden");
  }
  updateOnlineSetupFeedback("");
  if (onlineJoinCodeInput) {
    onlineJoinCodeInput.value = "";
    onlineJoinCodeInput.focus();
  }
  if (onlineSetupRoomCode) {
    onlineSetupRoomCode.classList.add("hidden");
  }
}

function closeOnlineSetup() {
  if (onlineSetupOverlay) {
    onlineSetupOverlay.classList.add("hidden");
  }
}

function clearRemoteKeyState() {
  const remotePlayer = getOnlineRemotePlayer();
  if (!remotePlayer) {
    return;
  }
  const inputs = PLAYER_INPUTS[remotePlayer];
  if (inputs) {
    state.pressed[inputs.left] = false;
    state.pressed[inputs.right] = false;
    if (inputs.jump) {
      state.pressed[inputs.jump] = false;
    }
    if (inputs.foot) {
      state.pressed[inputs.foot] = false;
    }
    if (inputs.powers) {
      inputs.powers.forEach((key) => {
        state.pressed[key] = false;
      });
    }
  }
  const player = state.players[remotePlayer];
  if (player) {
    player.vx = 0;
    if (player.foot) {
      player.foot.raising = false;
    }
  }
  const control = playerControl[remotePlayer];
  if (control) {
    control.bufferedJump = 0;
  }
}

function ensureOnlineDefaults() {
  onlineOpponentReady = false;
  onlineRoomCode = "";
  resetOnlineSelectionState();
  hideCharacterSelection();
  setOnlinePanelCode("--");
  setOnlinePanelStatus("Sin conexion");
  hideOnlinePanel();
  clearOnlineLog();
  updateOnlineSetupFeedback("");
}

function broadcastOnlineInput(code, pressed, options = {}) {
  if (!privateSocket) {
    return;
  }
  const { silent = true, force = false } = options;
  if (!force && (mode !== "online" || !onlineOpponentReady)) {
    return;
  }
  const localPlayer = getOnlineLocalPlayer();
  if (!localPlayer) {
    return;
  }
  const inputs = PLAYER_INPUTS[localPlayer];
  if (!inputs) {
    return;
  }
  if (code === inputs.left) {
    privateSocket.send({ type: "move", dir: "left", active: pressed });
    if (!silent) {
      appendOnlineLog(pressed ? "Enviando: mover izquierda" : "Enviando: detener izquierda");
    }
  } else if (code === inputs.right) {
    privateSocket.send({ type: "move", dir: "right", active: pressed });
    if (!silent) {
      appendOnlineLog(pressed ? "Enviando: mover derecha" : "Enviando: detener derecha");
    }
  } else if (code === inputs.jump) {
    if (pressed) {
      privateSocket.send({ type: "jump" });
      if (!silent) {
        appendOnlineLog("Enviando: salto");
      }
    }
  } else if (code === inputs.foot) {
    privateSocket.send({ type: "foot", active: pressed });
    if (!silent && pressed) {
      appendOnlineLog("Enviando: patada");
    }
  } else if (inputs.powers && inputs.powers.includes(code) && pressed) {
    const slot = inputs.powers.indexOf(code) + 1;
    privateSocket.send({ type: "power", slot });
    if (!silent) {
      appendOnlineLog(`Enviando: poder ${slot}`);
    }
  }
}

function sendOnlineStateSnapshot({ force = false } = {}) {
  if (!privateSocket || onlineRole !== "host") {
    return;
  }
  if (!onlineOpponentReady && !force) {
    return;
  }
  const payload = {
    type: "state",
    ball: {
      x: state.ball.x,
      y: state.ball.y,
      vx: state.ball.vx,
      vy: state.ball.vy,
      rotation: state.ball.rotation,
      spin: state.ball.spin,
    },
    score: {
      left: state.score.left,
      right: state.score.right,
    },
    time: timerSeconds,
    matchOver: state.matchOver,
    goalCooldown,
  };
  privateSocket.send(payload);
}

function handleOnlineActionButton(action) {
  if (!privateSocket) {
    appendOnlineLog("Primero conectate a una sala.");
    return;
  }
  if (mode !== "online" || !onlineOpponentReady) {
    appendOnlineLog("La partida aun no comenzo.");
    return;
  }
  const localPlayer = getOnlineLocalPlayer();
  if (!localPlayer) {
    appendOnlineLog("Configura tu rol antes de enviar acciones.");
    return;
  }
  const inputs = PLAYER_INPUTS[localPlayer];
  if (!inputs) {
    return;
  }
  if (action === "move-left") {
    broadcastOnlineInput(inputs.left, true, { silent: false });
    setTimeout(() => broadcastOnlineInput(inputs.left, false, { silent: true }), 220);
  } else if (action === "move-right") {
    broadcastOnlineInput(inputs.right, true, { silent: false });
    setTimeout(() => broadcastOnlineInput(inputs.right, false, { silent: true }), 220);
  } else if (action === "jump") {
    broadcastOnlineInput(inputs.jump, true, { silent: false });
  } else if (action === "foot") {
    broadcastOnlineInput(inputs.foot, true, { silent: false });
    setTimeout(() => broadcastOnlineInput(inputs.foot, false, { silent: true }), 220);
  }
}

function handleOnlineGameplayMessage(payload) {
  if (!payload || typeof payload.type !== "string") {
    return;
  }
  if (payload.type === "selection_choose") {
    applyOnlineRemoteSelection(payload.player, payload.characterId);
    const remotePlayer = getOnlineRemotePlayer();
    if (payload.player && payload.player === remotePlayer && selectedCharacters[remotePlayer]) {
      appendOnlineLog(`Oponente eligio ${selectedCharacters[remotePlayer].name}`);
    }
    return;
  }
  if (payload.type === "selection_ready") {
    const player = payload.player;
    const ready = payload.ready !== false;
    setOnlineSelectionReady(player, ready);
    if (player === getOnlineRemotePlayer()) {
      appendOnlineLog(ready ? "Oponente esta listo" : "Oponente cancelo listo");
      updateOnlineSetupFeedback(
        ready ? "Tu rival esta listo." : "Tu rival sigue eligiendo.",
        ready ? "success" : "info",
      );
    }
    if (onlineRole === "host" && onlineSelectionReady.p1 && onlineSelectionReady.p2) {
      finalizeOnlineSelection();
    }
    return;
  }
  if (payload.type === "selection_start") {
    onlineSelectionStartPending = true;
    startOnlineMatch();
    return;
  }
  if (payload.type === "state") {
    handleOnlineStateSync(payload);
    return;
  }
  const remotePlayer = getOnlineRemotePlayer();
  if (!remotePlayer) {
    return;
  }
  const inputs = PLAYER_INPUTS[remotePlayer];
  if (payload.type === "move") {
    if (!inputs) {
      return;
    }
    const direction = payload.dir;
    const active = payload.active !== false;
    if (direction === "left") {
      state.pressed[inputs.left] = active;
      if (active) {
        state.pressed[inputs.right] = false;
        appendOnlineLog("Oponente: izquierda");
      } else {
        appendOnlineLog("Oponente: suelta izquierda");
      }
    } else if (direction === "right") {
      state.pressed[inputs.right] = active;
      if (active) {
        state.pressed[inputs.left] = false;
        appendOnlineLog("Oponente: derecha");
      } else {
        appendOnlineLog("Oponente: suelta derecha");
      }
    } else if (direction === "stop") {
      state.pressed[inputs.left] = false;
      state.pressed[inputs.right] = false;
      appendOnlineLog("Oponente: detiene movimiento");
    }
  } else if (payload.type === "jump") {
    queueJump(remotePlayer);
    appendOnlineLog("Oponente: salto");
  } else if (payload.type === "foot") {
    const active = payload.active !== false;
    setFootRaise(remotePlayer, active);
    appendOnlineLog(active ? "Oponente: patada" : "Oponente: suelta patada");
  } else if (payload.type === "power") {
    activateCharacterPower(remotePlayer);
    appendOnlineLog("Oponente: activo un poder");
  }
}

function startOnlineMatch() {
  hideCharacterSelection();
  resetOnlineSelectionState();
  disconnectSocket();
  hideMenuScreen();
  closeOnlineSetup();
  showOnlinePanel();
  clearOnlineLog();
  clearRemoteKeyState();
  resetMatch();
  if (selectedCharacters.p1) {
    applySelectionToPlayer("p1", selectedCharacters.p1);
  }
  if (selectedCharacters.p2) {
    applySelectionToPlayer("p2", selectedCharacters.p2);
  }
  resetPositions();
  startTimer();
  mode = "online";
  pendingMode = null;
  onlineOpponentReady = true;
  onlineStateBroadcastAccumulator = 0;
  const roleLabel = onlineRole === "host" ? "Anfitrion" : "Invitado";
  const codeDisplay = onlineRoomCode || "--";
  updateModeLabel(`Online (${roleLabel})`);
  updateStatus(`Sala ${codeDisplay} en juego`);
  setOnlinePanelStatus("Partida en curso");
  setOnlinePanelCode(codeDisplay);
  updateOnlineSetupFeedback("Partida iniciada.", "success");
  appendOnlineLog("Partida iniciada");
  if (onlineRole === "host") {
    sendOnlineStateSnapshot({ force: true });
  }
}

function handleOpponentLeft() {
  appendOnlineLog("El oponente abandono la sala.");
  setOnlinePanelStatus("Oponente desconectado");
  updateStatus("Oponente desconectado");
  updateOnlineSetupFeedback("El oponente abandono la sala.", "info");
  onlineOpponentReady = false;
  resetOnlineSelectionState();
  hideCharacterSelection();
  if (pendingMode === "online") {
    pendingMode = null;
  }
  clearRemoteKeyState();
  clearInterval(timerInterval);
  timerInterval = null;
  state.matchOver = true;
}

function handlePrivateSocketClose() {
  if (onlineClosing) {
    onlineClosing = false;
    return;
  }
  privateSocket = null;
  onlineOpponentReady = false;
  appendOnlineLog("Conexion cerrada.");
  setOnlinePanelStatus("Desconectado");
  resetOnlineSelectionState();
  hideCharacterSelection();
  if (pendingMode === "online") {
    pendingMode = null;
  }
  if (mode === "online") {
    clearInterval(timerInterval);
    timerInterval = null;
    state.matchOver = true;
    updateStatus("Conexion perdida");
  }
}

function disconnectPrivateRoom({ resetRole = true } = {}) {
  if (privateSocket) {
    onlineClosing = true;
    privateSocket.close();
  }
  privateSocket = null;
  clearRemoteKeyState();
  onlineOpponentReady = false;
  resetOnlineSelectionState();
  hideCharacterSelection();
  if (resetRole) {
    onlineRole = null;
    onlineRoomCode = "";
  }
  setOnlinePanelCode(resetRole ? "--" : onlineRoomCode || "--");
  setOnlinePanelStatus("Sin conexion");
  hideOnlinePanel();
  clearOnlineLog();
  updateOnlineSetupFeedback("");
}

function connectPrivateRoom({ intent, code }) {
  if (privateSocket) {
    disconnectPrivateRoom({ resetRole: false });
  }
  onlineClosing = false;
  try {
    privateSocket = new PrivateRoomSocket({
      mode: intent === "create" ? "create" : "join",
      code,
      onMessage: handlePrivateRoomMessage,
      onClose: handlePrivateSocketClose,
    });
  } catch (error) {
    console.error("No se pudo abrir la conexion WebSocket privada:", error);
    updateOnlineSetupFeedback("No se pudo abrir la conexion.", "error");
  }
}

function handlePrivateRoomMessage(payload) {
  if (!payload || typeof payload.type !== "string") {
    return;
  }
  if (payload.type === "room_created") {
    onlineRoomCode = payload.code || "";
    onlineOpponentReady = false;
    setOnlinePanelCode(onlineRoomCode);
    setOnlinePanelStatus("Comparte el codigo");
    updateOnlineSetupFeedback(`Comparte el codigo ${onlineRoomCode}`, "success");
    updateStatus(`Sala ${onlineRoomCode} creada`);
    showOnlinePanel();
    appendOnlineLog(`Sala creada: ${onlineRoomCode}`);
    return;
  }
  if (payload.type === "waiting_opponent") {
    onlineOpponentReady = false;
    setOnlinePanelStatus("Esperando oponente");
    updateStatus(
      onlineRoomCode ? `Sala ${onlineRoomCode}: esperando oponente` : "Esperando oponente",
    );
    updateOnlineSetupFeedback("Esperando a tu oponente...", "info");
    appendOnlineLog("Esperando oponente...");
    return;
  }
  if (payload.type === "room_joined") {
    onlineRoomCode = payload.code || onlineRoomCode;
    onlineOpponentReady = false;
    setOnlinePanelCode(onlineRoomCode);
    setOnlinePanelStatus("Conectado. Espera inicio.");
    updateOnlineSetupFeedback("Conectado. Espera a tu oponente.", "success");
    showOnlinePanel();
    appendOnlineLog(`Conectado a sala ${onlineRoomCode}`);
    return;
  }
  if (payload.type === "match_start") {
    onlineOpponentReady = false;
    if (payload.code) {
      onlineRoomCode = payload.code;
    }
    beginOnlineCharacterSelection();
    return;
  }
  if (payload.type === "opponent_left") {
    handleOpponentLeft();
    return;
  }
  if (payload.type === "error") {
    updateOnlineSetupFeedback(payload.message || "No se pudo ingresar a la sala.", "error");
    appendOnlineLog(`Error: ${payload.message || "Operacion invalida"}`);
    setOnlinePanelStatus("Error de conexion");
    onlineOpponentReady = false;
    return;
  }
  handleOnlineGameplayMessage(payload);
}

/** Vincula los eventos de la interfaz y del teclado. */
function setupUI() {
  ensureOnlineDefaults();
  if (idleStartButton) {
    idleStartButton.addEventListener("click", () => {
      showMenuScreen({ resetSelections: false });
    });
  }
  if (idleOverlay) {
    idleOverlay.addEventListener("click", (event) => {
      if (event.target === idleOverlay) {
        showMenuScreen({ resetSelections: false });
      }
    });
  }
  if (openMainMenuButton) {
    openMainMenuButton.addEventListener("click", () => {
      showMenuScreen({ resetSelections: true });
    });
  }
  if (menuCloseButton) {
    menuCloseButton.addEventListener("click", () => {
      hideMenuScreen();
    });
  }
  if (menuScreen) {
    menuScreen.addEventListener("click", (event) => {
      if (event.target === menuScreen) {
        hideMenuScreen();
      }
    });
  }
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menuScreen && !menuScreen.classList.contains("hidden")) {
      hideMenuScreen();
    }
  });
  if (menuStartLocalButton) {
    menuStartLocalButton.addEventListener("click", () => {
      prepareLocalMatch({ keepSelections: false });
    });
  }
  if (menuStartOnlineButton) {
    menuStartOnlineButton.addEventListener("click", () => {
      disconnectSocket();
      disconnectPrivateRoom({ resetRole: true });
      ensureOnlineDefaults();
      hideCharacterSelection();
      hideMatchEnd();
      pendingMode = "online";
      hideMenuScreen();
      updateModeLabel("Multijugador Online");
      updateStatus("Configura tu sala privada");
      openOnlineSetup();
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
  if (onlineSetupCloseButton) {
    onlineSetupCloseButton.addEventListener("click", () => {
      closeOnlineSetup();
      showMenuScreen({ resetSelections: false });
    });
  }
  if (onlineCreateRoomButton) {
    onlineCreateRoomButton.addEventListener("click", () => {
      disconnectPrivateRoom({ resetRole: true });
      onlineRole = "host";
      ensureOnlineDefaults();
      showOnlinePanel();
      setOnlinePanelStatus("Creando sala...");
      updateStatus("Creando sala privada");
      updateOnlineSetupFeedback("Generando codigo...", "info");
      connectPrivateRoom({ intent: "create" });
    });
  }
  if (onlineJoinForm) {
    onlineJoinForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const code = onlineJoinCodeInput ? onlineJoinCodeInput.value.trim().toUpperCase() : "";
      if (!code || code.length < 4) {
        updateOnlineSetupFeedback("Ingresa un codigo valido.", "error");
        return;
      }
      disconnectPrivateRoom({ resetRole: true });
      onlineRole = "guest";
      ensureOnlineDefaults();
      onlineRoomCode = code;
      setOnlinePanelCode(code);
      showOnlinePanel();
      setOnlinePanelStatus("Conectando...");
      updateStatus(`Uniendote a la sala ${code}`);
      updateOnlineSetupFeedback("Conectando...", "info");
      connectPrivateRoom({ intent: "join", code });
    });
  }
  if (onlineLeaveButton) {
    onlineLeaveButton.addEventListener("click", () => {
      disconnectPrivateRoom({ resetRole: true });
      ensureOnlineDefaults();
      closeOnlineSetup();
      updateStatus("Desconectado");
      showMenuScreen({ resetSelections: false });
    });
  }
  onlineActionButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.onlineAction;
      if (action) {
        handleOnlineActionButton(action);
      }
    });
  });
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
      if (event.code === FOOT_KEYS.p1 && isLocalPlayerControl("p1")) {
        event.preventDefault();
        setFootRaise("p1", true);
      }
      if (event.code === FOOT_KEYS.p2 && isLocalPlayerControl("p2")) {
        event.preventDefault();
        setFootRaise("p2", true);
      }
      setLocalKeyState(event.code, true);
      if (!event.repeat) {
        broadcastOnlineInput(event.code, true);
        if (event.code === POWER_KEYS.p1 && isLocalPlayerControl("p1")) {
          event.preventDefault();
          activateCharacterPower("p1");
        }
        if (event.code === POWER_KEYS.p2 && isLocalPlayerControl("p2")) {
          event.preventDefault();
          activateCharacterPower("p2");
        }
        if (event.code === jumpKeys.p1 && isLocalPlayerControl("p1")) {
          queueJump("p1");
        }
        if (event.code === jumpKeys.p2 && isLocalPlayerControl("p2")) {
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
      if (event.code === FOOT_KEYS.p1 && isLocalPlayerControl("p1")) {
        event.preventDefault();
        setFootRaise("p1", false);
      }
      if (event.code === FOOT_KEYS.p2 && isLocalPlayerControl("p2")) {
        event.preventDefault();
        setFootRaise("p2", false);
      }
      setLocalKeyState(event.code, false);
      broadcastOnlineInput(event.code, false);
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
  activeProfileId = selectedProfileId;
  activeProfileCharacterId = selectedCharacters.p1 ? selectedCharacters.p1.id : null;
  setVipMusicGameplayActive(Boolean(getSelectedProfile()?.isVip));
  mode = "local";
  disconnectSocket();
  disconnectPrivateRoom({ resetRole: true });
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
  activeProfileId = selectedProfileId;
  activeProfileCharacterId = selectedCharacters.p1 ? selectedCharacters.p1.id : null;
  setVipMusicGameplayActive(Boolean(getSelectedProfile()?.isVip));
  mode = "ai";
  disconnectSocket();
  disconnectPrivateRoom({ resetRole: true });
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
  state.matchOver = false;
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
    Object.entries(state.powers).forEach(([playerKey, power]) => {
      if (!power) {
        return;
      }
      power.speedBoostTimer = 0;
      power.speedBoostCooldown = 0;
      power.sizeBoostTimer = 0;
      power.sizeBoostCooldown = 0;
      power.sizeBoostValue = 0;
      power.sizeBoostProgress = 0;
      power.smokeCooldown = 0;
      power.smokeActiveTimer = 0;
      power.smokeAffectedTimer = 0;
      power.goatChargeTimer = 0;
      power.goatChargeCooldown = 0;
      power.goatChargeHasHit = false;
      power.stunTimer = 0;
      power.perfilBajoTimer = 0;
      power.perfilBajoCooldown = 0;
      power.perfilBajoHasStunned = false;
      power.perfilBajoStunFlashTimer = 0;
      power.cascoHeadTimer = 0;
      power.cascoHeadCooldown = 0;
      power.cascoHeadHitCooldown = 0;
      power.cascoHeadFlashTimer = 0;
      power.chimeneaBreathTimer = 0;
      power.chimeneaBreathCooldown = 0;
      power.chimeneaBreathOriginX = 0;
      power.chimeneaBreathOriginY = 0;
      power.chimeneaBreathElapsed = 0;
      power.chimeneaBreathCooldownPending = false;
      power.chimeneaSlowTimer = 0;
      power.laruchaBookTimer = 0;
      power.laruchaBookCooldown = 0;
      power.laruchaBookFadeTimer = 0;
      power.laruchaBookCooldownPending = false;
      const defaultDirection = state.players[playerKey]?.facing >= 0 ? 1 : -1;
      power.goatChargeDirection = defaultDirection;
      power.chimeneaBreathDirection = defaultDirection;
    });
    updatePowerIndicators();
  }
  if (state.players.p1) {
    state.players.p1.scaleBoost = 0;
    state.players.p1.powerSpriteOverride = null;
  }
  if (state.players.p2) {
    state.players.p2.scaleBoost = 0;
    state.players.p2.powerSpriteOverride = null;
  }
  clearInterval(timerInterval);
  timerInterval = null;
  Object.values(state.players).forEach((player) => resetPlayerFoot(player));
  state.ball.rotation = 0;
  state.ball.spin = 0;
  onlineStateBroadcastAccumulator = 0;
  hideMatchEnd();
  setPerfilBajoGrayscale(false);
  setPerfilBajoMusicActive(false);
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
  await loadProfiles();
  setupUI();
  initializeCharacterSelection();
  showMenuScreen({ resetSelections: true });
  hideMenuScreen();
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

function drawLaruchaBookBarrier() {
  const image = sprites.laruchaBook;
  ["p1", "p2"].forEach((playerKey) => {
    if (!isPlayerLarucha(playerKey)) {
      return;
    }
    const powers = state.powers?.[playerKey];
    if (!powers) {
      return;
    }
    const activeTimer = Math.max(0, Number(powers.laruchaBookTimer) || 0);
    const fadeTimer = Math.max(0, Number(powers.laruchaBookFadeTimer) || 0);
    const isActive = activeTimer > 0;
    const isFading = !isActive && fadeTimer > 0;
    if (!isActive && !isFading) {
      return;
    }
    const fadeFraction = LARUCHA_BOOK_FADE_DURATION > 0 ? fadeTimer / LARUCHA_BOOK_FADE_DURATION : 0;
    const opacityBase = isActive ? 0.9 : 0.9 * clamp(fadeFraction, 0, 1);
    const pulse =
      isActive && LARUCHA_BOOK_DURATION > 0
        ? 0.05 * Math.sin(((LARUCHA_BOOK_DURATION - activeTimer) / LARUCHA_BOOK_DURATION) * Math.PI * 4)
        : 0;
    const opacity = clamp(opacityBase + pulse, 0, 1);
    const drawWidth = 210;
    const drawHeight = GOAL_MOUTH_HEIGHT + 90;
    const baseY = GOAL_TOP - 50;
    const offsetX = playerKey === "p1" ? GOAL_LINE_LEFT - drawWidth + 6 : GOAL_LINE_RIGHT - 6;
    const bookX = playerKey === "p1" ? offsetX : offsetX - drawWidth;
    ctx.save();
    ctx.globalAlpha = opacity;
    if (image && !image.__missing && image.complete) {
      ctx.drawImage(image, bookX, baseY, drawWidth, drawHeight);
    } else {
      ctx.fillStyle = "rgba(160, 120, 60, 0.85)";
      ctx.fillRect(bookX, baseY, drawWidth, drawHeight);
    }
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = `rgba(240, 210, 160, ${(0.25 * opacity).toFixed(3)})`;
    ctx.fillRect(bookX, baseY, drawWidth, drawHeight);
    ctx.restore();

    const rect = getLaruchaBookRect(playerKey);
    const barrierOpacity = clamp(opacity * 0.3, 0, 0.4);
    ctx.save();
    ctx.fillStyle = `rgba(110, 90, 60, ${barrierOpacity.toFixed(3)})`;
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    ctx.restore();
  });
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
  if (isLaruchaBookActive("p1")) {
    resolveBallRectCollision(state.ball, getLaruchaBookRect("p1"));
  }
  if (isLaruchaBookActive("p2")) {
    resolveBallRectCollision(state.ball, getLaruchaBookRect("p2"));
  }
}

function playerBallDistanceSq(player) {
  const scale = getPlayerScale(player);
  const effectiveHeight = PLAYER_HEIGHT * scale;
  const centerX = player.x;
  const centerY = player.y - effectiveHeight / 2;
  const dx = state.ball.x - centerX;
  const dy = state.ball.y - centerY;
  return dx * dx + dy * dy;
}

function playerBallImpactMagnitude(player) {
  const scale = getPlayerScale(player);
  const effectiveHeight = PLAYER_HEIGHT * scale;
  const centerX = player.x;
  const centerY = player.y - effectiveHeight / 2;
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
  const playerKey = resolvePlayerKeyFromInstance(player);
  if (playerKey && isPlayerIntangible(playerKey)) {
    return;
  }
  const powers = playerKey ? state.powers?.[playerKey] : null;
  const attributePower = playerKey ? getPlayerPowerMultiplier(playerKey) : 1;
  const scale = getPlayerScale(player);
  const effectiveHeight = PLAYER_HEIGHT * scale;
  const playerRadius = effectiveHeight * 0.45;
  const centerX = player.x;
  const centerY = player.y - effectiveHeight / 2;
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
  const minExitSpeed = (70 + Math.abs(player.vx) * 0.35) * attributePower;
  const exitRelativeVx = state.ball.vx - player.vx;
  const exitRelativeVy = state.ball.vy - player.vy;
  const exitSpeed = exitRelativeVx * nx + exitRelativeVy * ny;
  if (exitSpeed < minExitSpeed) {
    const boost = minExitSpeed - exitSpeed;
    state.ball.vx += nx * boost;
    state.ball.vy += ny * boost;
  }
  if (state.ball.vy > -120 * attributePower) {
    state.ball.vy = -120 * attributePower;
  }
  if (
    playerKey &&
    isPlayerCasco(playerKey) &&
    powers &&
    powers.cascoHeadTimer > 0 &&
    powers.cascoHeadHitCooldown <= 0
  ) {
    const headTop = player.y - effectiveHeight;
    const headBand = headTop + effectiveHeight * 0.35;
    const withinHeadHeight = state.ball.y <= headBand && state.ball.y < centerY;
    const withinHeadWidth =
      Math.abs(state.ball.x - centerX) <= PLAYER_WIDTH * scale * 0.55;
    const upwardImpact = ny < -0.1;
    if (withinHeadHeight && withinHeadWidth && upwardImpact) {
      const exitRelativeVx = state.ball.vx - player.vx;
      const exitRelativeVy = state.ball.vy - player.vy;
      const exitSpeed = exitRelativeVx * nx + exitRelativeVy * ny;
      const extraNeeded = Math.max(0, CASCO_HEAD_MIN_EXIT_SPEED - exitSpeed);
      const impulse = CASCO_HEAD_IMPULSE + extraNeeded;
      const verticalImpulse = impulse + CASCO_HEAD_VERTICAL_BONUS;
      state.ball.vx += nx * impulse + player.facing * CASCO_HEAD_FACING_IMPULSE + player.vx * 0.35;
      state.ball.vy += ny * verticalImpulse;
      state.ball.spin += player.facing * impulse * CASCO_HEAD_SPIN_IMPULSE;
      state.ball.spin = clamp(state.ball.spin, -18, 18);
      const minUpward = -Math.abs(CASCO_HEAD_MIN_EXIT_SPEED * 0.55);
      if (state.ball.vy > minUpward) {
        state.ball.vy = minUpward;
      }
      powers.cascoHeadHitCooldown = CASCO_HEAD_HIT_COOLDOWN;
      powers.cascoHeadFlashTimer = Math.max(
        Number(powers.cascoHeadFlashTimer) || 0,
        CASCO_HEAD_FLASH_DURATION,
      );
      playCascoHeadImpactSound();
    }
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
    if (isLaruchaBookActive("p1")) {
      return null;
    }
    return "right";
  }
  if (state.ball.x + BALL_RADIUS >= GOAL_LINE_RIGHT) {
    if (isLaruchaBookActive("p2")) {
      return null;
    }
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
  if (mode === "online" && onlineRole === "host" && privateSocket) {
    onlineStateBroadcastAccumulator = 0;
    sendOnlineStateSnapshot({ force: true });
  }
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

function getLaruchaBookRect(playerKey) {
  const thickness = Math.max(LARUCHA_BOOK_THICKNESS, BALL_RADIUS * 2);
  const verticalPadding = GOAL_CROSSBAR_THICKNESS + 8;
  const top = GOAL_TOP - verticalPadding;
  const height = GOAL_MOUTH_HEIGHT + verticalPadding + 10;
  if (playerKey === "p1") {
    return {
      x: GOAL_LINE_LEFT - thickness,
      y: top,
      width: thickness,
      height,
    };
  }
  return {
    x: GOAL_LINE_RIGHT,
    y: top,
    width: thickness,
    height,
  };
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
  state.matchOver = true;
  timerInterval = null;
  state.time = 0;
  updateTimerLabel(0);
  showMatchEnd();
  void updateActiveProfileFromMatch();
  setVipMusicGameplayActive(false);
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
  const scale = getPlayerScale(player);
  const width = PLAYER_WIDTH * scale;
  const height = PLAYER_HEIGHT * scale;
  const playerKey = resolvePlayerKeyFromInstance(player);
  const powerState = playerKey ? state.powers?.[playerKey] : null;
  const intangible = Boolean(playerKey) && isPlayerIntangible(playerKey);
  const isCharging =
    Boolean(playerKey) && isPlayerGoat(playerKey) && powerState?.goatChargeTimer > 0;
  const conoStunFlashTimer =
    playerKey && powerState?.perfilBajoStunFlashTimer > 0
      ? powerState.perfilBajoStunFlashTimer
      : 0;
  const colapintoActive = Boolean(playerKey) && isPlayerColapinto(playerKey);
  const colapintoPowerActive =
    colapintoActive && typeof powerState?.speedBoostTimer === "number"
      ? powerState.speedBoostTimer > 0
      : false;
  const primeActive = Boolean(playerKey) && isPlayerPrime(playerKey);
  const primePowerActive = primeActive && typeof powerState?.sizeBoostTimer === "number"
    ? powerState.sizeBoostTimer > 0
    : false;
  const cascoActive = Boolean(playerKey) && isPlayerCasco(playerKey);
  const cascoTimer =
    cascoActive && typeof powerState?.cascoHeadTimer === "number"
      ? Math.max(0, powerState.cascoHeadTimer)
      : 0;
  const cascoGlowStrength =
    cascoTimer > 0
      ? clamp(0.45 + (1 - cascoTimer / CASCO_POWER_DURATION) * 0.4, 0.45, 0.95)
      : 0;
  const cascoFlash =
    typeof powerState?.cascoHeadFlashTimer === "number" && powerState.cascoHeadFlashTimer > 0
      ? clamp(powerState.cascoHeadFlashTimer / CASCO_HEAD_FLASH_DURATION, 0, 1)
      : 0;
  const cascoShouldGlow = cascoGlowStrength > 0 || cascoFlash > 0;
  const chimeneaSlowTimer =
    playerKey && powerState?.chimeneaSlowTimer > 0 ? powerState.chimeneaSlowTimer : 0;
  const chimeneaSlowStrength =
    chimeneaSlowTimer > 0 ? clamp(chimeneaSlowTimer / CHIMENEA_SLOW_DURATION, 0, 1) : 0;
  const chargeFraction = isCharging
    ? clamp(powerState.goatChargeTimer / GOAT_CHARGE_DURATION, 0, 1)
    : 0;
  const direction = isCharging
    ? powerState.goatChargeDirection >= 0
      ? 1
      : -1
    : player.facing >= 0
      ? 1
      : -1;

  if (isCharging) {
    drawGoatChargeTrail(player, scale, chargeFraction, direction);
  }
  if (intangible) {
    drawPerfilBajoGlow(player, scale);
  }
  if (cascoShouldGlow) {
    drawCascoHeadAura(player, scale, cascoGlowStrength, cascoFlash);
  }

  ctx.save();
  ctx.translate(player.x, player.y);
  if (intangible) {
    ctx.globalAlpha = 0.58;
  }
  if (player.facing > 0) {
    ctx.scale(-1, 1);
  }
  const spriteOverridePath =
    player && typeof player.powerSpriteOverride === "string"
      ? player.powerSpriteOverride
      : null;
  let spriteToDraw = sprite;
  if (spriteOverridePath) {
    spriteToDraw = getSprite(spriteOverridePath);
  } else if (colapintoPowerActive) {
    spriteToDraw = getSprite(COLAPINTO_POWER_SPRITE);
  } else if (primePowerActive) {
    spriteToDraw = getSprite(PRIME_POWER_SPRITE);
  }
  ctx.drawImage(
    spriteToDraw,
    -width / 2,
    -height,
    width,
    height,
  );
  ctx.restore();

  if (chimeneaSlowStrength > 0) {
    drawChimeneaSlowTint(player, scale, chimeneaSlowStrength);
  }
  if (conoStunFlashTimer > 0) {
    drawConoStunEffect(player, scale, conoStunFlashTimer);
  }

  if (isCharging) {
    drawGoatChargeAura(player, scale, chargeFraction);
  }
  if (cascoShouldGlow) {
    drawCascoHeadHighlight(player, scale, cascoGlowStrength, cascoFlash);
  }
}

function drawChimeneaBreathClouds() {
  if (!state.powers) {
    return;
  }
  ["p1", "p2"].forEach((playerKey) => {
    if (!isPlayerChimenea(playerKey)) {
      return;
    }
    const powers = state.powers[playerKey];
    const player = state.players[playerKey];
    if (!powers || powers.chimeneaBreathTimer <= 0 || !player) {
      return;
    }
    const direction = powers.chimeneaBreathDirection >= 0 ? 1 : -1;
    const originX = Number.isFinite(powers.chimeneaBreathOriginX)
      ? powers.chimeneaBreathOriginX
      : player.x;
    const originY = Number.isFinite(powers.chimeneaBreathOriginY)
      ? powers.chimeneaBreathOriginY
      : player.y - PLAYER_HEIGHT * 0.45;
    const elapsed = clamp(
      powers.chimeneaBreathElapsed || CHIMENEA_BREATH_DURATION - powers.chimeneaBreathTimer,
      0,
      CHIMENEA_BREATH_DURATION,
    );
    const progress = clamp(elapsed / CHIMENEA_BREATH_DURATION, 0, 1);
    const fade = clamp(powers.chimeneaBreathTimer / CHIMENEA_BREATH_DURATION, 0, 1);
    const centerX =
      originX + direction * (CHIMENEA_CLOUD_START_OFFSET + CHIMENEA_CLOUD_TRAVEL * progress);
    const centerY = originY;
    const halfWidth = CHIMENEA_CLOUD_WIDTH * 0.5;
    const halfHeight = CHIMENEA_CLOUD_HEIGHT * 0.5;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const baseRadius = Math.max(halfWidth, halfHeight);
    const gradient = ctx.createRadialGradient(
      centerX,
      centerY,
      baseRadius * 0.15,
      centerX,
      centerY,
      baseRadius,
    );
    const coreAlpha = 0.18 + fade * 0.14;
    gradient.addColorStop(0, `rgba(210, 225, 240, ${coreAlpha.toFixed(3)})`);
    gradient.addColorStop(0.55, `rgba(180, 205, 225, ${(coreAlpha * 0.65).toFixed(3)})`);
    gradient.addColorStop(1, "rgba(170, 195, 215, 0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, halfWidth, halfHeight, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const swirlOffset = direction * halfWidth * 0.35;
    const swirlY = centerY - halfHeight * 0.2;
    const swirlGradient = ctx.createRadialGradient(
      centerX + swirlOffset,
      swirlY,
      halfHeight * 0.15,
      centerX + swirlOffset,
      swirlY,
      halfWidth * 0.7,
    );
    swirlGradient.addColorStop(0, `rgba(230, 240, 255, ${(0.16 + fade * 0.12).toFixed(3)})`);
    swirlGradient.addColorStop(1, "rgba(220, 235, 255, 0)");
    ctx.fillStyle = swirlGradient;
    ctx.beginPath();
    ctx.ellipse(centerX + swirlOffset, swirlY, halfWidth * 0.65, halfHeight * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
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

function drawPerfilBajoGlow(player, scale) {
  ctx.save();
  ctx.translate(player.x, player.y);
  const width = PLAYER_WIDTH * scale;
  const height = PLAYER_HEIGHT * scale;
  ctx.globalCompositeOperation = "screen";
  const gradient = ctx.createRadialGradient(0, -height * 0.6, width * 0.12, 0, -height * 0.6, width * 0.75);
  gradient.addColorStop(0, "rgba(220, 220, 255, 0.6)");
  gradient.addColorStop(0.4, "rgba(200, 210, 255, 0.35)");
  gradient.addColorStop(1, "rgba(200, 210, 255, 0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.ellipse(0, -height * 0.55, width * 0.65, height * 0.9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawChimeneaSlowTint(player, scale, strength) {
  if (strength <= 0) {
    return;
  }
  ctx.save();
  ctx.translate(player.x, player.y);
  const width = PLAYER_WIDTH * scale;
  const height = PLAYER_HEIGHT * scale;
  const overlayAlpha = 0.16 + strength * 0.28;
  ctx.globalCompositeOperation = "source-atop";
  ctx.fillStyle = `rgba(150, 180, 210, ${overlayAlpha.toFixed(3)})`;
  ctx.fillRect(-width / 2, -height, width, height);
  ctx.restore();

  ctx.save();
  ctx.translate(player.x, player.y);
  const glowAlpha = 0.1 + strength * 0.22;
  ctx.globalCompositeOperation = "lighter";
  const gradient = ctx.createRadialGradient(0, -height * 0.6, width * 0.18, 0, -height * 0.6, width * 0.82);
  gradient.addColorStop(0, `rgba(200, 220, 240, ${glowAlpha.toFixed(3)})`);
  gradient.addColorStop(1, "rgba(180, 200, 220, 0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.ellipse(0, -height * 0.58, width * 0.85, height * 1.02, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawCascoHeadAura(player, scale, glowStrength, flashStrength) {
  const strength = Math.max(glowStrength, 0) + Math.max(flashStrength, 0) * 0.8;
  if (strength <= 0) {
    return;
  }
  ctx.save();
  ctx.translate(player.x, player.y);
  const width = PLAYER_WIDTH * scale;
  const height = PLAYER_HEIGHT * scale;
  const headCenterY = -height * 0.85;
  const radius = width * (0.32 + strength * 0.38);
  ctx.globalCompositeOperation = "lighter";
  const gradient = ctx.createRadialGradient(0, headCenterY, radius * 0.35, 0, headCenterY, radius);
  const innerAlpha = 0.2 + strength * 0.4;
  const midAlpha = 0.08 + strength * 0.25;
  gradient.addColorStop(0, `rgba(210, 240, 255, ${innerAlpha.toFixed(3)})`);
  gradient.addColorStop(0.65, `rgba(90, 190, 255, ${midAlpha.toFixed(3)})`);
  gradient.addColorStop(1, "rgba(70, 140, 255, 0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(0, headCenterY, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawCascoHeadHighlight(player, scale, glowStrength, flashStrength) {
  const intensity = Math.max(glowStrength * 0.8 + flashStrength * 0.5, 0);
  if (intensity <= 0) {
    return;
  }
  ctx.save();
  ctx.translate(player.x, player.y);
  const width = PLAYER_WIDTH * scale;
  const height = PLAYER_HEIGHT * scale;
  const headCenterY = -height * 0.87;
  const radiusX = width * 0.3;
  const radiusY = height * 0.18;
  ctx.globalCompositeOperation = "lighter";
  const primaryAlpha = 0.18 + intensity * 0.55;
  ctx.fillStyle = `rgba(255, 255, 255, ${primaryAlpha.toFixed(3)})`;
  ctx.beginPath();
  ctx.ellipse(0, headCenterY, radiusX, radiusY, 0, 0, Math.PI * 2);
  ctx.fill();

  const secondaryAlpha = 0.12 + intensity * 0.35;
  ctx.fillStyle = `rgba(140, 200, 255, ${secondaryAlpha.toFixed(3)})`;
  ctx.beginPath();
  ctx.ellipse(0, headCenterY + radiusY * 0.35, radiusX * 0.55, radiusY * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();

  if (flashStrength > 0.05) {
    ctx.globalCompositeOperation = "screen";
    const ringRadius = width * (0.28 + flashStrength * 0.25);
    ctx.lineWidth = Math.max(3, ringRadius * 0.12);
    ctx.strokeStyle = `rgba(200, 240, 255, ${(0.22 + flashStrength * 0.4).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(0, headCenterY, ringRadius, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawConoStunEffect(player, scale, timer) {
  ctx.save();
  ctx.translate(player.x, player.y);
  const width = PLAYER_WIDTH * scale;
  const height = PLAYER_HEIGHT * scale;
  const safeDuration = Math.max(CONO_STUN_DURATION, 0.001);
  const clampedTimer = clamp(timer, 0, safeDuration);
  const elapsed = safeDuration - clampedTimer;
  const normalized = clamp(clampedTimer / safeDuration, 0, 1);
  const pulse = 0.5 + 0.5 * Math.sin(elapsed * 16);
  const overlayAlpha = clamp(0.35 * normalized + 0.25 * pulse, 0, 0.75);
  ctx.globalCompositeOperation = "source-atop";
  ctx.fillStyle = `rgba(255, 60, 60, ${overlayAlpha.toFixed(3)})`;
  ctx.fillRect(-width / 2, -height, width, height);
  ctx.restore();

  ctx.save();
  ctx.translate(player.x, player.y);
  const glowAlpha = clamp(0.5 * normalized + 0.3 * pulse, 0, 0.7);
  ctx.globalCompositeOperation = "lighter";
  const gradient = ctx.createRadialGradient(0, -height * 0.6, width * 0.12, 0, -height * 0.6, width * 0.9);
  gradient.addColorStop(0, `rgba(255, 120, 90, ${glowAlpha.toFixed(3)})`);
  gradient.addColorStop(0.65, `rgba(255, 40, 40, ${(glowAlpha * 0.6).toFixed(3)})`);
  gradient.addColorStop(1, "rgba(255, 0, 0, 0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.ellipse(0, -height * 0.58, width * 0.85, height * 0.95, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawGoatChargeTrail(player, scale, chargeFraction, direction) {
  ctx.save();
  ctx.translate(player.x, player.y);
  const width = PLAYER_WIDTH * scale;
  const height = PLAYER_HEIGHT * scale;
  const sign = direction >= 0 ? -1 : 1;
  const offsetX = direction >= 0 ? -width / 2 : width / 2;
  const trailLength = (140 + 80 * (1 - chargeFraction)) * scale;
  const upperOffset = -height * 0.55;
  const lowerOffset = height * 0.05;
  ctx.globalCompositeOperation = "lighter";
  const gradient = ctx.createLinearGradient(
    offsetX,
    -height * 0.35,
    offsetX + sign * trailLength,
    -height * 0.35,
  );
  gradient.addColorStop(0, `rgba(255, 90, 50, ${(0.42 + 0.32 * (1 - chargeFraction)).toFixed(3)})`);
  gradient.addColorStop(0.7, `rgba(255, 40, 20, ${(0.2 + 0.25 * (1 - chargeFraction)).toFixed(3)})`);
  gradient.addColorStop(1, "rgba(255, 0, 0, 0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(offsetX, -height * 0.1);
  ctx.lineTo(offsetX + sign * trailLength, upperOffset);
  ctx.lineTo(offsetX + sign * trailLength, lowerOffset);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawGoatChargeAura(player, scale, chargeFraction) {
  ctx.save();
  ctx.translate(player.x, player.y);
  const width = PLAYER_WIDTH * scale;
  const height = PLAYER_HEIGHT * scale;
  const auraIntensity = 0.32 + 0.28 * (1 - chargeFraction);
  ctx.globalCompositeOperation = "lighter";
  const gradient = ctx.createRadialGradient(0, -height * 0.6, width * 0.15, 0, -height * 0.6, width);
  gradient.addColorStop(0, `rgba(255, 80, 60, ${auraIntensity.toFixed(3)})`);
  gradient.addColorStop(1, "rgba(255, 20, 20, 0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.ellipse(0, -height * 0.55, width * 0.7, height * 0.9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgba(255, 40, 40, ${(0.24 + 0.26 * (1 - chargeFraction)).toFixed(3)})`;
  ctx.fillRect(-width / 2, -height, width, height);
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







