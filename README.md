# Head Soccer FastAPI

Head Soccer FastAPI es un proyecto completo estilo “Head Soccer” listo para ejecutarse de forma local u hospedarse en un servicio web. Incluye backend FastAPI con WebSocket, frontend HTML5 Canvas, IA básica con burlas y pruebas automatizadas.

## Requisitos

- Python 3.11+
- Node/JavaScript **no requerido** (solo navegador moderno)

## Instalación

```bash
python -m venv .venv
.venv\Scripts\activate  
pip install -r requirements.txt
```

## Ejecución

```bash
uvicorn app.main:app --reload
```

Abre http://localhost:8000/ en el navegador para jugar. El WebSocket se sirve en ws://localhost:8000/ws/game.

## Estructura

```
head-soccer-fastapi/
├─ app/
│  ├─ main.py                # FastAPI + rutas + WebSocket
│  ├─ api/                   # Endpoints REST
│  ├─ core/                  # Modelos, física, IA, power-ups
│  ├─ services/              # Matchmaking y burlas
│  ├─ ws/                    # Hub de WebSocket
│  └─ ui/                    # Frontend Canvas
├─ app_data/players.json     # Persistencia de jugadores
├─ tests/                    # Pruebas unitarias
├─ requirements.txt
├─ run_local.sh / run_windows.bat
└─ README.md
```

## Controles por defecto

- Jugador 1: `A` / `D` para moverse, `W` para saltar, `1/2/3` para activar poderes.
- Jugador 2: `←` / `→` para moverse, `↑` para saltar, `7/8/9` para activar poderes.

## Endpoints REST

- `GET /api/players` — Lista jugadores.
- `POST /api/players` — Crea jugador.
- `GET /api/players/{id}` — Obtiene un jugador.
- `PUT /api/players/{id}` — Actualiza jugador.
- `DELETE /api/players/{id}` — Elimina jugador.
- `GET /api/matches` — Lista partidos registrados.
- `POST /api/matches` — Registra un partido (PvP o PvE).
- `GET /api/stats/plot.png` — Devuelve gráfico PNG de goles.
- `GET /taunts.json` — Devuelve burlas disponibles.

## Ejemplos cURL

```bash
# Crear jugador
curl -X POST http://localhost:8000/api/players \
  -H "Content-Type: application/json" \
  -d '{"name": "CodexStar", "avatar": "player1", "secretPowerLevel": "LVL-2"}'

# Listar jugadores
curl http://localhost:8000/api/players

# Actualizar jugador
curl -X PUT http://localhost:8000/api/players/1 \
  -H "Content-Type: application/json" \
  -d '{"name": "CodexLegend"}'

# Eliminar jugador
curl -X DELETE http://localhost:8000/api/players/1
```

## Frontend y recursos

- El frontend se encuentra en `app/ui/` y usa solo HTML5, CSS y JavaScript nativo.
- Las imágenes de personajes residen en `app/ui/static/img/personajes/`. 
- El canvas dibuja sprites sencillos; la lógica de físicas cliente está pensada para modo local, mientras que las sincronizaciones se realizan por WebSocket en modo vs IA.

## IA y burlas

- La IA mueve un NPC hacia la pelota con ruido aleatorio.
- Las burlas se cargan desde `/taunts.json` usando `queue.Queue` en el servidor. Puedes editar el archivo JSON para incluir nuevas frases o llamar a `TauntService.fetch_remote_taunts()` con un endpoint público.

## Poderes

- `BigHead`, `SpeedBoost` y `SuperJump` están implementados en `app/core/powerups.py`. Cada uno registra duración y reversión automática mediante `collections.deque`.

## WebSocket

- `ws://localhost:8000/ws/game` maneja salas múltiples usando `collections.deque` en `MatchmakingService`.
- Se sincronizan estado del juego, chat y taunts de la IA.

## Pruebas

```bash
pytest
```

- `tests/test_models.py` valida creación de jugadores y validaciones regex.
- `tests/test_repository.py` verifica persistencia CRUD sobre JSON.
- `tests/test_api.py` cubre endpoints REST y gráfico PNG.

## Despliegue y CORS

- Para desplegar en Render, Railway o un VPS, configura variables de entorno habituales de FastAPI/uvicorn (por ejemplo `PORT`).
- El proyecto usa mismo origen por defecto. Si requieres frontends hospedados en otro dominio, habilita CORS en `app/main.py` usando `fastapi.middleware.cors.CORSMiddleware`.
- Puedes colocar Nginx o Caddy al frente para servir estáticos y realizar proxy al backend.

## Limpieza

- La API persiste jugadores en `app_data/players.json`. Haz copias de seguridad antes de un despliegue productivo.
- Los comandos `run_local.sh` y `run_windows.bat` automatizan creación de entorno virtual, instalación de dependencias y arranque del servidor.
