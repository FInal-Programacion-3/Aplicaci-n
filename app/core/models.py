"""Modelos básicos utilizados por la lógica del backend."""

from __future__ import annotations

from collections import deque
from queue import Empty, Queue
from typing import Deque, Dict, Optional

import numpy as np
from numpy.typing import NDArray

from app.config import settings
from app.core.abstractions import Character


def vector(x_value: float, y_value: float) -> NDArray[np.float64]:
    """Construye un vector 2D con precisión de coma flotante."""
    return np.array([x_value, y_value], dtype=np.float64)


class Arena:
    """Representa los límites de la arena jugable."""

    def __init__(self, width: int, height: int, goal_width: int) -> None:
        self.width = width
        self.height = height
        self.goal_width = goal_width

    def contains(self, position: NDArray[np.float64]) -> bool:
        """Devuelve True si la posición está dentro del rango horizontal."""
        return 0.0 <= float(position[0]) <= float(self.width)


class Ball:
    """Representación simple de la pelota con soporte de física."""

    def __init__(self, radius: float = 18.0, mass: float = 1.0) -> None:
        self.radius = radius
        self.mass = mass
        self.position: NDArray[np.float64] = vector(
            settings.arena_width / 2.0,
            settings.arena_height / 2.0,
        )
        self.velocity: NDArray[np.float64] = vector(0.0, 0.0)

    def reset(self) -> None:
        """Reinicia la pelota en el centro de la arena."""
        self.position = vector(settings.arena_width / 2.0, settings.arena_height / 2.0)
        self.velocity = vector(0.0, 0.0)


class NPC(Character):
    """Personaje no jugable controlado por el módulo de IA."""

    def __init__(
        self,
        name: str,
        taunt_queue: Queue[str],
        position: Optional[NDArray[np.float64]] = None,
    ) -> None:
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
        """Mueve al NPC con ruido adicional para simular control imperfecto."""
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
        """Registra el uso de poderes para fines analíticos."""
        self.power_history.appendleft(power_name)

    def taunt(self) -> str:
        """Devuelve la siguiente burla de la cola o una frase por defecto."""
        try:
            taunt = self.taunt_queue.get_nowait()
        except Empty:
            return "¡No escaparás de mi cabezazo!"
        self.taunt_queue.task_done()
        return taunt

