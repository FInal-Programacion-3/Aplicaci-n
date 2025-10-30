"""Servicios para cargar y exponer el catálogo de personajes."""

from __future__ import annotations

import json
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Optional

from app.config import settings


@dataclass(slots=True)
class CharacterRecord:
    """Representa un personaje disponible en la interfaz."""

    id: str
    name: str
    sprite: str
    portrait: str
    tagline: str
    power_icon: Optional[str]

    def to_payload(self) -> Dict[str, str]:
        """Devuelve el personaje listo para serializar en JSON."""
        payload: Dict[str, str] = {
            "id": self.id,
            "name": self.name,
            "sprite": self.sprite,
            "portrait": self.portrait,
            "tagline": self.tagline,
        }
        if self.power_icon:
            payload["powerIcon"] = self.power_icon
        return payload


class CharacterCatalog:
    """Carga el archivo JSON de personajes y mantiene una caché simple."""

    def __init__(self, data_file: Path) -> None:
        self.data_file = data_file
        self._lock = threading.Lock()
        self._cached_mtime: Optional[float] = None
        self._cached: List[CharacterRecord] = []

    def _reload_if_needed(self) -> None:
        """Actualiza la caché si el archivo original cambió."""
        mtime = self.data_file.stat().st_mtime if self.data_file.exists() else None
        with self._lock:
            if mtime is None or mtime == self._cached_mtime:
                return
            raw = self.data_file.read_text(encoding="utf-8")
            data = json.loads(raw)
            records = []
            for entry in data:
                records.append(
                    CharacterRecord(
                        id=entry["id"],
                        name=entry["name"],
                        sprite=entry["sprite"],
                        portrait=entry["portrait"],
                        tagline=entry.get("tagline", ""),
                        power_icon=entry.get("powerIcon"),
                    )
                )
            self._cached = records
            self._cached_mtime = mtime

    def list_characters(self) -> Iterable[CharacterRecord]:
        """Devuelve todos los personajes cargados."""
        self._reload_if_needed()
        return list(self._cached)

    def get(self, character_id: str) -> Optional[CharacterRecord]:
        """Busca un personaje por su identificador."""
        for record in self.list_characters():
            if record.id == character_id:
                return record
        return None


character_catalog = CharacterCatalog(settings.static_dir / "data" / "characters.json")
"""Catálogo compartido para el resto del backend."""
