"""Artificial intelligence helpers for the NPC opponents."""

from __future__ import annotations

import random
import time
from typing import Optional

import numpy as np
from numpy.typing import NDArray

from app.config import settings
from app.core.models import Arena, Ball, NPC


class AIAgent:
    """Basic controller that decides how the NPC should react to the game state."""

    def __init__(self, npc: NPC) -> None:
        """Store the controlled NPC and reset timers."""
        self.npc = npc
        self._last_taunt = 0.0

    def decide_movement(self, ball: Ball, delta_time: float) -> NDArray[np.float64]:
        """Return a 2D movement vector that moves towards the ball."""
        direction = ball.position - self.npc.position
        direction[1] = 0.0  # only horizontal control
        if np.linalg.norm(direction) > 0.0:
            direction = direction / np.linalg.norm(direction)
        speed = 150.0
        horizontal = direction * speed * delta_time
        noise = np.random.normal(0.0, settings.ai_noise_strength, size=2)
        return horizontal + noise

    def maybe_jump(self, ball: Ball) -> bool:
        """Return True when the ball is close enough vertically to trigger a jump."""
        vertical_distance = abs(ball.position[1] - self.npc.position[1])
        return vertical_distance < 120.0 and random.random() > 0.6

    def next_taunt(self) -> Optional[str]:
        """Return a taunt when enough time elapsed since the previous one."""
        now = time.time()
        if now - self._last_taunt < settings.taunt_interval:
            return None
        self._last_taunt = now
        return self.npc.taunt()

