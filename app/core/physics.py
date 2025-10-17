"""Lightweight physics helpers that rely on NumPy."""

from __future__ import annotations

from typing import Optional

import numpy as np
from numpy.typing import NDArray

from app.config import settings
from app.core.abstractions import SupportsPhysics
from app.core.models import Arena, Ball, Player


def apply_gravity(entity: SupportsPhysics, delta_time: float) -> None:
    """Apply gravity to the vertical component of the entity velocity."""
    entity.velocity[1] += settings.gravity * delta_time


def integrate_motion(entity: SupportsPhysics, delta_time: float) -> None:
    """Integrate position using a simple Euler step."""
    entity.position += entity.velocity * delta_time


def collide_with_floor(entity: SupportsPhysics, arena: Arena) -> None:
    """Prevent entities from falling below the arena floor."""
    if entity.position[1] >= arena.height:
        entity.position[1] = float(arena.height)
        entity.velocity[1] *= -0.45


def clamp_horizontal(entity: SupportsPhysics, arena: Arena) -> None:
    """Ensure an entity remains inside the horizontal range."""
    entity.position[0] = float(np.clip(entity.position[0], 0.0, arena.width))


def resolve_player_ball_collision(player: Player, ball: Ball) -> None:
    """Bounce the ball away from the player when they overlap."""
    distance_vector: NDArray[np.float64] = ball.position - player.position
    distance = np.linalg.norm(distance_vector)
    if distance == 0.0:
        distance = 1.0
    player_radius = 32.0
    overlap = (player_radius + ball.radius) - distance
    if overlap > 0.0:
        normalized = distance_vector / distance
        ball.position += normalized * overlap
        ball.velocity = normalized * np.linalg.norm(player.velocity) * 1.2


def detect_goal(ball: Ball, arena: Arena) -> Optional[str]:
    """Return the goal side if the ball crosses the horizontal limits."""
    if ball.position[0] <= 0.0:
        return "left"
    if ball.position[0] >= arena.width:
        return "right"
    return None
