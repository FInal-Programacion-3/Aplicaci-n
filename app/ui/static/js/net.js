const baseUrl = `${window.location.protocol}//${window.location.host}`;

/** Ayudante REST sencillo que envuelve fetch para el backend FastAPI. */
export class ApiClient {
  constructor(root = baseUrl) {
    this.root = root;
  }

  /** Obtiene la lista de jugadores registrados. */
  async listPlayers() {
    const response = await fetch(`${this.root}/api/players`);
    if (!response.ok) {
      throw new Error("No se pudo cargar la lista de jugadores.");
    }
    return await response.json();
  }

  /** Crea un perfil de jugador mediante la API. */
  async createPlayer(payload) {
    const response = await fetch(`${this.root}/api/players`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text);
    }
    return await response.json();
  }
}

/** Envoltorio del WebSocket que normaliza el intercambio de mensajes. */
export class GameSocket {
  constructor(onMessage, onClose) {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const randomId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2);
    const url = `${protocol}//${window.location.host}/ws/game?playerId=web-${randomId}`;
    this.socket = new WebSocket(url);
    this.socket.addEventListener("message", (event) => {
      try {
        const payload = JSON.parse(event.data);
        onMessage(payload);
      } catch (error) {
        console.error("Mensaje WS inválido", error);
      }
    });
    this.socket.addEventListener("close", onClose);
  }

  /** Envia un mensaje de chat a la sala. */
  sendChat(message) {
    this._send({ type: "chat", message });
  }

  /** Empuja una actualizacion del estado de juego hacia el hub. */
  sendState(state) {
    this._send({ type: "state_update", state });
  }

  /** Solicita una burla de la IA al servidor. */
  requestTaunt() {
    this._send({ type: "request_taunt" });
  }

  /** Cierra la conexion WebSocket subyacente. */
  close() {
    this.socket.close();
  }

  /** Envia un payload si el socket esta abierto. */
  _send(payload) {
    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(payload));
    }
  }
}
