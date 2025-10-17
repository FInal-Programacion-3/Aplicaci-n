"""Pruebas de integracion para los endpoints de FastAPI."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient

from app.api import players as players_api
from app.api import stats as stats_api
from app.core.repository import PlayerRepository
from app.main import app


def test_player_endpoints(tmp_path) -> None:
    """Los endpoints CRUD deben administrar jugadores correctamente."""
    storage = tmp_path / "players.json"
    storage.write_text("[]", encoding="utf-8")
    repository = PlayerRepository(storage)
    players_api.player_repository = repository
    stats_api.player_repository = repository

    client = TestClient(app)

    create_response = client.post(
        "/api/players",
        json={"name": "ApiHero", "avatar": "player1", "secretPowerLevel": "LVL-2"},
    )
    assert create_response.status_code == 201
    player = create_response.json()
    player_id = player["id"]

    list_response = client.get("/api/players")
    assert list_response.status_code == 200
    assert any(item["id"] == player_id for item in list_response.json())

    update_response = client.put(
        f"/api/players/{player_id}",
        json={"name": "ApiLegend"},
    )
    assert update_response.status_code == 200
    assert update_response.json()["name"] == "ApiLegend"

    delete_response = client.delete(f"/api/players/{player_id}")
    assert delete_response.status_code == 204


def test_stats_endpoint(tmp_path) -> None:
    """El endpoint de estadisticas debe devolver un contenido PNG."""
    storage = tmp_path / "players.json"
    storage.write_text("[]", encoding="utf-8")
    repository = PlayerRepository(storage)
    stats_api.player_repository = repository
    players_api.player_repository = repository

    client = TestClient(app)
    response = client.get("/api/stats/plot.png")
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"
