"""Fabrica y punto de entrada de la aplicacion FastAPI."""

from __future__ import annotations

import logging
import uuid
from pathlib import Path
from typing import Any, Dict

from fastapi import FastAPI, Request, WebSocket
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.middleware.proxy_headers import ProxyHeadersMiddleware

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
app.add_middleware(ProxyHeadersMiddleware, trusted_hosts="*")

app.include_router(players.router)
app.include_router(matches.router)
app.include_router(stats.router)


@app.get("/", response_class=HTMLResponse)
async def index(request: Request) -> HTMLResponse:
    """Renderiza la pagina HTML principal que muestra el juego en canvas."""
    context: Dict[str, Any] = {
        "request": request,
        "controls": {
            "p1": {"left": "A", "right": "D", "jump": "W", "powers": ["1", "2", "3"]},
            "p2": {"left": "←", "right": "→", "jump": "↑", "powers": ["7", "8", "9"]},
        },
    }
    return templates.TemplateResponse("index.html", context)


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
