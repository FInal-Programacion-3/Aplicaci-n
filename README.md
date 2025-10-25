# Head Soccer FastAPI

Head Soccer FastAPI es un proyecto completo estilo “Head Soccer” listo para ejecutarse de forma local u hospedarse en un servicio web. Incluye backend FastAPI con WebSocket, frontend HTML5 Canvas, IA básica con burlas y pruebas automatizadas.

## Conceptos aplicados

1. **Clases, herencia y encapsulamiento**
   - `app/core/abstractions.py` define la clase abstracta `Character` con los metodos `move`, `jump` y `apply_powerup` como contrato comun.
   - `app/core/models.py` implementa `Player`, que hereda de `Character` y mantiene al menos cinco atributos (`id`, `name`, `position`, `velocity`, `avatar`, con `score`, `energy` y `power_history` como estado extra). El atributo `__secret_power_level` permanece encapsulado y se expone mediante la propiedad `secret_power_level`, donde se valida el formato `LVL-#`.
   - `app/core/models.py` tambien define `NPC`, otra implementacion de `Character` utilizada por la IA; redefine los metodos abstractos para aplicar polimorfismo (por ejemplo, agrega ruido al movimiento y gestiona burlas con una cola).

2. **Librerias y otras cosas**
   - `collections.deque` y `queue.Queue` respaldan el historial de poderes y la cola de burlas en `app/core/models.py`, mientras que `queue.Empty` controla los casos sin mensajes pendientes.
   - `numpy` provee los vectores de posicion y velocidad a traves de la funcion `vector(...)` y los metodos de movimiento y salto (`app/core/models.py` y `app/core/physics.py`).
   - `requests` y `json` permiten descargar burlas remotas y leer o escribir archivos locales en `app/services/taunts.py`, complementados con validaciones mediante `re` y sincronizacion con `threading.Lock` en `app/core/repository.py`.
   - `matplotlib` genera el grafico PNG de puntajes expuesto en `/api/stats/plot.png` desde `app/api/stats.py`.

3. **CRUD completo de la clase principal**
   - `PlayerRepository` (`app/core/repository.py`) implementa `list_players`, `get_player`, `create_player`, `update_player` y `delete_player`, persistiendo los objetos mediante `PlayerInRepository` sobre `app_data/players.json`.
   - Las rutas REST en `app/api/players.py` exponen cada operacion con los esquemas `PlayerCreate`, `PlayerUpdate` y `PlayerPayload` (`app/core/models.py`), garantizando validacion y serializacion hacia el frontend.

4. **Interfaz grafica / interactiva**
   - El cliente HTML5 se encuentra en `app/ui/templates/index.html`, monta el canvas y carga los datos de `app/ui/static/data/characters.json`.
   - `app/ui/static/js/game.js` procesa el teclado, anima los sprites y sincroniza la partida por WebSocket (`app/main.py`) para partidas locales o contra la IA.

5. **Dependencias y modulos instalables**
   - Las librerias necesarias se listan en `requirements.txt` (`fastapi`, `uvicorn[standard]`, `numpy`, `requests`, `matplotlib`, entre otras). Tras crear el entorno virtual basta ejecutar `pip install -r requirements.txt`.
   - Recursos estaticos y archivos de datos (como `app_data/players.json`) se generan o sirven automaticamente al ejecutar el servidor.

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
