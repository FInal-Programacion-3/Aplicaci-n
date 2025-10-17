"""Abstracciones centrales compartidas por las entidades del juego."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Protocol

from numpy.typing import NDArray


class SupportsPhysics(Protocol):
    """Protocolo que describe objetos con propiedades fisicas requeridas por los ayudantes de fisica."""

    position: NDArray[float]
    velocity: NDArray[float]
    mass: float


class Character(ABC):
    """Clase base abstracta que define la interfaz para entidades controlables."""

    name: str

    @abstractmethod
    def move(self, delta: NDArray[float]) -> None:
        """Mueve al personaje en sentido horizontal dentro de la arena."""

    @abstractmethod
    def jump(self) -> None:
        """Realiza un salto vertical usando el motor de fisica."""

    @abstractmethod
    def apply_powerup(self, power_name: str) -> None:
        """Registra que se aplico un poder especial al personaje."""
