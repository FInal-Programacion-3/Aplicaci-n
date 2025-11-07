"""Perfiles de jugador persistidos del lado del servidor."""

from __future__ import annotations

import re
from abc import ABC, abstractmethod
from collections import deque
from dataclasses import InitVar, dataclass, field
from datetime import datetime
from typing import Any, Deque, Dict, Iterable, Mapping, Optional

# Constantes y utilidades de validación
NICKNAME_PATTERN = re.compile(r"^[A-Za-z0-9_]{3,24}$")
SECRET_CODE_PATTERN = re.compile(r"^SC-[A-Z0-9]{4}$")
DEFAULT_VIP_MUSIC = "/static/musicavip.mp3"
DEFAULT_STATS = {"speed": 50.0, "jump": 50.0, "power": 50.0}


def _clamp(value: float, lower: float, upper: float) -> float:
    return max(lower, min(upper, value))


def _normalize_asset_path(value: Optional[str]) -> str:
    if not value:
        return ""
    candidate = value.strip()
    if not candidate:
        return ""
    lowered = candidate.lower()
    if lowered.startswith("http://") or lowered.startswith("https://") or lowered.startswith("data:"):
        return candidate
    if candidate.startswith("/static/"):
        candidate = candidate[len("/static/") :]
    candidate = candidate.lstrip("/")
    return candidate


class ProfileBase(ABC):
    """Contrato mínimo para perfiles gestionados en el backend."""

    id: int
    nickname: str

    @abstractmethod
    def to_payload(self) -> Dict[str, object]:
        """Devuelve los datos serializables que consumen las APIs."""

    @abstractmethod
    def apply_badge(self) -> str:
        """Devuelve la insignia asociada al perfil."""


@dataclass(slots=True)
class PlayerProfile(ProfileBase):
    """Perfil estándar de jugador con historial de personajes usados."""

    id: int
    nickname: str
    favourite_character: str
    secret_code: InitVar[str]
    wins: int = 0
    losses: int = 0
    goals_for: int = 0
    goals_against: int = 0
    last_match: Optional[datetime] = None
    recent_characters: Deque[str] = field(default_factory=lambda: deque(maxlen=8))
    _secret_code: str = field(init=False, repr=False)

    def __post_init__(self, secret_code: str) -> None:
        self.nickname = self._validate_nickname(self.nickname)
        self._secret_code = self._validate_secret(secret_code)

    @staticmethod
    def _validate_nickname(value: str) -> str:
        if not NICKNAME_PATTERN.fullmatch(value):
            raise ValueError("El apodo debe tener entre 3 y 24 caracteres alfanuméricos o guion bajo.")
        return value

    @staticmethod
    def _validate_secret(value: str) -> str:
        if not SECRET_CODE_PATTERN.fullmatch(value):
            raise ValueError("El código secreto debe respetar el patrón SC-XXXX.")
        return value

    @property
    def secret_code(self) -> str:
        """Valor encapsulado para exponer en modo de solo lectura."""
        return self._secret_code

    @secret_code.setter
    def secret_code(self, value: str) -> None:
        self._secret_code = self._validate_secret(value)

    def record_match(self, character_id: str, goals_for: int, goals_against: int) -> None:
        """Actualiza estadísticas básicas e historial de personajes."""
        if goals_for > goals_against:
            self.wins += 1
        elif goals_against > goals_for:
            self.losses += 1
        self.goals_for += max(goals_for, 0)
        self.goals_against += max(goals_against, 0)
        self.last_match = datetime.utcnow()
        self.recent_characters.appendleft(character_id)

    def recent_history(self) -> Iterable[str]:
        """Devuelve el historial de personajes jugados."""
        return list(self.recent_characters)

    def to_payload(self) -> Dict[str, object]:
        return {
            "id": self.id,
            "nickname": self.nickname,
            "secretCode": self.secret_code,
            "favouriteCharacter": self.favourite_character,
            "wins": self.wins,
            "losses": self.losses,
            "goalsFor": self.goals_for,
            "goalsAgainst": self.goals_against,
            "isVip": False,
            "badge": self.apply_badge(),
            "lastMatch": self.last_match.isoformat() if self.last_match else None,
            "recentCharacters": list(self.recent_characters),
        }

    def apply_badge(self) -> str:
        return "Jugador"


@dataclass(slots=True)
class VipPlayerProfile(PlayerProfile):
    """Perfil con beneficios adicionales y badge personalizado."""

    tier: str = "Gold"
    bonus_multiplier: float = 1.2
    music_track: str = DEFAULT_VIP_MUSIC
    skin_overrides: Dict[str, Dict[str, str]] = field(default_factory=dict)
    custom_character: Optional[Dict[str, object]] = None

    def __post_init__(self, secret_code: str) -> None:  # type: ignore[override]
        super(VipPlayerProfile, self).__post_init__(secret_code)
        self.music_track = self._normalize_music_track(self.music_track)
        self.skin_overrides = self._normalize_skin_overrides(self.skin_overrides)
        self.custom_character = self._normalize_custom_character(self.custom_character)

    def apply_badge(self) -> str:
        return f"VIP {self.tier}"

    def to_payload(self) -> Dict[str, object]:
        payload = super(VipPlayerProfile, self).to_payload()
        payload.update(
            {
                "isVip": True,
                "tier": self.tier,
                "bonusMultiplier": self.bonus_multiplier,
                "musicTrack": self.music_track,
                "vipSkins": self.skin_overrides,
                "customCharacter": self.custom_character,
            }
        )
        return payload

    @staticmethod
    def _normalize_music_track(value: Optional[str]) -> str:
        if not value:
            return DEFAULT_VIP_MUSIC
        track = value.strip()
        if not track:
            return DEFAULT_VIP_MUSIC
        lowered = track.lower()
        if lowered.startswith("http://") or lowered.startswith("https://") or lowered.startswith("data:"):
            return track
        if track.startswith("/"):
            return track
        if track.startswith("static/"):
            return f"/{track}"
        return f"/static/{track}"

    @staticmethod
    def _normalize_stats(raw: Optional[Mapping[str, object]]) -> Dict[str, float]:
        stats = dict(DEFAULT_STATS)
        if not raw:
            return stats
        for key, default in DEFAULT_STATS.items():
            candidate = raw.get(key, default)
            try:
                value = float(candidate)  # type: ignore[arg-type]
            except (TypeError, ValueError):
                value = default
            stats[key] = _clamp(value, 0.0, 100.0)
        return stats

    def _normalize_custom_character(
        self,
        raw: Optional[Mapping[str, object]],
    ) -> Optional[Dict[str, object]]:
        if not raw:
            return None
        name = str(raw.get("name") or "").strip()
        sprite = _normalize_asset_path(str(raw.get("sprite") or ""))
        if not sprite:
            return None
        portrait = _normalize_asset_path(str(raw.get("portrait") or "")) or sprite
        power_icon = _normalize_asset_path(str(raw.get("powerIcon") or "")) or None
        tagline = str(raw.get("tagline") or raw.get("description") or "").strip()
        description = str(raw.get("description") or tagline or "").strip()
        stats_payload = raw.get("stats")
        stats = self._normalize_stats(stats_payload if isinstance(stats_payload, Mapping) else None)
        identifier = str(raw.get("id") or "").strip()
        if not identifier:
            suffix = self.id if getattr(self, "id", None) else "pending"
            identifier = f"vip-{suffix}-custom"
        payload: Dict[str, object] = {
            "id": identifier,
            "name": name or "Personaje VIP",
            "sprite": sprite,
            "portrait": portrait,
            "powerIcon": power_icon or portrait,
            "tagline": tagline or "Exclusivo VIP",
            "description": description or tagline or "Exclusivo VIP",
            "stats": stats,
            "isVipExclusive": True,
        }
        return payload

    @staticmethod
    def _normalize_skin_overrides(
        raw: Optional[Mapping[str, object]],
    ) -> Dict[str, Dict[str, str]]:
        if not raw:
            return {}
        normalized: Dict[str, Dict[str, str]] = {}
        for key, data in raw.items():
            if not isinstance(key, str) or not key.strip():
                continue
            if not isinstance(data, Mapping):
                continue
            sprite = _normalize_asset_path(str(data.get("sprite") or ""))
            if not sprite:
                continue
            portrait = _normalize_asset_path(str(data.get("portrait") or "") or sprite)
            power_icon = _normalize_asset_path(str(data.get("powerIcon") or "")) or None
            normalized[key] = {
                "sprite": sprite,
                "portrait": portrait or sprite,
            }
            if power_icon:
                normalized[key]["powerIcon"] = power_icon
        return normalized

    def set_custom_character(self, data: Optional[Mapping[str, object]]) -> None:
        """Permite reemplazar el personaje exclusivo desde las APIs."""
        self.custom_character = self._normalize_custom_character(data)


def profile_from_dict(data: Dict[str, object]) -> PlayerProfile:
    """Crea un perfil de dominio a partir de un diccionario serializado."""
    profile_type = data.get("type", "standard")
    common_kwargs = {
        "id": int(data["id"]),
        "nickname": str(data["nickname"]),
        "secret_code": str(data["secretCode"]),
        "favourite_character": str(data.get("favouriteCharacter", "player1")),
        "wins": int(data.get("wins", 0)),
        "losses": int(data.get("losses", 0)),
        "goals_for": int(data.get("goalsFor", 0)),
        "goals_against": int(data.get("goalsAgainst", 0)),
    }
    recent = deque(data.get("recentCharacters") or [], maxlen=8)
    last_match_raw = data.get("lastMatch")
    if last_match_raw:
        try:
            common_kwargs["last_match"] = datetime.fromisoformat(last_match_raw)
        except ValueError:
            common_kwargs["last_match"] = None
    common_kwargs["recent_characters"] = recent

    if profile_type == "vip":
        skin_overrides = data.get("vipSkins")
        custom_character = data.get("customCharacter")
        return VipPlayerProfile(
            tier=str(data.get("tier", "Gold")),
            bonus_multiplier=float(data.get("bonusMultiplier", 1.2)),
            music_track=str(data.get("musicTrack") or DEFAULT_VIP_MUSIC),
            skin_overrides=skin_overrides if isinstance(skin_overrides, Mapping) else None,
            custom_character=custom_character if isinstance(custom_character, Mapping) else None,
            **common_kwargs,
        )
    return PlayerProfile(**common_kwargs)


def profile_to_dict(profile: PlayerProfile) -> Dict[str, object]:
    """Serializa el perfil para almacenamiento en JSON."""
    payload = profile.to_payload()
    payload["type"] = "vip" if isinstance(profile, VipPlayerProfile) else "standard"
    return payload
