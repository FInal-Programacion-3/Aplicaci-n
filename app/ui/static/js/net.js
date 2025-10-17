const baseUrl = `${window.location.protocol}//${window.location.host}`;

/** Simple REST helper that wraps fetch for the FastAPI backend. */
export class ApiClient {
  constructor(root = baseUrl) {
    this.root = root;
  }

  /** Fetch the list of registered players. */
  async listPlayers() {
    const response = await fetch(`${this.root}/api/players`);
    if (!response.ok) {
      throw new Error("No se pudo cargar la lista de jugadores.");
    }
    return await response.json();
  }

  /** Create a new player profile through the API. */
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

/** Wrapper around the WebSocket that normalizes message passing. */
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

  /** Send a chat message to the room. */
  sendChat(message) {
    this._send({ type: "chat", message });
  }

  /** Push a game state update to the hub. */
  sendState(state) {
    this._send({ type: "state_update", state });
  }

  /** Request an AI taunt from the server. */
  requestTaunt() {
    this._send({ type: "request_taunt" });
  }

  /** Close the underlying WebSocket connection. */
  close() {
    this.socket.close();
  }

  _send(payload) {
    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(payload));
    }
  }
}
