/** Cliente WebSocket para el modo versus y la IA. */
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

  /** Envía un mensaje de chat a la sala. */
  sendChat(message) {
    this._send({ type: "chat", message });
  }

  /** Empuja una actualización del estado de juego hacia el hub. */
  sendState(state) {
    this._send({ type: "state_update", state });
  }

  /** Solicita una burla de la IA al servidor. */
  requestTaunt() {
    this._send({ type: "request_taunt" });
  }

  /** Cierra la conexión WebSocket subyacente. */
  close() {
    this.socket.close();
  }

  /** Envía un payload si el socket está abierto. */
  _send(payload) {
    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(payload));
    }
  }
}

/** Cliente para las salas privadas del modo online. */
export class PrivateRoomSocket {
  constructor({ mode, code, onMessage, onClose }) {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const targetPath = mode === "create" ? "/ws/create" : `/ws/join/${(code || "").toUpperCase()}`;
    this.socket = new WebSocket(`${protocol}//${window.location.host}${targetPath}`);
    this.socket.addEventListener("message", (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (typeof onMessage === "function") {
          onMessage(payload);
        }
      } catch (error) {
        console.error("Mensaje de sala privada inválido:", error);
      }
    });
    this.socket.addEventListener("close", () => {
      if (typeof onClose === "function") {
        onClose();
      }
    });
  }

  /** Envía un mensaje JSON al oponente. */
  send(payload) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }
    this.socket.send(JSON.stringify(payload));
  }

  /** Cierra la conexión subyacente. */
  close() {
    if (!this.socket) {
      return;
    }
    try {
      this.socket.close();
    } catch (error) {
      console.warn("Error al cerrar socket de sala privada:", error);
    }
  }
}
