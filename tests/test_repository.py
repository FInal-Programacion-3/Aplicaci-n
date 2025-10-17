"""Tests for the JSON-backed player repository."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.models import PlayerCreate, PlayerUpdate
from app.core.repository import PlayerRepository


def test_repository_crud(tmp_path) -> None:
    """Exercise create, read, update and delete operations."""
    storage = tmp_path / "players.json"
    storage.write_text("[]", encoding="utf-8")
    repository = PlayerRepository(storage)

    created = repository.create_player(
        PlayerCreate(name="RepoHero", secret_power_level="LVL-3"),
    )
    assert created.id == 1

    fetched = repository.get_player(created.id)
    assert fetched is not None
    assert fetched.name == "RepoHero"

    updated = repository.update_player(
        created.id,
        PlayerUpdate(name="RepoLegend", secret_power_level="LVL-4"),
    )
    assert updated is not None
    assert updated.name == "RepoLegend"

    success = repository.delete_player(created.id)
    assert success is True
    assert repository.get_player(created.id) is None
