"""Endpoints REST que administran perfiles de jugador."""

from __future__ import annotations

from copy import deepcopy

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field, field_validator

from app.core.profile_repository import profile_repository
from app.core.profiles import PlayerProfile, VipPlayerProfile

router = APIRouter(prefix="/api/profiles", tags=["profiles"])

DEFAULT_VIP_CUSTOM_SPRITE = "img/personajes/exclusivo.png"
DEFAULT_VIP_CUSTOM_PORTRAIT = "img/personajes/exclusivo.png"
DEFAULT_VIP_CUSTOM_CHARACTER: dict[str, object] = {
    "name": "Personaje VIP",
    "sprite": DEFAULT_VIP_CUSTOM_SPRITE,
    "portrait": DEFAULT_VIP_CUSTOM_PORTRAIT,
    "powerIcon": DEFAULT_VIP_CUSTOM_PORTRAIT,
    "tagline": "Potencia experimental.",
    "description": "Potencia experimental.",
    "stats": {"speed": 100.0, "jump": 100.0, "power": 80.0},
    "isVipExclusive": True,
}
DEFAULT_VIP_SKINS: dict[str, dict[str, str]] = {
    "Prime": {
        "sprite": "img/personajes/prime3.png",
        "portrait": "img/personajes/prime_portrait2.png",
        "powerIcon": "img/poderes/prime_power.png",
    },
    "Colapinto": {
        "sprite": "img/personajes/colapinto.png",
        "portrait": "img/personajes/colapinto_power_sprite.png",
        "powerIcon": "img/poderes/colapinto_power.png",
    },
}


class CharacterStatsPayload(BaseModel):
    speed: float = Field(default=50, ge=0, le=100)
    jump: float = Field(default=50, ge=0, le=100)
    power: float = Field(default=50, ge=0, le=100)

    model_config = {"populate_by_name": True}


class VipSkinPayload(BaseModel):
    sprite: str
    portrait: str | None = None
    power_icon: str | None = Field(alias="powerIcon", default=None)

    model_config = {"populate_by_name": True}


class CustomCharacterPayload(BaseModel):
    id: str | None = None
    name: str
    sprite: str
    portrait: str | None = None
    tagline: str | None = None
    description: str | None = None
    power_icon: str | None = Field(alias="powerIcon", default=None)
    stats: CharacterStatsPayload = Field(default_factory=CharacterStatsPayload)
    is_vip_exclusive: bool | None = Field(alias="isVipExclusive", default=None)

    model_config = {"populate_by_name": True}


class ProfilePayload(BaseModel):
    id: int
    nickname: str
    secret_code: str = Field(alias="secretCode")
    favourite_character: str = Field(alias="favouriteCharacter")
    wins: int
    losses: int
    goals_for: int = Field(alias="goalsFor")
    goals_against: int = Field(alias="goalsAgainst")
    is_vip: bool = Field(alias="isVip")
    badge: str
    tier: str | None = None
    bonus_multiplier: float | None = Field(alias="bonusMultiplier", default=None)
    last_match: str | None = Field(alias="lastMatch", default=None)
    recent_characters: list[str] = Field(alias="recentCharacters", default_factory=list)
    music_track: str | None = Field(alias="musicTrack", default=None)
    vip_skins: dict[str, VipSkinPayload] = Field(alias="vipSkins", default_factory=dict)
    custom_character: CustomCharacterPayload | None = Field(alias="customCharacter", default=None)

    model_config = {"populate_by_name": True}


class ProfileCreate(BaseModel):
    nickname: str
    secret_code: str = Field(alias="secretCode")
    favourite_character: str = Field(alias="favouriteCharacter", default="player1")
    vip: bool = False
    tier: str | None = None
    music_track: str | None = Field(alias="musicTrack", default=None)
    vip_skins: dict[str, VipSkinPayload] | None = Field(alias="vipSkins", default=None)
    custom_character: CustomCharacterPayload | None = Field(alias="customCharacter", default=None)

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
    goals_for: int | None = Field(alias="goalsFor", default=None)
    goals_against: int | None = Field(alias="goalsAgainst", default=None)
    recent_characters: list[str] | None = Field(alias="recentCharacters", default=None)
    vip: bool | None = None
    tier: str | None = None
    music_track: str | None = Field(alias="musicTrack", default=None)
    vip_skins: dict[str, VipSkinPayload] | None = Field(alias="vipSkins", default=None)
    custom_character: CustomCharacterPayload | None = Field(alias="customCharacter", default=None)

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
    vip_skins = _build_default_vip_skins(payload.vip_skins)
    custom_character: dict[str, object] | None = None
    if payload.vip:
        custom_character = _build_default_custom_character(payload.custom_character)
        profile = VipPlayerProfile(
            id=0,
            nickname=payload.nickname,
            secret_code=payload.secret_code,
            favourite_character=payload.favourite_character,
            tier=payload.tier or "Gold",
            music_track=payload.music_track,
            skin_overrides=vip_skins,
            custom_character=custom_character,
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


def _build_default_custom_character(
    overrides: CustomCharacterPayload | None,
) -> dict[str, object]:
    base_character = deepcopy(DEFAULT_VIP_CUSTOM_CHARACTER)
    if not overrides:
        return base_character
    override_data = overrides.model_dump(exclude_unset=True, by_alias=True)
    stats_override = override_data.pop("stats", None)
    for key, value in override_data.items():
        if value is not None:
            base_character[key] = value
    if stats_override:
        base_character["stats"] = stats_override
    return base_character


def _build_default_vip_skins(
    overrides: dict[str, VipSkinPayload] | None,
) -> dict[str, dict[str, str]]:
    skins = deepcopy(DEFAULT_VIP_SKINS)
    if not overrides:
        return skins
    for key, definition in overrides.items():
        skins[key] = definition.model_dump(by_alias=True)
    return skins
