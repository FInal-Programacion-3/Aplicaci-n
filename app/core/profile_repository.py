"""Repositorio JSON para perfiles de jugador."""

from __future__ import annotations

import json
import threading
from pathlib import Path
from typing import Dict, List, Optional

from app.config import settings
from app.core.profiles import PlayerProfile, profile_from_dict, profile_to_dict


class ProfileRepository:
    """Gestiona la persistencia de perfiles usando un archivo JSON."""

    def __init__(self, storage_path: Path) -> None:
        self.storage_path = storage_path
        self._lock = threading.Lock()
        self._ensure_storage()

    def _ensure_storage(self) -> None:
        if not self.storage_path.exists():
            self.storage_path.write_text("[]", encoding="utf-8")

    def _read(self) -> List[Dict[str, object]]:
        raw = self.storage_path.read_text(encoding="utf-8") or "[]"
        return json.loads(raw)

    def _write(self, payload: List[Dict[str, object]]) -> None:
        self.storage_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    def list_profiles(self) -> List[PlayerProfile]:
        with self._lock:
            return [profile_from_dict(item) for item in self._read()]

    def get_profile(self, profile_id: int) -> Optional[PlayerProfile]:
        with self._lock:
            for item in self._read():
                if int(item["id"]) == profile_id:
                    return profile_from_dict(item)
        return None

    def _next_id(self, items: List[Dict[str, object]]) -> int:
        if not items:
            return 1
        return max(int(item["id"]) for item in items) + 1

    def create_profile(self, profile: PlayerProfile) -> PlayerProfile:
        with self._lock:
            current = self._read()
            profile.id = self._next_id(current)
            current.append(profile_to_dict(profile))
            self._write(current)
        return profile

    def update_profile(self, profile_id: int, updates: Dict[str, object]) -> Optional[PlayerProfile]:
        with self._lock:
            stored = self._read()
            for index, item in enumerate(stored):
                if int(item["id"]) != profile_id:
                    continue
                item.update(updates)
                stored[index] = item
                self._write(stored)
                return profile_from_dict(item)
        return None

    def delete_profile(self, profile_id: int) -> bool:
        with self._lock:
            stored = self._read()
            filtered = [item for item in stored if int(item["id"]) != profile_id]
            if len(filtered) == len(stored):
                return False
            self._write(filtered)
        return True


profile_repository = ProfileRepository(settings.profiles_file)
"""Instancia compartida por los endpoints REST."""
