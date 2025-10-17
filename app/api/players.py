"""REST endpoints that expose CRUD operations for player profiles."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from app.core.models import PlayerCreate, PlayerPayload, PlayerUpdate
from app.core.repository import player_repository

router = APIRouter(prefix="/api/players", tags=["players"])


@router.get("/", response_model=list[PlayerPayload])
def list_players() -> list[PlayerPayload]:
    """Return all stored players."""
    players = player_repository.list_players()
    return [PlayerPayload(**player.as_payload()) for player in players]


@router.post("/", response_model=PlayerPayload, status_code=status.HTTP_201_CREATED)
def create_player(payload: PlayerCreate) -> PlayerPayload:
    """Create a new player and return its representation."""
    player = player_repository.create_player(payload)
    return PlayerPayload(**player.as_payload())


@router.get("/{player_id}", response_model=PlayerPayload)
def get_player(player_id: int) -> PlayerPayload:
    """Return the player matching the given identifier."""
    player = player_repository.get_player(player_id)
    if player is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Jugador no encontrado.")
    return PlayerPayload(**player.as_payload())


@router.put("/{player_id}", response_model=PlayerPayload)
def update_player(player_id: int, payload: PlayerUpdate) -> PlayerPayload:
    """Update an existing player."""
    player = player_repository.update_player(player_id, payload)
    if player is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Jugador no encontrado.")
    return PlayerPayload(**player.as_payload())


@router.delete("/{player_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_player(player_id: int) -> None:
    """Delete the targeted player."""
    success = player_repository.delete_player(player_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Jugador no encontrado.")

