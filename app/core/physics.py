"""Auxiliar mínimo de física usado por el hub de WebSocket."""

from __future__ import annotations

from app.core.abstractions import SupportsPhysics


def integrate_motion(entity: SupportsPhysics, delta_time: float) -> None:
    """Integra la posición con un paso sencillo de Euler."""
    entity.position += entity.velocity * delta_time
