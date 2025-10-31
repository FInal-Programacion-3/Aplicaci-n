# Head Soccer FastAPI

Este repositorio contiene el backend que acompaña al minijuego estilo *Head Soccer*. El servidor entrega los recursos estáticos, publica los endpoints requeridos para el modo online y administra las salas WebSocket.

## Componentes principales

- **FastAPI (`app/main.py`)**: expone la página principal, maneja el acceso con contraseña y publica los sockets `/ws/game`, `/ws/create` y `/ws/join/{code}` que sincronizan la partida.
- **Matchmaking (`app/services/matchmaking.py`)**: gestiona la cola de jugadores y empareja clientes.
- **Hub WebSocket (`app/ws/hub.py`)**: crea salas, coordina las conexiones y difunde el estado compartido. `app/ws/private_rooms.py` añade el modo de salas privadas.
- **Taunts (`app/services/taunts.py`)**: carga frases que se devuelven a través de `GET /taunts.json`.
- **Frontend (`app/ui/…`)**: HTML + CSS + JavaScript para el canvas, sprites, animaciones y cliente WebSocket nativo.

## Dependencias destacadas

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

Además sigue disponible el endpoint `GET /api/matches` (y su par `POST`) para registrar partidas creadas desde clientes externos, junto con `GET /taunts.json` que expone las burlas precargadas.

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
