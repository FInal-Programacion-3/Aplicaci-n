"""Hub WebSocket que sincroniza el estado del juego entre los clientes conectados."""

from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import Any, Dict, Optional

from fastapi import WebSocket, WebSocketDisconnect

from app.services.matchmaking import matchmaking_service

LOGGER = logging.getLogger(__name__)


class GameHub:
    """Coordina salas y jugadores para el endpoint WebSocket."""

    def __init__(self) -> None:
        """Inicializa los registros en memoria."""
        self.pending_connections: Dict[str, WebSocket] = {}
        self.rooms: Dict[str, Dict[str, WebSocket]] = {}
        self.room_state: Dict[str, Dict[str, Any]] = {}
        self.waiters: Dict[str, asyncio.Future[str]] = {}

    async def connect(self, websocket: WebSocket, player_id: str) -> str:
        """Registra una conexión nueva y devuelve el identificador de sala asignado."""
        await websocket.accept()
        self.pending_connections[player_id] = websocket
        room_id = matchmaking_service.enqueue_player(player_id)
        if room_id is None:
            return await self._wait_for_match(player_id)
        return await self._activate_room(room_id)

    async def _wait_for_match(self, player_id: str) -> str:
        """Espera de manera asíncrona hasta que el jugador sea emparejado."""
        loop = asyncio.get_running_loop()
        future = loop.create_future()
        self.waiters[player_id] = future
        try:
            return await future
        finally:
            self.waiters.pop(player_id, None)

    async def _activate_room(self, room_id: str) -> str:
        """Completa la activación de la sala y notifica a los participantes."""
        players = matchmaking_service.rooms.get(room_id, {})
        room_connections: Dict[str, WebSocket] = {}
        for identifier in players.values():
            websocket = self.pending_connections.pop(identifier, None)
            if websocket is not None:
                room_connections[identifier] = websocket
            waiter = self.waiters.pop(identifier, None)
            if waiter and not waiter.done():
                waiter.set_result(room_id)
        self.rooms[room_id] = room_connections
        self.room_state[room_id] = self._default_room_state()
        await self._notify_room_ready(room_id)
        return room_id

    async def disconnect(self, websocket: WebSocket) -> None:
        """Quita un websocket de su sala y notifica al oponente."""
        room_id = self._room_for_websocket(websocket)
        if room_id is None:
            # El jugador todavía no había sido emparejado.
            identifier: Optional[str] = None
            for player_id, pending_ws in list(self.pending_connections.items()):
                if pending_ws is websocket:
                    identifier = player_id
                    break
            if identifier:
                self.pending_connections.pop(identifier, None)
                matchmaking_service.remove_player(identifier)
                waiter = self.waiters.pop(identifier, None)
                if waiter and not waiter.done():
                    waiter.cancel()
            return

        participants = self.rooms.get(room_id, {})
        for identifier, ws in list(participants.items()):
            if ws is websocket:
                participants.pop(identifier, None)
        if not participants:
            self.rooms.pop(room_id, None)
            self.room_state.pop(room_id, None)
            matchmaking_service.release_room(room_id)
        else:
            await self.broadcast(room_id, {"type": "opponent_disconnected"})

    async def receive_loop(self, websocket: WebSocket, room_id: str, player_id: str) -> None:
        """Escucha mensajes entrantes y los distribuye en la sala."""
        try:
            while True:
                payload = await websocket.receive_text()
                message = json.loads(payload)
                await self._handle_message(room_id, player_id, message)
        except WebSocketDisconnect:
            await self.disconnect(websocket)
        except Exception as exc:  # noqa: BLE001 - registra errores inesperados
            LOGGER.exception("Error handling WebSocket message: %s", exc)
            await self.disconnect(websocket)

    async def broadcast(self, room_id: str, payload: Dict[str, Any]) -> None:
        """Envía una carga JSON a todos los participantes de la sala."""
        for websocket in self.rooms.get(room_id, {}).values():
            await websocket.send_json(payload)

    def _default_room_state(self) -> Dict[str, Any]:
        """Devuelve el estado inicial de la sala."""
        return {
            "players": {},
            "ball": {"position": [0.0, 0.0], "velocity": [0.0, 0.0]},
            "score": {"left": 0, "right": 0},
            "timestamp": time.time(),
        }

    def _room_for_websocket(self, websocket: WebSocket) -> Optional[str]:
        """Devuelve el identificador de la sala que contiene al websocket."""
        for room_id, participants in self.rooms.items():
            if websocket in participants.values():
                return room_id
        return None

    async def _notify_room_ready(self, room_id: str) -> None:
        """Envía el evento inicial de disponibilidad a los participantes de la sala."""
        await self.broadcast(
            room_id,
            {
                "type": "ready",
                "room": room_id,
                "state": self.room_state[room_id],
            },
        )

    async def _handle_message(self, room_id: str, player_id: str, message: Dict[str, Any]) -> None:
        """Enruta los mensajes entrantes hacia el manejador correspondiente."""
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


game_hub = GameHub()
"""Instancia única del hub consumida por los routers de FastAPI."""
