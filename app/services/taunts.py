"""Ayudantes para cargar burlas de la IA desde fuentes locales o remotas."""

from __future__ import annotations

import json
import logging
import threading
from collections import deque
from pathlib import Path
from typing import Deque, List, Optional

import requests
from requests import Response

from app.config import settings

LOGGER = logging.getLogger(__name__)


class TauntService:
    """Provee burlas para el chat del juego y el comportamiento de la IA."""

    def __init__(self, taunt_file: Path) -> None:
        """Guarda la ruta del archivo de burlas."""
        self.taunt_file = taunt_file
        self._lock = threading.Lock()
        self._queue: Deque[str] = deque()

    def load_local_taunts(self) -> List[str]:
        """Carga burlas desde el archivo JSON local."""
        if not self.taunt_file.exists():
            default = [
                "¡Esa cabeza no sirve ni de adorno!",
                "¿Eso fue un salto o un bostezo?",
                "Cuando termines de caer, avísame.",
            ]
            self.taunt_file.write_text(json.dumps(default, indent=2), encoding="utf-8")
            return default
        content = self.taunt_file.read_text(encoding="utf-8") or "[]"
        data = json.loads(content)
        if not isinstance(data, list):
            raise ValueError("El archivo de burlas debe ser una lista de cadenas.")
        taunts = [str(item) for item in data]
        return taunts

    def fetch_remote_taunts(self, url: str, timeout: float = 3.0) -> Optional[List[str]]:
        """Intenta descargar burlas desde un endpoint remoto."""
        try:
            response: Response = requests.get(url, timeout=timeout)
            response.raise_for_status()
        except requests.RequestException as exc:
            LOGGER.warning("No fue posible descargar burlas remotas: %s", exc)
            return None
        try:
            data = response.json()
        except ValueError as exc:
            LOGGER.warning("Respuesta JSON inválida para burlas: %s", exc)
            return None
        if isinstance(data, list):
            return [str(item) for item in data]
        LOGGER.warning("Formato inesperado de burlas remotas")
        return None

    def _ensure_queue(self) -> None:
        if self._queue:
            return
        taunts = self.load_local_taunts()
        self._queue = deque(taunts)

    def get_next_taunt(self) -> str:
        """Devuelve la proxima burla en orden FIFO y la reencola al final."""
        with self._lock:
            self._ensure_queue()
            if not self._queue:
                return "Estoy calculando la jugada perfecta..."
            taunt = self._queue.popleft()
            # Mantiene la burla al final para ciclar el listado
            self._queue.append(taunt)
            return taunt


taunt_service = TauntService(settings.static_dir / "taunts.json")
"""Instancia compartida del servicio de burlas."""
