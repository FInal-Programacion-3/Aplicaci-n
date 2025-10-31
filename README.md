# Head Soccer FastAPI

Backend y frontend web para un minijuego estilo *Head Soccer*. El proyecto combina FastAPI, plantillas HTML, WebSockets y lógica de dominio en Python para ofrecer partidas locales, contra la IA y en línea.

## Cumplimiento de la consigna

| Requisito | Implementación | Referencias |
|-----------|----------------|-------------|
| **Documentación y buenas prácticas** | Clases, funciones y módulos cuentan con docstrings y comentarios breves. | `app/core/profiles.py`, `app/core/profile_repository.py`, `app/services/matchmaking.py`, `app/main.py`, `app/ws/hub.py` |
| **Modularización con main** | Código organizado por responsabilidad: núcleo (`app/core`), API (`app/api`), servicios (`app/services`), frontend (`app/ui`), WebSockets (`app/ws`). `app/main.py` es el punto de entrada (incluye `if __name__ == "__main__": uvicorn.run(...)`). | Estructura completa del paquete `app/` |
| **Clases con herencia y encapsulamiento** | `ProfileBase` (abstracta) define el contrato de perfiles. `PlayerProfile` hereda e implementa payloads; `VipPlayerProfile` extiende a la clase principal. Atributo `_secret_code` encapsulado mediante `@property`. | `app/core/profiles.py` |
| **Uso de al menos tres módulos de la lista** | Se emplean `re` (validaciones), `collections.deque` (historial y colas), `json` (persistencia), `requests` (taunts remotos) y `threading` (locks). | `app/core/profiles.py`, `app/core/profile_repository.py`, `app/services/taunts.py` |
| **CRUD completo** | `ProfileRepository` ofrece `list_profiles`, `get_profile`, `create_profile`, `update_profile`, `delete_profile`. Expuesto vía `app/api/profiles.py` y formulario `/profiles`. | `app/core/profile_repository.py`, `app/api/profiles.py`, `app/main.py` |
| **Interfaz gráfica/interactiva** | HTML + CSS + JS modernos: canvas principal (`app/ui/templates/index.html`), panel de perfiles (`app/ui/templates/profiles.html`), scripts (`app/ui/static/js/game.js`). | Directorio `app/ui/` |
| **Documentación de dependencias** | `requirements.txt` y secciones “Instalación” en este README. | `requirements.txt`, README |

## Arquitectura general

- **`app/main.py`**: configura FastAPI, middleware de cabeceras, rutas HTML y REST. Expone `/profiles`, `/taunts.json`, `/taunts/next`, y los endpoints WebSocket (`/ws/game`, `/ws/create`, `/ws/join/{code}`). 
- **Dominio de perfiles (`app/core/profiles.py`)**: define estructuras de datos con validaciones (`re`, `datetime`), encapsulamiento de `secret_code`, historial (`deque`) y serialización a payload JSON.
- **Persistencia (`app/core/profile_repository.py`)**: CRUD thread-safe sobre `app_data/profiles.json` usando `json`, `threading.Lock`, `pathlib` y `deque` para asignar IDs.
- **API REST (`app/api/profiles.py`, `app/api/matches.py`)**: endpoints JSON para gestionar perfiles y partidas simples.
- **Servicios**:
  - `matchmaking.py`: cola y emparejamiento con `deque` y locks.
  - `taunts.py`: carga/descarga de burlas (`json`, `requests`) y nueva cola FIFO con `collections.deque`.
- **WebSockets (`app/ws`)**: hubs para partidas públicas y salas privadas; encapsulan lógica de sincronización, colas de jugadores y broadcasting.
- **Frontend (`app/ui/`)**:
  - Plantillas `index.html` y `profiles.html` coordinadas con FastAPI.
  - Estilos en `app/ui/static/css/styles.css`.
  - Juego en `app/ui/static/js/game.js` (canvas, física, UI de selección, consumo de `/taunts/next` con fallback).
  - Recursos como sprites, audios y `characters.json`.

## Flujo principal del programa

1. **Inicio**: FastAPI renderiza `index.html`. El JS carga perfiles (`/api/profiles`), personajes y muestra un overlay “Jugar” hasta elegir modo.
2. **Perfiles**: formulario creando o actualizando datos a través de `ProfileRepository`. VIP y estándar comparten interfaz; las estadísticas se muestran pero no se editan manualmente.
3. **Modo IA**: cada evento relevante llama `aiSpeak(...)`, que solicita al backend la próxima burla con FIFO (`/taunts/next`). El servicio mantiene la cola circular en memoria; `taunts.json` provee decenas de frases iniciales.
4. **Modo online/local**: websockets en `app/ws/hub.py` y `app/ws/private_rooms.py` coordinan estado y acciones, mientras `matchmaking.py` gestiona espera de jugadores. 
5. **Persistencia**: cada cambio ejecuta `create/update/delete` sobre `profiles.json`. El repositorio asigna IDs consecutivos y asegura consistencia mediante locks.

## Instalación y dependencias

```bash
python -m venv .venv
.venv\Scripts\activate  # Windows
# source .venv/bin/activate en Linux/macOS
pip install -r requirements.txt
```

Dependencias relevantes:
- `fastapi`, `uvicorn`, `jinja2`, `python-multipart` (formularios), `aiofiles`.
- Módulos estándar requeridos por la consigna: `re`, `collections.deque`, `json`, `requests`, `threading`, entre otros.

## Ejecución

```bash
uvicorn app.main:app --reload
```

Abrí `http://localhost:8000/` para el juego. Endpoints clave:

- `GET /profiles` – panel visual para administrar perfiles.
- `GET /api/profiles` y `POST /api/profiles` – listado y creación JSON.
- `GET /taunts/next` – próxima burla FIFO para la IA.
- `ws://localhost:8000/ws/game` – socket principal del modo online.

## Pruebas automatizadas

```bash
python -m pytest
```

`tests/test_profiles.py` cubre el CRUD del repositorio y la serialización de perfiles (estándar y VIP). Agregar pruebas adicionales para servicios y websockets es sencillo reutilizando fixtures.

## Estructura de carpetas (resumen)

```
app/
├── api/               # Endpoints REST
├── core/              # Dominio y repositorios
├── services/          # Matchmaking, burlas y utilitarios
├── ui/                # Frontend HTML/CSS/JS y assets
└── ws/                # Hubs WebSocket
app_data/              # Persistencia en JSON
docs/                  # Consigna original y material extra
tests/                 # Suite de Pytest
```

## Próximos pasos sugeridos

- Extender la suite de pruebas a los servicios de WebSocket.
- Añadir persistencia remota (por ejemplo, base de datos) para perfiles en lugar de JSON.
- Permitir configuración de taunts remotos a través de variables de entorno.

Con esta base, el proyecto cumple la consigna y queda listo para seguir iterando sobre funcionalidades o portar el juego a producción.
