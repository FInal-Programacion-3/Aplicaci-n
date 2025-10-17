"""Unit tests for core models."""

import pytest

from app.core.models import Player


def test_player_creation_defaults() -> None:
    """Ensure the player starts with expected defaults."""
    player = Player(player_id=1, name="Hero123")
    assert player.score == 0
    assert player.secret_power_level == "LVL-1"
    assert player.position.shape == (2,)


def test_secret_power_level_validation() -> None:
    """Validate getter and setter for the secret level."""
    player = Player(player_id=2, name="Wizard77")
    player.secret_power_level = "LVL-5"
    assert player.secret_power_level == "LVL-5"
    with pytest.raises(ValueError):
        player.secret_power_level = "BAD"


def test_name_regex_validation() -> None:
    """Player names must match the configured regular expression."""
    with pytest.raises(ValueError):
        Player(player_id=3, name="no spaces")
