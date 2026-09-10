import { DashboardWebSocketMessage, ConnectionStatus } from '../types';

export type MessageHandler = (msg: DashboardWebSocketMessage) => void;
export type StatusHandler = (status: ConnectionStatus) => void;

class DashboardWebSocketService {
  private ws: WebSocket | null = null;
  private messageListeners: Set<MessageHandler> = new Set();
  private statusListeners: Set<StatusHandler> = new Set();
  private reconnectTimer: number | null = null;
  private retryCount = 0;
  private maxRetries = 10;
  private currentStatus: ConnectionStatus = 'OFFLINE';
  private explicitlyClosed = false;

  public getStatus(): ConnectionStatus {
    return this.currentStatus;
  }

  public subscribe(onMessage: MessageHandler): () => void {
    this.messageListeners.add(onMessage);
    return () => {
      this.messageListeners.delete(onMessage);
    };
  }

  public subscribeStatus(onStatus: StatusHandler): () => void {
    this.statusListeners.add(onStatus);
    onStatus(this.currentStatus);
    return () => {
      this.statusListeners.delete(onStatus);
    };
  }

  public connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.explicitlyClosed = false;
    this.setStatus('RECONNECTING');

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws/dashboard`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.retryCount = 0;
        this.setStatus('ONLINE');
      };

      this.ws.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data) as DashboardWebSocketMessage;
          this.messageListeners.forEach((listener) => {
            try {
              listener(data);
            } catch (err) {
              console.error('[WS Handler Error]', err);
            }
          });
        } catch (err) {
          console.error('[WS Parse Error]', err);
        }
      };

      this.ws.onclose = () => {
        this.ws = null;
        if (!this.explicitlyClosed) {
          this.scheduleReconnect();
        } else {
          this.setStatus('OFFLINE');
        }
      };

      this.ws.onerror = (err) => {
        console.warn('[WS Connection Error]', err);
        // onclose will trigger next
      };
    } catch (err) {
      console.error('[WS Init Exception]', err);
      this.scheduleReconnect();
    }
  }

  public disconnect(): void {
    this.explicitlyClosed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setStatus('OFFLINE');
  }

  private setStatus(status: ConnectionStatus): void {
    this.currentStatus = status;
    this.statusListeners.forEach((listener) => listener(status));
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    this.retryCount++;
    this.setStatus(this.retryCount > this.maxRetries ? 'OFFLINE' : 'RECONNECTING');

    const delay = Math.min(1000 * Math.pow(1.5, Math.min(this.retryCount, 6)), 10000);
    this.reconnectTimer = window.setTimeout(() => {
      this.connect();
    }, delay);
  }
}

export const dashboardSocket = new DashboardWebSocketService();
