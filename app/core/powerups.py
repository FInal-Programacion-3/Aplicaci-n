"""Implementaciones de poderes temporales que potencian a los jugadores."""

from __future__ import annotations

import time
from abc import ABC, abstractmethod
from typing import Dict

from app.config import settings
from app.core.models import Player


class PowerUp(ABC):
    """Interfaz que deben seguir todas las implementaciones de poderes."""

    name: str
    duration: float

    def __init__(self, duration: float) -> None:
        """Guarda la duracion comun del poder."""
        self.duration = duration

    @abstractmethod
    def apply(self, player: Player) -> None:
        """Aplica el efecto del poder sobre el jugador."""

    @abstractmethod
    def revert(self, player: Player) -> None:
        """Revierte las modificaciones realizadas durante apply."""


class _TimedPowerMixin:
    """Mixin que almacena tiempos de activacion para habilitar la reversion automatica."""

    def register_activation(self, player: Player) -> None:
        """Registra la activacion en las estructuras del jugador."""
        expiry = time.time() + self.duration
        player.active_powerups[self.name] = {"expires_at": expiry}
        player.apply_powerup(self.name)

    def should_revert(self, player: Player) -> bool:
        """Devuelve True cuando corresponde revertir el poder."""
        info: Dict[str, float] = player.active_powerups.get(self.name, {})
        return bool(info) and info.get("expires_at", 0.0) <= time.time()


class BigHead(_TimedPowerMixin, PowerUp):
    """Incrementa temporalmente el tamanio de la cabeza para golpear con mayor ancho."""

    name = "BigHead"

    def apply(self, player: Player) -> None:
        """Aumenta el tamano de impacto de la cabeza del jugador."""
        player.energy = min(150.0, player.energy + 10.0)
        self.register_activation(player)

    def revert(self, player: Player) -> None:
        """Devuelve al jugador a proporciones normales al terminar el efecto."""
        if self.should_revert(player):
            player.energy = max(0.0, player.energy - 10.0)
            player.active_powerups.pop(self.name, None)


class SpeedBoost(_TimedPowerMixin, PowerUp):
    """Otorga un breve incremento de velocidad horizontal al jugador."""

    name = "SpeedBoost"

    def apply(self, player: Player) -> None:
        """Potencia la velocidad del jugador durante unos segundos."""
        player.velocity[0] *= 1.5
        player.active_powerups[self.name] = {"expires_at": time.time() + self.duration, "boost": 1.5}
        player.apply_powerup(self.name)

    def revert(self, player: Player) -> None:
        """Restaura la velocidad original una vez que finaliza el impulso."""
        info = player.active_powerups.get(self.name)
        if info and info.get("expires_at", 0.0) <= time.time():
            player.velocity[0] /= info.get("boost", 1.0)
            player.active_powerups.pop(self.name, None)


class SuperJump(_TimedPowerMixin, PowerUp):
    """Incrementa la altura del salto del jugador."""

    name = "SuperJump"

    def apply(self, player: Player) -> None:
        """Guarda el nivel de poder aumentado y ajusta estadisticas."""
        player.secret_power_level = "LVL-9"
        self.register_activation(player)

    def revert(self, player: Player) -> None:
        """Vuelve a un nivel secreto mas moderado cuando corresponde."""
        if self.should_revert(player):
            player.secret_power_level = "LVL-5"
            player.active_powerups.pop(self.name, None)


AVAILABLE_POWERUPS = {
    BigHead.__name__: BigHead(duration=settings.default_power_duration),
    SpeedBoost.__name__: SpeedBoost(duration=settings.default_power_duration),
    SuperJump.__name__: SuperJump(duration=settings.default_power_duration),
}
"""Poderes preinstanciados utilizados por el bucle del juego."""
