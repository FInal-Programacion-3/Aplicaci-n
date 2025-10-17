"""Core abstractions shared by game entities."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Protocol

from numpy.typing import NDArray


class SupportsPhysics(Protocol):
    """Protocol describing objects that expose physical properties required by physics helpers."""

    position: NDArray[float]
    velocity: NDArray[float]
    mass: float


class Character(ABC):
    """Abstract base class that defines the interface for controllable entities."""

    name: str

    @abstractmethod
    def move(self, delta: NDArray[float]) -> None:
        """Move the character horizontally inside the arena."""

    @abstractmethod
    def jump(self) -> None:
        """Perform a vertical jump using the physics engine."""

    @abstractmethod
    def apply_powerup(self, power_name: str) -> None:
        """Register that a power-up has been applied to the character."""

