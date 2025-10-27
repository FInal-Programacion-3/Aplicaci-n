"""Fabrica y punto de entrada de la aplicacion FastAPI."""

from __future__ import annotations

import logging
import uuid
from pathlib import Path
from typing import Any, Dict

from fastapi import FastAPI, Form, Request, Response, WebSocket
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates


from app.api import matches, players, stats
from app.config import settings
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

app.include_router(players.router)
app.include_router(matches.router)
app.include_router(stats.router)


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
        return RedirectResponse(url="/login", status_code=303)
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
        return RedirectResponse(url="/", status_code=303)
    return templates.TemplateResponse("login.html", {"request": request, "error": False})


@app.post("/login")
async def login(request: Request, password: str = Form(...)) -> Response:
    """Valida la contrasena compartida y firma la cookie de acceso."""
    if not settings.access_password:
        return RedirectResponse(url="/", status_code=303)
    if password == settings.access_password:
        response = RedirectResponse(url="/", status_code=303)
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
