"""Power-up implementations that enhance players temporarily."""

from __future__ import annotations

import time
from abc import ABC, abstractmethod
from typing import Dict

from app.config import settings
from app.core.models import Player


class PowerUp(ABC):
    """Interface that all power-up implementations must follow."""

    name: str
    duration: float

    def __init__(self, duration: float) -> None:
        """Store the common duration for the power-up."""
        self.duration = duration

    @abstractmethod
    def apply(self, player: Player) -> None:
        """Apply the power-up effect to the player."""

    @abstractmethod
    def revert(self, player: Player) -> None:
        """Revert any modifications performed during apply."""


class _TimedPowerMixin:
    """Mixin that tracks activation timestamps to drive automatic reversion."""

    def register_activation(self, player: Player) -> None:
        """Record the activation in the player's structures."""
        expiry = time.time() + self.duration
        player.active_powerups[self.name] = {"expires_at": expiry}
        player.apply_powerup(self.name)

    def should_revert(self, player: Player) -> bool:
        """Return True when the power-up should be reverted."""
        info: Dict[str, float] = player.active_powerups.get(self.name, {})
        return bool(info) and info.get("expires_at", 0.0) <= time.time()


class BigHead(_TimedPowerMixin, PowerUp):
    """Temporarily increase the size of the player's head for wider hits."""

    name = "BigHead"

    def apply(self, player: Player) -> None:
        """Increase the player's head hitbox size."""
        player.energy = min(150.0, player.energy + 10.0)
        self.register_activation(player)

    def revert(self, player: Player) -> None:
        """Return the player to regular proportions when elapsed."""
        if self.should_revert(player):
            player.energy = max(0.0, player.energy - 10.0)
            player.active_powerups.pop(self.name, None)


class SpeedBoost(_TimedPowerMixin, PowerUp):
    """Provide a short burst of horizontal speed to the player."""

    name = "SpeedBoost"

    def apply(self, player: Player) -> None:
        """Boost the player velocity for a few seconds."""
        player.velocity[0] *= 1.5
        player.active_powerups[self.name] = {"expires_at": time.time() + self.duration, "boost": 1.5}
        player.apply_powerup(self.name)

    def revert(self, player: Player) -> None:
        """Restore the original velocity after the boost finishes."""
        info = player.active_powerups.get(self.name)
        if info and info.get("expires_at", 0.0) <= time.time():
            player.velocity[0] /= info.get("boost", 1.0)
            player.active_powerups.pop(self.name, None)


class SuperJump(_TimedPowerMixin, PowerUp):
    """Increase the player's jump height."""

    name = "SuperJump"

    def apply(self, player: Player) -> None:
        """Store the increased power level and adjust stats."""
        player.secret_power_level = "LVL-9"
        self.register_activation(player)

    def revert(self, player: Player) -> None:
        """Revert the secret power to a calm default level."""
        if self.should_revert(player):
            player.secret_power_level = "LVL-5"
            player.active_powerups.pop(self.name, None)


AVAILABLE_POWERUPS = {
    BigHead.__name__: BigHead(duration=settings.default_power_duration),
    SpeedBoost.__name__: SpeedBoost(duration=settings.default_power_duration),
    SuperJump.__name__: SuperJump(duration=settings.default_power_duration),
}
"""Pre-instantiated power-ups used by the game loop."""

