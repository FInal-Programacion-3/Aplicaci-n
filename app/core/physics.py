"""Auxiliares de fisica livianos basados en NumPy."""

from __future__ import annotations

from typing import Optional

import numpy as np
from numpy.typing import NDArray

from app.config import settings
from app.core.abstractions import SupportsPhysics
from app.core.models import Arena, Ball, Player


def apply_gravity(entity: SupportsPhysics, delta_time: float) -> None:
    """Aplica la gravedad sobre la componente vertical de la velocidad."""
    entity.velocity[1] += settings.gravity * delta_time


def integrate_motion(entity: SupportsPhysics, delta_time: float) -> None:
    """Integra la posicion con un paso sencillo de Euler."""
    entity.position += entity.velocity * delta_time


def collide_with_floor(entity: SupportsPhysics, arena: Arena) -> None:
    """Evita que las entidades caigan por debajo del piso de la arena."""
    if entity.position[1] >= arena.height:
        entity.position[1] = float(arena.height)
        entity.velocity[1] *= -0.45


def clamp_horizontal(entity: SupportsPhysics, arena: Arena) -> None:
    """Garantiza que la entidad permanezca en el rango horizontal."""
    entity.position[0] = float(np.clip(entity.position[0], 0.0, arena.width))


def resolve_player_ball_collision(player: Player, ball: Ball) -> None:
    """Expulsa la pelota lejos del jugador cuando se superponen."""
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
    """Devuelve el lado del gol si la pelota cruza los limites horizontales."""
    left_line = float(settings.goal_line_offset)
    right_line = float(arena.width - settings.goal_line_offset)
    if ball.position[0] + ball.radius <= left_line:
        return "left"
    if ball.position[0] - ball.radius >= right_line:
        return "right"
    return None
