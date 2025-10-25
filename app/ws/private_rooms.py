"""Gestor de salas privadas para partidas en modo multijugador."""

from __future__ import annotations

import asyncio
import json
import logging
import secrets
import string
from dataclasses import dataclass, field
from typing import Dict, Optional, Tuple

from fastapi import WebSocket, WebSocketDisconnect

LOGGER = logging.getLogger(__name__)

CODE_ALPHABET = string.ascii_uppercase + string.digits
CODE_LENGTH = 6


@dataclass
class PrivateRoom:
    """Estado en memoria de una sala privada."""

    code: str
    host: Optional[WebSocket] = None
    guest: Optional[WebSocket] = None
    closed: bool = False
    metadata: Dict[str, str] = field(default_factory=dict)


class PrivateRoomHub:
    """Administra la creacion y emparejamiento de salas privadas."""

    def __init__(self) -> None:
        self.rooms: Dict[str, PrivateRoom] = {}
        self.connections: Dict[WebSocket, Tuple[str, str]] = {}
        self._lock = asyncio.Lock()

    async def create_room(self, websocket: WebSocket) -> None:
        """Crea una sala nueva y escucha los mensajes del anfitrion."""
        await websocket.accept()
        code = await self._register_host(websocket)
        await websocket.send_json({"type": "room_created", "code": code})
        await websocket.send_json({"type": "waiting_opponent"})
        await self._listen(websocket)

    async def join_room(self, websocket: WebSocket, code: str) -> None:
        """Conecta a un invitado a una sala existente y retransmite mensajes."""
        await websocket.accept()
        async with self._lock:
            room = self.rooms.get(code.upper())
            if room is None or room.closed or room.host is None:
                await websocket.send_json({"type": "error", "message": "Codigo invalido o sala inexistente."})
                await websocket.close()
                return
            if room.guest is not None:
                await websocket.send_json({"type": "error", "message": "La sala ya esta completa."})
                await websocket.close()
                return
            room.guest = websocket
            self.connections[websocket] = (room.code, "guest")
        await websocket.send_json({"type": "room_joined", "code": room.code})
        await self._notify_match_start(room)
        await self._listen(websocket)

    async def _register_host(self, websocket: WebSocket) -> str:
        """Genera un codigo unico y almacena el websocket como anfitrion."""
        async with self._lock:
            code = self._generate_code()
            room = PrivateRoom(code=code, host=websocket)
            self.rooms[code] = room
            self.connections[websocket] = (code, "host")
            return code

    async def _listen(self, websocket: WebSocket) -> None:
        """Recibe mensajes JSON y los reenvia al oponente correspondiente."""
        try:
            while True:
                text = await websocket.receive_text()
                try:
                    payload = json.loads(text)
                except json.JSONDecodeError:
                    LOGGER.warning("Payload JSON invalido recibido de sala privada: %s", text)
                    continue
                await self._relay_payload(websocket, payload)
        except WebSocketDisconnect:
            await self._handle_disconnect(websocket)
        except Exception:  # pragma: no cover - logging de errores inesperados
            LOGGER.exception("Error en sala privada")
            await self._handle_disconnect(websocket)

    async def _relay_payload(self, sender: WebSocket, payload: Dict[str, str]) -> None:
        """Reenvia un mensaje JSON al oponente dentro de la misma sala."""
        code_role = self.connections.get(sender)
        if code_role is None:
            return
        room_code, role = code_role
        async with self._lock:
            room = self.rooms.get(room_code)
            if room is None:
                return
            target = room.host if role == "guest" else room.guest
        if target is None:
            return
        await target.send_json(payload)

    async def _notify_match_start(self, room: PrivateRoom) -> None:
        """Avisa a ambos jugadores que la partida puede comenzar."""
        payload = {"type": "match_start", "code": room.code}
        await self._send_safe(room.host, payload)
        await self._send_safe(room.guest, payload)

    async def _send_safe(self, websocket: Optional[WebSocket], payload: Dict[str, str]) -> None:
        """Envuelve send_json tolerando sockets desconectados."""
        if websocket is None:
            return
        try:
            await websocket.send_json(payload)
        except RuntimeError:
            # El websocket puede haberse cerrado entre que verificamos y enviamos.
            LOGGER.debug("Intento de envio sobre websocket cerrado.")

    async def _handle_disconnect(self, websocket: WebSocket) -> None:
        """Libera los recursos asociados a un websocket que se desconecto."""
        waiting_target: Optional[WebSocket] = None
        async with self._lock:
            code_role = self.connections.pop(websocket, None)
            if code_role is None:
                return
            room_code, role = code_role
            room = self.rooms.get(room_code)
            if room is None:
                return
            if role == "host":
                room.host = None
                room.closed = True
            else:
                room.guest = None
            opponent = room.guest if role == "host" else room.host
            if role == "guest" and room.host is not None and room.guest is None:
                waiting_target = room.host
            if opponent is None:
                room.closed = True
            if room.host is None and room.guest is None:
                self.rooms.pop(room_code, None)
        await self._send_safe(opponent, {"type": "opponent_left"})
        await self._send_safe(waiting_target, {"type": "waiting_opponent"})

    def _generate_code(self) -> str:
        """Construye un codigo alfanumerico unico para la sala."""
        while True:
            code = "".join(secrets.choice(CODE_ALPHABET) for _ in range(CODE_LENGTH))
            if code not in self.rooms:
                return code


private_room_hub = PrivateRoomHub()
"""Instancia unica que comparten los endpoints de salas privadas."""
