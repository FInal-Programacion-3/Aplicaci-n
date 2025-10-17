"""Utilidades sencillas de emparejamiento implementadas con deque."""

from __future__ import annotations

import uuid
from collections import deque
from typing import Deque, Dict, Optional


class MatchmakingService:
    """Administra colas de emparejamiento para salas WebSocket."""

    def __init__(self) -> None:
        """Inicializa la cola que almacena los identificadores en espera."""
        self.waiting: Deque[str] = deque()
        self.rooms: Dict[str, Dict[str, str]] = {}

    def enqueue_player(self, player_id: str) -> Optional[str]:
        """Agrega un jugador a la cola y devuelve un identificador de sala cuando se arma la pareja."""
        self.waiting.append(player_id)
        if len(self.waiting) >= 2:
            player_a = self.waiting.popleft()
            player_b = self.waiting.popleft()
            room_id = uuid.uuid4().hex
            self.rooms[room_id] = {"a": player_a, "b": player_b}
            return room_id
        return None

    def release_room(self, room_id: str) -> None:
        """Elimina una sala cuando deja de estar activa."""
        self.rooms.pop(room_id, None)


matchmaking_service = MatchmakingService()
"""Servicio de emparejamiento compartido por el hub WebSocket."""
