"""Ayudantes de inteligencia artificial para los oponentes controlados por la IA."""

from __future__ import annotations

import random
import time
from typing import Optional

import numpy as np
from numpy.typing import NDArray

from app.config import settings
from app.core.models import Arena, Ball, NPC


class AIAgent:
    """Controlador basico que decide como reacciona el NPC al estado del juego."""

    def __init__(self, npc: NPC) -> None:
        """Guarda el NPC controlado y reinicia los temporizadores."""
        self.npc = npc
        self._last_taunt = 0.0

    def decide_movement(self, ball: Ball, delta_time: float) -> NDArray[np.float64]:
        """Devuelve un vector de movimiento 2D que se acerca a la pelota."""
        direction = ball.position - self.npc.position
        direction[1] = 0.0  # control horizontal unicamente
        if np.linalg.norm(direction) > 0.0:
            direction = direction / np.linalg.norm(direction)
        speed = 150.0
        horizontal = direction * speed * delta_time
        noise = np.random.normal(0.0, settings.ai_noise_strength, size=2)
        return horizontal + noise

    def maybe_jump(self, ball: Ball) -> bool:
        """Devuelve True cuando la pelota esta lo bastante cerca para activar un salto."""
        vertical_distance = abs(ball.position[1] - self.npc.position[1])
        return vertical_distance < 120.0 and random.random() > 0.6

    def next_taunt(self) -> Optional[str]:
        """Devuelve una burla cuando paso suficiente tiempo desde la anterior."""
        now = time.time()
        if now - self._last_taunt < settings.taunt_interval:
            return None
        self._last_taunt = now
        return self.npc.taunt()
