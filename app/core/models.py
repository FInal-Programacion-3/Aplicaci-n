"""Modelos de dominio para el juego de cabezazos."""

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
    """Construye un vector 2D con precision de coma flotante."""
    return np.array([x_value, y_value], dtype=np.float64)


class Arena:
    """Representa los limites de la arena jugable."""

    def __init__(self, width: int, height: int, goal_width: int) -> None:
        """Inicializa las dimensiones de la arena."""
        self.width = width
        self.height = height
        self.goal_width = goal_width

    def contains(self, position: NDArray[np.float64]) -> bool:
        """Devuelve True si la posicion entregada esta dentro de los limites horizontales."""
        return 0.0 <= float(position[0]) <= float(self.width)


class Ball:
    """Representacion simple de la pelota con soporte de fisica."""

    def __init__(self, radius: float = 18.0, mass: float = 1.0) -> None:
        """Inicializa la pelota en reposo en el centro de la arena."""
        self.radius = radius
        self.mass = mass
        self.position: NDArray[np.float64] = vector(
            settings.arena_width / 2.0, settings.arena_height / 2.0
        )
        self.velocity: NDArray[np.float64] = vector(0.0, 0.0)

    def reset(self) -> None:
        """Reinicia la pelota en el centro de la arena."""
        self.position = vector(settings.arena_width / 2.0, settings.arena_height / 2.0)
        self.velocity = vector(0.0, 0.0)


class Player(Character):
    """Jugador controlado por una persona."""

    def __init__(
        self,
        player_id: int,
        name: str,
        position: Optional[NDArray[np.float64]] = None,
        velocity: Optional[NDArray[np.float64]] = None,
        avatar: str = "player1",
    ) -> None:
        """Crea un jugador y valida sus atributos esenciales."""
        self.id = player_id
        self.name = self._validate_name(name)
        if position is not None:
            self.position = np.array(position, dtype=np.float64, copy=True)
        else:
            self.position = vector(
                settings.arena_width * 0.25,
                float(settings.arena_height - 64),
            )
        if velocity is not None:
            self.velocity = np.array(velocity, dtype=np.float64, copy=True)
        else:
            self.velocity = vector(0.0, 0.0)
        self.avatar = avatar
        self.score = 0
        self.energy = 100.0
        self.active_powerups: Dict[str, Dict[str, float]] = {}
        self.power_history: Deque[str] = deque(maxlen=settings.max_power_history)
        self.__secret_power_level = "LVL-1"

    @staticmethod
    def _validate_name(candidate: str) -> str:
        """Valida que el nombre respete el patron requerido."""
        if not PLAYER_NAME_PATTERN.match(candidate):
            raise ValueError("El nombre del jugador debe tener 3-24 caracteres alfanuméricos.")
        return candidate

    @property
    def secret_power_level(self) -> str:
        """Devuelve el nivel secreto codificado."""
        return self.__secret_power_level

    @secret_power_level.setter
    def secret_power_level(self, value: str) -> None:
        """Valida y asigna el nivel secreto."""
        if not SECRET_PATTERN.fullmatch(value):
            raise ValueError("El nivel secreto debe respetar el patrón LVL-#.")
        self.__secret_power_level = value

    def move(self, delta: NDArray[np.float64]) -> None:
        """Mueve al jugador horizontalmente sin salir de la arena."""
        tentative = self.position + delta
        if tentative[0] < 0.0:
            tentative[0] = 0.0
            self.velocity[0] = 0.0
        if tentative[0] > settings.arena_width:
            tentative[0] = float(settings.arena_width)
            self.velocity[0] = 0.0
        self.position = tentative

    def jump(self) -> None:
        """Aplica un impulso vertical para ejecutar un salto."""
        self.velocity[1] = -np.sqrt(2.0 * settings.gravity * 120.0)

    def apply_powerup(self, power_name: str) -> None:
        """Guarda la activacion del poder en el historial."""
        self.power_history.appendleft(power_name)
        LOGGER.debug("Player %s activated power %s", self.name, power_name)

    def as_payload(self) -> Dict[str, object]:
        """Devuelve una representacion serializable del jugador."""
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
    """Personaje no jugable controlado por el modulo de IA."""

    def __init__(
        self,
        name: str,
        taunt_queue: Queue[str],
        position: Optional[NDArray[np.float64]] = None,
    ) -> None:
        """Inicializa el NPC con una cola de burlas y posicion por defecto."""
        self.name = name
        self.taunt_queue = taunt_queue
        if position is not None:
            self.position = np.array(position, dtype=np.float64, copy=True)
        else:
            self.position = vector(
                settings.arena_width * 0.75,
                float(settings.arena_height - 64),
            )
        self.velocity: NDArray[np.float64] = vector(0.0, 0.0)
        self.score = 0
        self.energy = 100.0
        self.power_history: Deque[str] = deque(maxlen=settings.max_power_history)

    def move(self, delta: NDArray[np.float64]) -> None:
        """Mueve al NPC con ruido adicional para simular un control imperfecto."""
        noisy = delta + np.random.normal(loc=0.0, scale=settings.ai_noise_strength, size=2)
        self.position = np.clip(
            self.position + noisy,
            a_min=[0.0, 0.0],
            a_max=[float(settings.arena_width), float(settings.arena_height)],
        )

    def jump(self) -> None:
        """Hace que el NPC salte con un impulso levemente menor."""
        self.velocity[1] = -np.sqrt(2.0 * settings.gravity * 100.0)

    def apply_powerup(self, power_name: str) -> None:
        """Registra el uso de poderes para fines analiticos."""
        self.power_history.appendleft(power_name)

    def taunt(self) -> str:
        """Devuelve la siguiente burla de la cola o una frase por defecto."""
        try:
            taunt = self.taunt_queue.get_nowait()
        except Empty:
            return "¡No escaparás de mi cabezazo!"
        self.taunt_queue.task_done()
        return taunt


class PlayerPayload(BaseModel):
    """Esquema usado para enviar datos de jugadores via la API."""

    id: int
    name: str
    avatar: str
    score: int
    energy: float
    secret_power_level: str = Field(alias="secretPowerLevel")

    model_config = ConfigDict(populate_by_name=True)


class PlayerCreate(BaseModel):
    """Esquema que valida la carga para crear un nuevo jugador."""

    name: str
    avatar: str = "player1"
    secret_power_level: str = Field(alias="secretPowerLevel", default="LVL-1")

    model_config = ConfigDict(populate_by_name=True)

    @field_validator("name")
    def validate_name(cls, value: str) -> str:
        """Verifica que el nombre indicado respete la expresion regular."""
        if not PLAYER_NAME_PATTERN.fullmatch(value):
            raise ValueError(
                "El nombre debe ser alfanumérico, permitir guiones y tener entre 3 y 24 caracteres."
            )
        return value

    @field_validator("secret_power_level")
    def validate_secret(cls, value: str) -> str:
        """Confirma que el nivel secreto siga el patron esperado LVL-#."""
        if not SECRET_PATTERN.fullmatch(value):
            raise ValueError("El nivel secreto debe respetar el patrón LVL-#.")
        return value


class PlayerUpdate(BaseModel):
    """Esquema que valida las actualizaciones sobre un jugador existente."""

    name: Optional[str] = None
    avatar: Optional[str] = None
    score: Optional[int] = None
    energy: Optional[float] = None
    secret_power_level: Optional[str] = Field(alias="secretPowerLevel", default=None)

    model_config = ConfigDict(populate_by_name=True)

    @field_validator("name")
    def validate_name(cls, value: Optional[str]) -> Optional[str]:
        """Valida cambios opcionales sobre el nombre."""
        if value is not None and not PLAYER_NAME_PATTERN.fullmatch(value):
            raise ValueError("Nombre inválido.")
        return value

    @field_validator("secret_power_level")
    def validate_secret(cls, value: Optional[str]) -> Optional[str]:
        """Valida modificaciones opcionales del nivel secreto."""
        if value is not None and not SECRET_PATTERN.fullmatch(value):
            raise ValueError("Nivel secreto inválido.")
        return value


class PlayerInRepository(BaseModel):
    """Esquema utilizado para persistencia en JSON."""

    id: int
    name: str
    avatar: str
    position: Tuple[float, float]
    velocity: Tuple[float, float]
    score: int
    energy: float
    secret_power_level: str

    def to_player(self) -> Player:
        """Convierte el esquema almacenado en un objeto de dominio Player."""
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
        """Construye el esquema del repositorio a partir de un Player de dominio."""
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
