# Head Soccer FastAPI

Este repositorio contiene el backend que acompaña al minijuego estilo *Head Soccer*. El servidor entrega los recursos estáticos, publica los endpoints requeridos para el modo online y administra las salas WebSocket.

## Componentes principales

- **FastAPI (`app/main.py`)**: expone la página principal, maneja el acceso con contraseña y publica los sockets `/ws/game`, `/ws/create` y `/ws/join/{code}` que sincronizan la partida.
- **Perfiles (`app/core/profiles.py`)**: clases con encapsulamiento y herencia (`PlayerProfile` y `VipPlayerProfile`) que almacenan estadísticas y códigos secretos.
- **Repositorio (`app/core/profile_repository.py`)**: CRUD completo sobre `app_data/profiles.json` usando `json`, `pathlib`, `deque` y `threading.Lock`.
- **API de perfiles (`app/api/profiles.py`)**: expone endpoints REST para crear, listar, actualizar y eliminar perfiles; además la vista `/profiles` permite gestionarlos desde el navegador.
- **Matchmaking (`app/services/matchmaking.py`)**: gestiona la cola de jugadores y empareja clientes.
- **Hub WebSocket (`app/ws/hub.py`)**: crea salas, coordina las conexiones y difunde el estado compartido. `app/ws/private_rooms.py` añade el modo de salas privadas.
- **Taunts (`app/services/taunts.py`)**: carga frases que se devuelven a través de `GET /taunts.json`.
- **Frontend (`app/ui/…`)**: HTML + CSS + JavaScript para el canvas, sprites, animaciones y cliente WebSocket nativo.

## Dependencias destacadas

- `collections.deque`, `json`, `re`, `threading` y `datetime` para el manejo de perfiles.
- `requests`: descarga opcional de burlas remotas.
- `aiofiles`: soporte para levantar archivos estáticos con Uvicorn/ASGI.
- `python-multipart`: requerido por FastAPI para procesar el formulario de login.

Instala todo con:

```bash
python -m venv .venv
.venv\Scripts\activate  # o source .venv/bin/activate en Linux/macOS
pip install -r requirements.txt
```

## Ejecución

```bash
uvicorn app.main:app --reload
```

Abre http://localhost:8000/ en el navegador para jugar. Los WebSockets se encuentran en:

- `ws://localhost:8000/ws/game`
- `ws://localhost:8000/ws/create`
- `ws://localhost:8000/ws/join/{code}`

Además sigue disponibles:
- `GET /profiles` — vista HTML para gestionar perfiles.
- `GET/POST/PUT/DELETE /api/profiles` — CRUD completo de perfiles.
- `GET /api/matches` y `POST /api/matches` — administración ligera de partidas.
- `GET /taunts.json` — burlas precargadas que utiliza el frontend.

## Estructura

```
app/
├─ api/                 # Endpoints REST mínimos
├─ services/            # Matchmaking y burlas
├─ ws/                  # Hub WebSocket y salas privadas
└─ ui/                  # Frontend Canvas
```

## Despliegue

Para plataformas como Railway o Render alcanza con ejecutar el comando del `Procfile`. FastAPI ya ajusta cabeceras `X-Forwarded-*` mediante el middleware `forwarded_proto_guard`, por lo que funciona detrás de un proxy reverso sin configuración extra.

## Pruebas

```bash
python -m pytest
```

El conjunto actual valida el flujo del CRUD de perfiles (`tests/test_profiles.py`).
