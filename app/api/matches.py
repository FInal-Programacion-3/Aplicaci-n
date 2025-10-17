"""Endpoints that provide lightweight match management."""

from __future__ import annotations

import time
import uuid
from typing import Dict, List

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.services.matchmaking import matchmaking_service

router = APIRouter(prefix="/api/matches", tags=["matches"])


class Match(BaseModel):
    """Representation of an active or historical match."""

    id: str
    players: List[str] = Field(default_factory=list)
    mode: str = "pvp"
    created_at: float = Field(default_factory=time.time)


class MatchCreate(BaseModel):
    """Payload used to create new matches."""

    players: List[str] = Field(default_factory=list)
    mode: str = Field(default="pvp", pattern="^(pvp|pve)$")


matches: Dict[str, Match] = {}


@router.get("/", response_model=List[Match])
def list_matches() -> List[Match]:
    """Return all known matches."""
    return list(matches.values())


@router.post("/", response_model=Match, status_code=status.HTTP_201_CREATED)
def create_match(payload: MatchCreate) -> Match:
    """Create a new match entry and return it."""
    match_id = uuid.uuid4().hex
    match = Match(id=match_id, players=payload.players, mode=payload.mode)
    matches[match_id] = match
    for player_id in payload.players:
        matchmaking_service.enqueue_player(player_id)
    return match


@router.get("/{match_id}", response_model=Match)
def get_match(match_id: str) -> Match:
    """Return details for a single match."""
    match = matches.get(match_id)
    if match is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Partido no encontrado.")
    return match

