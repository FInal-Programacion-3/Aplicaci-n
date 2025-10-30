"""Endpoints REST para consultar el catálogo de personajes."""

from __future__ import annotations

from typing import List

from fastapi import APIRouter, HTTPException

from app.services.characters import character_catalog

router = APIRouter(prefix="/api/characters", tags=["characters"])


@router.get("/", response_model=List[dict])
def list_characters() -> List[dict]:
    """Devuelve todos los personajes registrados en el catálogo."""
    return [record.to_payload() for record in character_catalog.list_characters()]


@router.get("/{character_id}", response_model=dict)
def get_character(character_id: str) -> dict:
    """Devuelve un personaje puntual identificado por su ID."""
    record = character_catalog.get(character_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Personaje no encontrado.")
    return record.to_payload()
