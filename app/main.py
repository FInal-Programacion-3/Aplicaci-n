"""Fabrica y punto de entrada de la aplicacion FastAPI."""

from __future__ import annotations

import json
import logging
import uuid
from pathlib import Path
from typing import Any, Dict

from fastapi import FastAPI, Form, Request, Response, WebSocket
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates


from app.api import matches, profiles
from app.config import settings
from app.core.profile_repository import profile_repository
from app.core.profiles import PlayerProfile, VipPlayerProfile
from app.services.taunts import taunt_service
from app.ws.hub import game_hub
from app.ws.private_rooms import private_room_hub

LOGGER = logging.getLogger(__name__)

app = FastAPI(
    title="Cabezones Ingenierios",
    description="Servidor FastAPI con soporte REST y WebSocket para un juego estilo Head Soccer.",
    version="1.0.0",
)
"""Instancia principal de la aplicacion FastAPI."""

templates = Jinja2Templates(directory=str(Path(__file__).resolve().parent / "ui" / "templates"))
"""Administrador de plantillas que renderiza la pagina principal."""

app.mount("/static", StaticFiles(directory=str(settings.static_dir)), name="static")

app.include_router(matches.router)
app.include_router(profiles.router)


def user_has_access(request: Request) -> bool:
    """Determina si el cliente ya supero el control por contrasena."""
    if not settings.access_password:
        return True
    return request.cookies.get(settings.access_cookie_name) == settings.access_cookie_value


@app.middleware("http")
async def forwarded_proto_guard(request: Request, call_next):
    """Ajusta el esquema/host cuando la app corre detras de un proxy (Railway)."""
    proto = request.headers.get("x-forwarded-proto")
    if proto:
        request.scope["scheme"] = proto.split(",")[0].strip()
    host = request.headers.get("x-forwarded-host")
    if host:
        request.scope["server"] = (host.split(",")[0].strip(), request.scope["server"][1])
    port = request.headers.get("x-forwarded-port")
    if port and request.scope["server"]:
        request.scope["server"] = (request.scope["server"][0], int(port))
    return await call_next(request)


@app.get("/", response_class=HTMLResponse)
async def index(request: Request) -> Response:
    """Renderiza la pagina HTML principal que muestra el juego en canvas."""
    if not user_has_access(request):
        return RedirectResponse(url="/login", status_code=303) # Redirige a la pantalla de login
    context: Dict[str, Any] = {
        "request": request,
        "controls": {
            "p1": {"left": "A", "right": "D", "jump": "W", "powers": ["1", "2", "3"]},
            "p2": {"left": "←", "right": "→", "jump": "↑", "powers": ["7", "8", "9"]},
        },
    }
    return templates.TemplateResponse("index.html", context)


@app.get("/login", response_class=HTMLResponse)
async def login_form(request: Request) -> Response:
    """Muestra la pantalla para ingresar la contrasena de acceso."""
    if user_has_access(request):
        return RedirectResponse(url="/", status_code=303) # Ya tiene acceso, redirige a la pagina principal
    return templates.TemplateResponse("login.html", {"request": request, "error": False})


@app.post("/login")
async def login(request: Request, password: str = Form(...)) -> Response:
    """Valida la contrasena compartida y firma la cookie de acceso."""
    if not settings.access_password:
        return RedirectResponse(url="/", status_code=303) # Sin contrasena, redirige a la pagina principal
    if password == settings.access_password:
        response = RedirectResponse(url="/", status_code=303) # Contrasena correcta, redirige a la pagina principal
        response.set_cookie(
            key=settings.access_cookie_name, 
            value=settings.access_cookie_value, 
            max_age=settings.access_cookie_max_age,
            httponly=True,
            secure=request.url.scheme == "https",
            samesite="lax",
        )
        return response
    return templates.TemplateResponse(
        "login.html",
        {"request": request, "error": True},
        status_code=401,
    )




@app.get("/taunts.json", response_class=JSONResponse)
def taunts() -> JSONResponse:
    """Devuelve las burlas usadas por la IA para que el frontend las precargue."""
    return JSONResponse(content=taunt_service.load_local_taunts())


@app.get("/taunts/next", response_class=JSONResponse)
def taunt_next() -> JSONResponse:
    """Devuelve la siguiente burla en orden FIFO para el modo IA."""
    return JSONResponse(content={"taunt": taunt_service.get_next_taunt()})


def _redirect_with_message(message: str, error: bool = False) -> RedirectResponse:
    suffix = f"?{'error' if error else 'message'}={message}"
    return RedirectResponse(url=f"/profiles{suffix}", status_code=303)


@app.get("/profiles", response_class=HTMLResponse)
async def profiles_page(request: Request) -> Response:
    """Muestra la administración básica de perfiles de jugador."""
    if not user_has_access(request):
        return RedirectResponse(url="/login", status_code=303)
    profiles = [profile.to_payload() for profile in profile_repository.list_profiles()]
    characters: list[dict[str, object]] = []
    characters_file = settings.static_dir / "data" / "characters.json"
    if characters_file.exists():
        try:
            characters = json.loads(characters_file.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            LOGGER.warning("No se pudo interpretar characters.json para la pagina de perfiles")
    context = {
        "request": request,
        "profiles": profiles,
        "characters": characters,
        "message": request.query_params.get("message"),
        "error": request.query_params.get("error"),
    }
    return templates.TemplateResponse("profiles.html", context)


@app.post("/profiles/create")
async def profiles_create(
    request: Request,
    nickname: str = Form(...),
    secret_code: str = Form(...),
    favourite_character: str = Form("player1"),
    vip: str | None = Form(None),
    tier: str = Form("Gold"),
) -> Response:
    try:
        profile = (
            VipPlayerProfile(
                id=0,
                nickname=nickname,
                secret_code=secret_code,
                favourite_character=favourite_character,
                tier=tier or "Gold",
            )
            if vip
            else PlayerProfile(
                id=0,
                nickname=nickname,
                secret_code=secret_code,
                favourite_character=favourite_character,
            )
        )
        profile_repository.create_profile(profile)
    except ValueError as exc:
        return _redirect_with_message(str(exc), error=True)
    return _redirect_with_message("Perfil creado.")


@app.post("/profiles/update/{profile_id}")
async def profiles_update(
    profile_id: int,
    nickname: str | None = Form(None),
    secret_code: str | None = Form(None),
    favourite_character: str | None = Form(None),
    wins: str | None = Form(None),
    losses: str | None = Form(None),
    vip: str | None = Form(None),
    tier: str | None = Form(None),
) -> Response:
    updates: Dict[str, object] = {}
    if nickname:
        updates["nickname"] = nickname
    if secret_code:
        updates["secretCode"] = secret_code
    if favourite_character:
        updates["favouriteCharacter"] = favourite_character
    if wins:
        updates["wins"] = int(wins)
    if losses:
        updates["losses"] = int(losses)
    if vip is not None:
        updates["type"] = "vip"
        if tier:
            updates["tier"] = tier
    try:
        updated = profile_repository.update_profile(profile_id, updates)
    except ValueError as exc:
        return _redirect_with_message(str(exc), error=True)
    if updated is None:
        return _redirect_with_message("Perfil no encontrado.", error=True)
    return _redirect_with_message("Perfil actualizado.")


@app.post("/profiles/delete/{profile_id}")
async def profiles_delete(profile_id: int) -> Response:
    success = profile_repository.delete_profile(profile_id)
    if not success:
        return _redirect_with_message("Perfil no encontrado.", error=True)
    return _redirect_with_message("Perfil eliminado.")


@app.websocket("/ws/game")
async def websocket_endpoint(websocket: WebSocket) -> None:
    """Gestiona las conexiones WebSocket y delega en el concentrador."""
    player_id = websocket.query_params.get("playerId") or uuid.uuid4().hex
    room_id = await game_hub.connect(websocket, player_id)
    LOGGER.info("Player %s joined room %s", player_id, room_id)
    await game_hub.receive_loop(websocket, room_id, player_id)


@app.websocket("/ws/create")
async def websocket_create_room(websocket: WebSocket) -> None:
    """Permite crear una sala privada y esperar a un oponente."""
    LOGGER.info("Creando nueva sala privada")
    await private_room_hub.create_room(websocket)


@app.websocket("/ws/join/{code}")
async def websocket_join_room(websocket: WebSocket, code: str) -> None:
    """Permite unirse a una sala privada existente."""
    LOGGER.info("Intento de unir a sala privada %s", code)
    await private_room_hub.join_room(websocket, code)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", reload=True, host="0.0.0.0", port=8000)
