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
    assert profile["goalsFor"] == 0
    assert profile["goalsAgainst"] == 0

    list_response = client.get("/api/profiles")
    assert list_response.status_code == 200
    assert any(item["id"] == profile_id for item in list_response.json())

    update_response = client.put(
        f"/api/profiles/{profile_id}",
        json={"wins": 3, "goalsFor": 5, "goalsAgainst": 2},
    )
    assert update_response.status_code == 200
    assert update_response.json()["wins"] == 3
    assert update_response.json()["goalsFor"] == 5
    assert update_response.json()["goalsAgainst"] == 2

    delete_response = client.delete(f"/api/profiles/{profile_id}")
    assert delete_response.status_code == 204


def test_vip_custom_attributes(tmp_path: Path) -> None:
    storage = tmp_path / "profiles.json"
    storage.write_text("[]", encoding="utf-8")
    repository = ProfileRepository(storage)
    profile_repo_module.profile_repository = repository
    main_module.profile_repository = repository
    profiles_api.profile_repository = repository
    client = TestClient(main_module.app)

    response = client.post(
        "/api/profiles",
        json={
            "nickname": "VipTester",
            "secretCode": "SC-VP11",
            "favouriteCharacter": "Cuervo",
            "vip": True,
            "tier": "Diamond",
            "musicTrack": "audio/vip_theme.mp3",
            "vipSkins": {
                "Cuervo": {
                    "sprite": "/static/img/personajes/cuervo_vip.png",
                    "portrait": "img/personajes/cuervo_vip_portrait.png",
                }
            },
                "customCharacter": {
                    "name": "Custom Hero",
                    "sprite": "img/custom/hero.png",
                    "portrait": "/static/img/custom/hero_portrait.png",
                    "description": "Personaje hecho a mano",
                    "stats": {
                        "speed": 90,
                        "jump": 40,
                        "power": 80,
                    },
                },
        },
    )
    assert response.status_code == 201, response.text
    payload = response.json()
    assert payload["isVip"] is True
    assert payload["musicTrack"] == "/static/audio/vip_theme.mp3"
    assert payload["vipSkins"]["Cuervo"]["sprite"] == "img/personajes/cuervo_vip.png"
    assert payload["vipSkins"]["Cuervo"]["portrait"] == "img/personajes/cuervo_vip_portrait.png"
    custom_character = payload["customCharacter"]
    assert custom_character["sprite"] == "img/custom/hero.png"
    assert custom_character["portrait"] == "img/custom/hero_portrait.png"
    assert custom_character["stats"]["speed"] == 90
    assert custom_character["stats"]["jump"] == 40
    assert custom_character["isVipExclusive"] is True
