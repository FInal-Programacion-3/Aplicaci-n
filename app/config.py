"""Constantes y utilidades de configuracion de la aplicacion."""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict


@dataclass(slots=True)
class Settings:
    """Contenedor de valores de configuracion global usados en toda la aplicacion."""

    base_dir: Path = field(default_factory=lambda: Path(__file__).resolve().parent.parent)
    static_dir: Path = field(init=False)
    websocket_rooms: int = 4
    gravity: float = 9.81
    arena_width: int = 960
    arena_height: int = 540
    goal_width: int = 120
    goal_line_offset: int = 80
    default_power_duration: float = 5.0
    max_power_history: int = 20
    taunt_interval: float = 8.0
    ai_noise_strength: float = 1.5
    logging_config: Dict[str, str] = field(
        default_factory=lambda: {"version": "1", "disable_existing_loggers": "False"}
    )
    access_password: str = "cabezones2025"
    access_cookie_name: str = "app_access_token"
    access_cookie_max_age: int = 60 * 60 * 12  # 12 horas
    access_cookie_value: str = field(init=False)

    def __post_init__(self) -> None:
        """Inicializa las rutas dinamicas cuando la carpeta base esta disponible."""
        self.static_dir = self.base_dir / "app" / "ui" / "static"
        self.access_cookie_value = (
            hashlib.sha256(self.access_password.encode("utf-8")).hexdigest()  
            if self.access_password
            else ""
        )
        self.ensure_directories()

    def ensure_directories(self) -> None:
        """Crea directorios necesarios si no existen."""
        (self.static_dir).parent.mkdir(parents=True, exist_ok=True)


settings = Settings()
"""Instancia unica de configuracion usada por el resto de los modulos."""
