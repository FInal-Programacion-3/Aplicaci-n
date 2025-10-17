"""Pruebas unitarias para los modelos centrales."""

import pytest

from app.core.models import Player


def test_player_creation_defaults() -> None:
    """Verifica que el jugador inicie con los valores por defecto esperados."""
    player = Player(player_id=1, name="Hero123")
    assert player.score == 0
    assert player.secret_power_level == "LVL-1"
    assert player.position.shape == (2,)


def test_secret_power_level_validation() -> None:
    """Valida el getter y el setter del nivel secreto."""
    player = Player(player_id=2, name="Wizard77")
    player.secret_power_level = "LVL-5"
    assert player.secret_power_level == "LVL-5"
    with pytest.raises(ValueError):
        player.secret_power_level = "BAD"


def test_name_regex_validation() -> None:
    """Exige que los nombres coincidan con la expresion regular configurada."""
    with pytest.raises(ValueError):
        Player(player_id=3, name="no spaces")
