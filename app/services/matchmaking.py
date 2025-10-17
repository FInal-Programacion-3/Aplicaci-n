"""Simple matchmaking utilities implemented with deque."""

from __future__ import annotations

import uuid
from collections import deque
from typing import Deque, Dict, Optional


class MatchmakingService:
    """Manages matchmaking queues for WebSocket rooms."""

    def __init__(self) -> None:
        """Initialize the queue that stores waiting player identifiers."""
        self.waiting: Deque[str] = deque()
        self.rooms: Dict[str, Dict[str, str]] = {}

    def enqueue_player(self, player_id: str) -> Optional[str]:
        """Add a player to the queue and return a room identifier when matched."""
        self.waiting.append(player_id)
        if len(self.waiting) >= 2:
            player_a = self.waiting.popleft()
            player_b = self.waiting.popleft()
            room_id = uuid.uuid4().hex
            self.rooms[room_id] = {"a": player_a, "b": player_b}
            return room_id
        return None

    def release_room(self, room_id: str) -> None:
        """Remove a room when it is no longer active."""
        self.rooms.pop(room_id, None)


matchmaking_service = MatchmakingService()
"""Shared matchmaking service used by the WebSocket hub."""

