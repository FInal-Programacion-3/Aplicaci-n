"""Application configuration utilities and constants."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict


@dataclass(slots=True)
class Settings:
    """Container for global configuration values used across the application."""

    base_dir: Path = field(default_factory=lambda: Path(__file__).resolve().parent.parent)
    data_dir: Path = field(init=False)
    players_file: Path = field(init=False)
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

    def __post_init__(self) -> None:
        """Initialize dynamic paths once the base directory is available."""
        self.data_dir = self.base_dir / "app_data"
        self.players_file = self.data_dir / "players.json"
        self.static_dir = self.base_dir / "app" / "ui" / "static"
        self.ensure_directories()

    def ensure_directories(self) -> None:
        """Create required directories and placeholder files when missing."""
        self.data_dir.mkdir(parents=True, exist_ok=True)
        if not self.players_file.exists():
            self.players_file.write_text("[]", encoding="utf-8")


settings = Settings()
"""Singleton settings instance consumed by the rest of the modules."""
