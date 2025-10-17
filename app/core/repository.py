"""Repositorio basado en JSON que realiza operaciones CRUD sobre jugadores."""

from __future__ import annotations

import json
import logging
import threading
from pathlib import Path
from typing import Dict, List, Optional

from app.core.models import (
    Player,
    PlayerCreate,
    PlayerInRepository,
    PlayerUpdate,
    PLAYER_NAME_PATTERN,
    SECRET_PATTERN,
)
from app.config import settings

LOGGER = logging.getLogger(__name__)


class PlayerRepository:
    """Repositorio que persiste perfiles de jugadores en un archivo JSON."""

    def __init__(self, storage_path: Path) -> None:
        """Inicializa el repositorio y crea el archivo si falta."""
        self.storage_path = storage_path
        self._lock = threading.Lock()
        self._ensure_storage()

    def _ensure_storage(self) -> None:
        """Crea el archivo de almacenamiento JSON si aun no existe."""
        if not self.storage_path.exists():
            self.storage_path.write_text("[]", encoding="utf-8")

    def _read(self) -> List[PlayerInRepository]:
        """Lee el archivo JSON y convierte el contenido en objetos de dominio."""
        raw = self.storage_path.read_text(encoding="utf-8") or "[]"
        data = json.loads(raw)
        return [PlayerInRepository(**item) for item in data]

    def _write(self, players: List[PlayerInRepository]) -> None:
        """Serializa la lista de jugadores y la guarda en el archivo JSON."""
        payload = [player.model_dump() for player in players]
        self.storage_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    def list_players(self) -> List[Player]:
        """Devuelve todos los jugadores registrados en el repositorio."""
        with self._lock:
            return [item.to_player() for item in self._read()]

    def get_player(self, player_id: int) -> Optional[Player]:
        """Devuelve el jugador que coincide con el identificador indicado."""
        with self._lock:
            for stored in self._read():
                if stored.id == player_id:
                    return stored.to_player()
        return None

    def _next_id(self, items: List[PlayerInRepository]) -> int:
        """Devuelve el siguiente identificador disponible."""
        if not items:
            return 1
        return max(player.id for player in items) + 1

    def _validate_payload(self, payload: Dict[str, str]) -> None:
        """Valida las cargas de entrada usando expresiones regulares."""
        name = payload.get("name")
        secret = payload.get("secret_power_level")
        if name is not None and not PLAYER_NAME_PATTERN.fullmatch(name):
            raise ValueError("Nombre inválido.")
        if secret is not None and not SECRET_PATTERN.fullmatch(secret):
            raise ValueError("Nivel secreto inválido.")

    def create_player(self, data: PlayerCreate) -> Player:
        """Persiste un nuevo jugador y devuelve el objeto de dominio resultante."""
        payload = data.model_dump(by_alias=True)
        payload["secret_power_level"] = payload.pop("secretPowerLevel")
        self._validate_payload(payload)
        with self._lock:
            current = self._read()
            player_id = self._next_id(current)
            player = Player(
                player_id=player_id,
                name=data.name,
                avatar=data.avatar,
            )
            player.secret_power_level = data.secret_power_level
            current.append(PlayerInRepository.from_player(player))
            self._write(current)
        LOGGER.info("Player %s (%s) created", player.name, player.id)
        return player

    def update_player(self, player_id: int, data: PlayerUpdate) -> Optional[Player]:
        """Actualiza el jugador con el identificador indicado usando la carga recibida."""
        payload = data.model_dump(exclude_unset=True, by_alias=True)
        if "secretPowerLevel" in payload:
            payload["secret_power_level"] = payload.pop("secretPowerLevel")
        self._validate_payload(payload)
        with self._lock:
            stored = self._read()
            for index, item in enumerate(stored):
                if item.id == player_id:
                    updated = item.dict()
                    updated.update(payload)
                    stored[index] = PlayerInRepository(**updated)
                    self._write(stored)
                    return stored[index].to_player()
        return None

    def delete_player(self, player_id: int) -> bool:
        """Elimina al jugador con el identificador especificado."""
        with self._lock:
            stored = self._read()
            filtered = [item for item in stored if item.id != player_id]
            if len(filtered) == len(stored):
                return False
            self._write(filtered)
        LOGGER.info("Player %s deleted", player_id)
        return True


player_repository = PlayerRepository(settings.players_file)
"""Instancia de repositorio predeterminada compartida por rutas y servicios."""
