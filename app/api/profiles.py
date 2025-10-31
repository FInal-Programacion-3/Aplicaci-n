"""Endpoints REST que administran perfiles de jugador."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field, field_validator

from app.core.profile_repository import profile_repository
from app.core.profiles import PlayerProfile, VipPlayerProfile

router = APIRouter(prefix="/api/profiles", tags=["profiles"])


class ProfilePayload(BaseModel):
    id: int
    nickname: str
    secret_code: str = Field(alias="secretCode")
    favourite_character: str = Field(alias="favouriteCharacter")
    wins: int
    losses: int
    is_vip: bool = Field(alias="isVip")
    badge: str
    tier: str | None = None
    bonus_multiplier: float | None = Field(alias="bonusMultiplier", default=None)
    last_match: str | None = Field(alias="lastMatch", default=None)
    recent_characters: list[str] = Field(alias="recentCharacters", default_factory=list)

    model_config = {"populate_by_name": True}


class ProfileCreate(BaseModel):
    nickname: str
    secret_code: str = Field(alias="secretCode")
    favourite_character: str = Field(alias="favouriteCharacter", default="player1")
    vip: bool = False
    tier: str | None = None

    @field_validator("nickname")
    def validate_nickname(cls, value: str) -> str:
        if not value or len(value) > 24:
            raise ValueError("El apodo debe tener hasta 24 caracteres.")
        return value

    model_config = {"populate_by_name": True}


class ProfileUpdate(BaseModel):
    nickname: str | None = None
    secret_code: str | None = Field(alias="secretCode", default=None)
    favourite_character: str | None = Field(alias="favouriteCharacter", default=None)
    wins: int | None = None
    losses: int | None = None
    vip: bool | None = None
    tier: str | None = None

    @field_validator("nickname")
    def validate_nickname(cls, value: str | None) -> str | None:
        if value and len(value) > 24:
            raise ValueError("El apodo debe tener hasta 24 caracteres.")
        return value

    model_config = {"populate_by_name": True}


def _to_payload(profile: PlayerProfile) -> ProfilePayload:
    return ProfilePayload(**profile.to_payload())


@router.get("/", response_model=list[ProfilePayload])
def list_profiles() -> list[ProfilePayload]:
    profiles = profile_repository.list_profiles()
    return [_to_payload(profile) for profile in profiles]


@router.post("/", response_model=ProfilePayload, status_code=status.HTTP_201_CREATED)
def create_profile(payload: ProfileCreate) -> ProfilePayload:
    profile: PlayerProfile
    if payload.vip:
        profile = VipPlayerProfile(
            id=0,
            nickname=payload.nickname,
            secret_code=payload.secret_code,
            favourite_character=payload.favourite_character,
            tier=payload.tier or "Gold",
        )
    else:
        profile = PlayerProfile(
            id=0,
            nickname=payload.nickname,
            secret_code=payload.secret_code,
            favourite_character=payload.favourite_character,
        )
    created = profile_repository.create_profile(profile)
    return _to_payload(created)


@router.get("/{profile_id}", response_model=ProfilePayload)
def get_profile(profile_id: int) -> ProfilePayload:
    profile = profile_repository.get_profile(profile_id)
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Perfil no encontrado.")
    return _to_payload(profile)


@router.put("/{profile_id}", response_model=ProfilePayload)
def update_profile(profile_id: int, payload: ProfileUpdate) -> ProfilePayload:
    updates = payload.model_dump(exclude_unset=True, by_alias=True)
    if "vip" in updates:
        vip_flag = updates.pop("vip")
        updates["type"] = "vip" if vip_flag else "standard"
    profile = profile_repository.update_profile(profile_id, updates)
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Perfil no encontrado.")
    return _to_payload(profile)


@router.delete("/{profile_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_profile(profile_id: int) -> None:
    success = profile_repository.delete_profile(profile_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Perfil no encontrado.")
