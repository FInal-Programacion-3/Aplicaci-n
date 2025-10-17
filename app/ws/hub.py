"""WebSocket hub that synchronizes game state among connected clients."""

from __future__ import annotations

import json
import logging
import time
import uuid
from queue import Queue
from typing import Any, Dict, Optional

from fastapi import WebSocket, WebSocketDisconnect
from numpy.typing import NDArray

from app.core.ai import AIAgent
from app.core.models import Ball, NPC
from app.core.physics import integrate_motion
from app.services.matchmaking import matchmaking_service
from app.services.taunts import taunt_service

LOGGER = logging.getLogger(__name__)


class GameHub:
    """Coordinates rooms, players, and AI agents for the WebSocket endpoint."""

    def __init__(self) -> None:
        """Initialize in-memory registries."""
        self.pending_connections: Dict[str, WebSocket] = {}
        self.rooms: Dict[str, Dict[str, Optional[WebSocket]]] = {}
        self.room_state: Dict[str, Dict[str, Any]] = {}
        self.ai_agents: Dict[str, AIAgent] = {}
        self.ball_state: Dict[str, Ball] = {}

    async def connect(self, websocket: WebSocket, player_id: str) -> str:
        """Register a new player connection and return the assigned room identifier."""
        await websocket.accept()
        self.pending_connections[player_id] = websocket
        room_id = matchmaking_service.enqueue_player(player_id)
        if room_id is None:
            ai_id = f"npc-{uuid.uuid4().hex}"
            room_id = matchmaking_service.enqueue_player(ai_id)
        players = matchmaking_service.rooms.get(room_id, {})
        room_connections: Dict[str, Optional[WebSocket]] = {}
        for identifier in players.values():
            room_connections[identifier] = self.pending_connections.pop(identifier, None)
        self.rooms[room_id] = room_connections
        self.room_state[room_id] = self._default_room_state()
        self.ball_state[room_id] = Ball()
        await self._notify_room_ready(room_id)
        ai_identifier = next((pid for pid, ws in room_connections.items() if ws is None), None)
        if ai_identifier:
            self._spawn_ai(room_id, ai_identifier)
        return room_id

    async def disconnect(self, websocket: WebSocket) -> None:
        """Remove a websocket from its room and notify the opponent."""
        room_id = self._room_for_websocket(websocket)
        if room_id is None:
            return
        participants = self.rooms.get(room_id, {})
        for identifier, ws in list(participants.items()):
            if ws is websocket:
                participants.pop(identifier, None)
        if not participants:
            self.rooms.pop(room_id, None)
            self.room_state.pop(room_id, None)
            self.ai_agents.pop(room_id, None)
            self.ball_state.pop(room_id, None)
            matchmaking_service.release_room(room_id)
        else:
            await self.broadcast(room_id, {"type": "opponent_disconnected"})

    async def receive_loop(self, websocket: WebSocket, room_id: str, player_id: str) -> None:
        """Listen for incoming messages and dispatch them to the room."""
        try:
            while True:
                payload = await websocket.receive_text()
                message = json.loads(payload)
                await self._handle_message(room_id, player_id, message)
        except WebSocketDisconnect:
            await self.disconnect(websocket)
        except Exception as exc:  # noqa: BLE001 - log unexpected errors
            LOGGER.exception("Error handling WebSocket message: %s", exc)
            await self.disconnect(websocket)

    async def broadcast(self, room_id: str, payload: Dict[str, Any]) -> None:
        """Send a JSON payload to all participants in the room."""
        for websocket in self.rooms.get(room_id, {}).values():
            if websocket is None:
                continue
            await websocket.send_json(payload)

    async def pulse_ai(self, room_id: str, delta_time: float = 0.016) -> None:
        """Advance the AI logic for the specified room and broadcast updates."""
        agent = self.ai_agents.get(room_id)
        if agent is None:
            return
        ball = self.ball_state[room_id]
        movement = agent.decide_movement(ball, delta_time)
        agent.npc.move(movement)
        integrate_motion(ball, delta_time)
        taunt = agent.next_taunt()
        await self.broadcast(
            room_id,
            {
                "type": "ai_state",
                "npc": {
                    "position": agent.npc.position.tolist(),
                    "velocity": agent.npc.velocity.tolist(),
                },
                "ball": {
                    "position": ball.position.tolist(),
                    "velocity": ball.velocity.tolist(),
                },
            },
        )
        if taunt:
            await self.broadcast(
                room_id,
                {"type": "chat", "from": agent.npc.name, "message": taunt},
            )

    def _spawn_ai(self, room_id: str, npc_identifier: str) -> None:
        """Create an AI agent for the provided room."""
        taunts = taunt_service.load_local_taunts()
        queue: Queue[str] = Queue()
        for taunt in taunts:
            queue.put(taunt)
        npc = NPC(name=npc_identifier, taunt_queue=queue)
        self.ai_agents[room_id] = AIAgent(npc)

    def _default_room_state(self) -> Dict[str, Any]:
        """Return the initial room state."""
        return {
            "players": {},
            "ball": {"position": [0.0, 0.0], "velocity": [0.0, 0.0]},
            "score": {"left": 0, "right": 0},
            "timestamp": time.time(),
        }

    def _room_for_websocket(self, websocket: WebSocket) -> Optional[str]:
        """Return the identifier of the room that contains the websocket."""
        for room_id, participants in self.rooms.items():
            if websocket in participants.values():
                return room_id
        return None

    async def _notify_room_ready(self, room_id: str) -> None:
        """Send the initial ready event to room participants."""
        await self.broadcast(
            room_id,
            {
                "type": "ready",
                "room": room_id,
                "state": self.room_state[room_id],
            },
        )

    async def _handle_message(self, room_id: str, player_id: str, message: Dict[str, Any]) -> None:
        """Route incoming messages to the appropriate handler."""
        message_type = message.get("type")
        if message_type == "state_update":
            self.room_state[room_id] = message["state"]
            await self.broadcast(room_id, {"type": "state", "state": message["state"]})
        elif message_type == "chat":
            await self.broadcast(
                room_id,
                {
                    "type": "chat",
                    "from": player_id,
                    "message": message.get("message", ""),
                },
            )
        elif message_type == "request_taunt":
            agent = self.ai_agents.get(room_id)
            if agent:
                taunt = agent.next_taunt()
                if taunt:
                    await self.broadcast(room_id, {"type": "chat", "from": agent.npc.name, "message": taunt})
        await self.pulse_ai(room_id)


game_hub = GameHub()
"""Singleton hub instance consumed by FastAPI routers."""
