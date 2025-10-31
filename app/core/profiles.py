"""Perfiles de jugador persistidos del lado del servidor."""

from __future__ import annotations

import re
from abc import ABC, abstractmethod
from collections import deque
from dataclasses import InitVar, dataclass, field
from datetime import datetime
from typing import Deque, Dict, Iterable, Optional


NICKNAME_PATTERN = re.compile(r"^[A-Za-z0-9_]{3,24}$")
SECRET_CODE_PATTERN = re.compile(r"^SC-[A-Z0-9]{4}$")


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

    def record_match(self, character_id: str, won: bool) -> None:
        """Actualiza estadísticas básicas e historial de personajes."""
        if won:
            self.wins += 1
        else:
            self.losses += 1
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

    def apply_badge(self) -> str:
        return f"VIP {self.tier}"

    def to_payload(self) -> Dict[str, object]:
        payload = super().to_payload()
        payload.update(
            {
                "isVip": True,
                "tier": self.tier,
                "bonusMultiplier": self.bonus_multiplier,
            }
        )
        return payload


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
        return VipPlayerProfile(
            tier=str(data.get("tier", "Gold")),
            bonus_multiplier=float(data.get("bonusMultiplier", 1.2)),
            **common_kwargs,
        )
    return PlayerProfile(**common_kwargs)


def profile_to_dict(profile: PlayerProfile) -> Dict[str, object]:
    """Serializa el perfil para almacenamiento en JSON."""
    payload = profile.to_payload()
    payload["type"] = "vip" if isinstance(profile, VipPlayerProfile) else "standard"
    return payload
