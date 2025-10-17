"""Endpoints que ofrecen una gestion liviana de partidos."""

from __future__ import annotations

import time
import uuid
from typing import Dict, List

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.services.matchmaking import matchmaking_service

router = APIRouter(prefix="/api/matches", tags=["matches"])


class Match(BaseModel):
    """Representacion de un partido activo o historico."""

    id: str
    players: List[str] = Field(default_factory=list)
    mode: str = "pvp"
    created_at: float = Field(default_factory=time.time)


class MatchCreate(BaseModel):
    """Carga util utilizada para crear nuevos partidos."""

    players: List[str] = Field(default_factory=list)
    mode: str = Field(default="pvp", pattern="^(pvp|pve)$")


matches: Dict[str, Match] = {}


@router.get("/", response_model=List[Match])
def list_matches() -> List[Match]:
    """Devuelve todos los partidos conocidos."""
    return list(matches.values())


@router.post("/", response_model=Match, status_code=status.HTTP_201_CREATED)
def create_match(payload: MatchCreate) -> Match:
    """Crea un partido nuevo y lo devuelve."""
    match_id = uuid.uuid4().hex
    match = Match(id=match_id, players=payload.players, mode=payload.mode)
    matches[match_id] = match
    for player_id in payload.players:
        matchmaking_service.enqueue_player(player_id)
    return match


@router.get("/{match_id}", response_model=Match)
def get_match(match_id: str) -> Match:
    """Devuelve los detalles de un partido puntual."""
    match = matches.get(match_id)
    if match is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Partido no encontrado.")
    return match
