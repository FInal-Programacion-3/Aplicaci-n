"""Pruebas para el CRUD de perfiles."""

from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from app import main as main_module
from app.api import profiles as profiles_api
from app.core import profile_repository as profile_repo_module
from app.core.profile_repository import ProfileRepository


def test_profile_crud(tmp_path: Path) -> None:
    """Los endpoints deben permitir crear, listar, actualizar y borrar perfiles."""
    storage = tmp_path / "profiles.json"
    storage.write_text("[]", encoding="utf-8")
    repository = ProfileRepository(storage)
    profile_repo_module.profile_repository = repository
    main_module.profile_repository = repository
    profiles_api.profile_repository = repository
    client = TestClient(main_module.app)

    create_response = client.post(
        "/api/profiles",
        json={
            "nickname": "Tester",
            "secretCode": "SC-AB12",
            "favouriteCharacter": "player1",
        },
    )
    assert create_response.status_code == 201
    profile = create_response.json()
    profile_id = profile["id"]

    list_response = client.get("/api/profiles")
    assert list_response.status_code == 200
    assert any(item["id"] == profile_id for item in list_response.json())

    update_response = client.put(
        f"/api/profiles/{profile_id}",
        json={"wins": 3},
    )
    assert update_response.status_code == 200
    assert update_response.json()["wins"] == 3

    delete_response = client.delete(f"/api/profiles/{profile_id}")
    assert delete_response.status_code == 204
