# Head Soccer FastAPI

Este repositorio contiene el backend que acompaña al minijuego estilo *Head Soccer*. El servidor entrega los recursos estáticos, publica los endpoints requeridos para el modo online y mantiene la lógica necesaria para la IA básica y la administración de salas WebSocket.

## Componentes principales

- **FastAPI (`app/main.py`)**: expone la página principal, maneja el acceso con contraseña y publica los sockets `/ws/game`, `/ws/create` y `/ws/join/{code}` que sincronizan la partida.
- **Modelos (`app/core/models.py`)**: definen `Arena`, `Ball` y `NPC`, clases que usa el hub para simular la física liviana y el comportamiento de la IA.
- **IA y matchmaking**: `app/core/ai.py` decide los movimientos del NPC; `app/services/matchmaking.py` gestiona las colas de emparejamiento; `app/services/taunts.py` carga burlas locales o remotas.
- **Hub WebSocket (`app/ws/hub.py`)**: crea salas, empareja jugadores y ejecuta los pulsos de la IA. `app/ws/private_rooms.py` añade el modo de salas privadas.
- **Frontend (`app/ui/…`)**: HTML + CSS + JavaScript para el canvas, sprites, animaciones y cliente WebSocket nativo.

## Dependencias destacadas

- `numpy`: vectores y operaciones numéricas para la pelota y el NPC.
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
├─ core/                # Modelos y utilidades de IA/física
├─ services/            # Matchmaking y burlas
├─ ws/                  # Hub WebSocket y salas privadas
└─ ui/                  # Frontend Canvas
```

## Despliegue

Para plataformas como Railway o Render alcanza con ejecutar el comando del `Procfile`. FastAPI ya ajusta cabeceras `X-Forwarded-*` mediante el middleware `forwarded_proto_guard`, por lo que funciona detrás de un proxy reverso sin configuración extra.

