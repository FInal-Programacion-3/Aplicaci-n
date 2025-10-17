"""Domain models for the head soccer game."""

from __future__ import annotations

import logging
import re
from collections import deque
from queue import Empty, Queue
from typing import Deque, Dict, Optional, Tuple

import numpy as np
from numpy.typing import NDArray
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.config import settings
from app.core.abstractions import Character

LOGGER = logging.getLogger(__name__)
PLAYER_NAME_PATTERN = re.compile(r"^[A-Za-z0-9_\\-]{3,24}$")
SECRET_PATTERN = re.compile(r"^LVL-[0-9]{1,2}$")


def vector(x_value: float, y_value: float) -> NDArray[np.float64]:
    """Build a 2D vector with float precision."""
    return np.array([x_value, y_value], dtype=np.float64)


class Arena:
    """Represents the playable arena boundaries."""

    def __init__(self, width: int, height: int, goal_width: int) -> None:
        """Initialize arena size."""
        self.width = width
        self.height = height
        self.goal_width = goal_width

    def contains(self, position: NDArray[np.float64]) -> bool:
        """Return True when the provided position is within horizontal limits."""
        return 0.0 <= float(position[0]) <= float(self.width)


class Ball:
    """Simple physics-enabled representation of the match ball."""

    def __init__(self, radius: float = 18.0, mass: float = 1.0) -> None:
        """Initialize the ball at rest in the center of the arena."""
        self.radius = radius
        self.mass = mass
        self.position: NDArray[np.float64] = vector(
            settings.arena_width / 2.0, settings.arena_height / 2.0
        )
        self.velocity: NDArray[np.float64] = vector(0.0, 0.0)

    def reset(self) -> None:
        """Reset the ball to the center of the arena."""
        self.position = vector(settings.arena_width / 2.0, settings.arena_height / 2.0)
        self.velocity = vector(0.0, 0.0)


class Player(Character):
    """Player controlled by a human user."""

    def __init__(
        self,
        player_id: int,
        name: str,
        position: Optional[NDArray[np.float64]] = None,
        velocity: Optional[NDArray[np.float64]] = None,
        avatar: str = "player1",
    ) -> None:
        """Create a Player and validate its core attributes."""
        self.id = player_id
        self.name = self._validate_name(name)
        self.position: NDArray[np.float64] = position or vector(
            settings.arena_width * 0.25,
            float(settings.arena_height - 64),
        )
        self.velocity: NDArray[np.float64] = velocity or vector(0.0, 0.0)
        self.avatar = avatar
        self.score = 0
        self.energy = 100.0
        self.active_powerups: Dict[str, Dict[str, float]] = {}
        self.power_history: Deque[str] = deque(maxlen=settings.max_power_history)
        self.__secret_power_level = "LVL-1"

    @staticmethod
    def _validate_name(candidate: str) -> str:
        """Validate that the name matches the required pattern."""
        if not PLAYER_NAME_PATTERN.match(candidate):
            raise ValueError("El nombre del jugador debe tener 3-24 caracteres alfanuméricos.")
        return candidate

    @property
    def secret_power_level(self) -> str:
        """Return the encoded secret power level."""
        return self.__secret_power_level

    @secret_power_level.setter
    def secret_power_level(self, value: str) -> None:
        """Validate and set the secret power level."""
        if not SECRET_PATTERN.fullmatch(value):
            raise ValueError("El nivel secreto debe respetar el patrón LVL-#.")
        self.__secret_power_level = value

    def move(self, delta: NDArray[np.float64]) -> None:
        """Move the player horizontally while remaining inside the arena."""
        tentative = self.position + delta
        if tentative[0] < 0.0:
            tentative[0] = 0.0
            self.velocity[0] = 0.0
        if tentative[0] > settings.arena_width:
            tentative[0] = float(settings.arena_width)
            self.velocity[0] = 0.0
        self.position = tentative

    def jump(self) -> None:
        """Apply an upward impulse to trigger a jump."""
        self.velocity[1] = -np.sqrt(2.0 * settings.gravity * 120.0)

    def apply_powerup(self, power_name: str) -> None:
        """Store the power-up activation in the history queue."""
        self.power_history.appendleft(power_name)
        LOGGER.debug("Player %s activated power %s", self.name, power_name)

    def as_payload(self) -> Dict[str, object]:
        """Return a serializable representation of the player instance."""
        return {
            "id": self.id,
            "name": self.name,
            "avatar": self.avatar,
            "position": self.position.tolist(),
            "velocity": self.velocity.tolist(),
            "score": self.score,
            "energy": self.energy,
            "secret_power_level": self.secret_power_level,
        }


class NPC(Character):
    """Non-playable character controlled by the AI module."""

    def __init__(
        self,
        name: str,
        taunt_queue: Queue[str],
        position: Optional[NDArray[np.float64]] = None,
    ) -> None:
        """Initialize the NPC with a taunt queue and default position."""
        self.name = name
        self.taunt_queue = taunt_queue
        self.position: NDArray[np.float64] = position or vector(
            settings.arena_width * 0.75,
            float(settings.arena_height - 64),
        )
        self.velocity: NDArray[np.float64] = vector(0.0, 0.0)
        self.score = 0
        self.energy = 100.0
        self.power_history: Deque[str] = deque(maxlen=settings.max_power_history)

    def move(self, delta: NDArray[np.float64]) -> None:
        """Move the NPC with additional noise to simulate imperfect AI control."""
        noisy = delta + np.random.normal(loc=0.0, scale=settings.ai_noise_strength, size=2)
        self.position = np.clip(
            self.position + noisy,
            a_min=[0.0, 0.0],
            a_max=[float(settings.arena_width), float(settings.arena_height)],
        )

    def jump(self) -> None:
        """Make the NPC jump with a slightly weaker impulse."""
        self.velocity[1] = -np.sqrt(2.0 * settings.gravity * 100.0)

    def apply_powerup(self, power_name: str) -> None:
        """Track the power usage for analytics."""
        self.power_history.appendleft(power_name)

    def taunt(self) -> str:
        """Return the next taunt message from the queue or a default phrase."""
        try:
            taunt = self.taunt_queue.get_nowait()
        except Empty:
            return "¡No escaparás de mi cabezazo!"
        self.taunt_queue.task_done()
        return taunt


class PlayerPayload(BaseModel):
    """Schema used to send player details via the API."""

    id: int
    name: str
    avatar: str
    score: int
    energy: float
    secret_power_level: str = Field(alias="secretPowerLevel")

    model_config = ConfigDict(populate_by_name=True)


class PlayerCreate(BaseModel):
    """Schema that validates the incoming payload to create a new player."""

    name: str
    avatar: str = "player1"
    secret_power_level: str = Field(alias="secretPowerLevel", default="LVL-1")

    model_config = ConfigDict(populate_by_name=True)

    @field_validator("name")
    def validate_name(cls, value: str) -> str:
        """Ensure the provided name matches the regular expression."""
        if not PLAYER_NAME_PATTERN.fullmatch(value):
            raise ValueError(
                "El nombre debe ser alfanumérico, permitir guiones y tener entre 3 y 24 caracteres."
            )
        return value

    @field_validator("secret_power_level")
    def validate_secret(cls, value: str) -> str:
        """Ensure the secret level follows the expected LVL-# pattern."""
        if not SECRET_PATTERN.fullmatch(value):
            raise ValueError("El nivel secreto debe respetar el patrón LVL-#.")
        return value


class PlayerUpdate(BaseModel):
    """Schema that validates updates to an existing player."""

    name: Optional[str] = None
    avatar: Optional[str] = None
    score: Optional[int] = None
    energy: Optional[float] = None
    secret_power_level: Optional[str] = Field(alias="secretPowerLevel", default=None)

    model_config = ConfigDict(populate_by_name=True)

    @field_validator("name")
    def validate_name(cls, value: Optional[str]) -> Optional[str]:
        """Validate optional name changes."""
        if value is not None and not PLAYER_NAME_PATTERN.fullmatch(value):
            raise ValueError("Nombre inválido.")
        return value

    @field_validator("secret_power_level")
    def validate_secret(cls, value: Optional[str]) -> Optional[str]:
        """Validate optional secret level updates."""
        if value is not None and not SECRET_PATTERN.fullmatch(value):
            raise ValueError("Nivel secreto inválido.")
        return value


class PlayerInRepository(BaseModel):
    """Schema used for JSON persistence."""

    id: int
    name: str
    avatar: str
    position: Tuple[float, float]
    velocity: Tuple[float, float]
    score: int
    energy: float
    secret_power_level: str

    def to_player(self) -> Player:
        """Convert the stored schema to a Player domain object."""
        player = Player(
            player_id=self.id,
            name=self.name,
            position=vector(*self.position),
            velocity=vector(*self.velocity),
            avatar=self.avatar,
        )
        player.score = self.score
        player.energy = self.energy
        player.secret_power_level = self.secret_power_level
        return player

    @classmethod
    def from_player(cls, player: Player) -> "PlayerInRepository":
        """Build the repository schema from a Player domain object."""
        return cls(
            id=player.id,
            name=player.name,
            avatar=player.avatar,
            position=(float(player.position[0]), float(player.position[1])),
            velocity=(float(player.velocity[0]), float(player.velocity[1])),
            score=player.score,
            energy=player.energy,
            secret_power_level=player.secret_power_level,
        )
