import { useEffect, useState } from "react";

interface WebSocketEvent {
  type: string;
  endpoint?: any;
  data?: any;
  uuid?: string;
}

export const useWebhookWS = (url: string) => {
  const [endpoints, setEndpoints] = useState<any[]>([]);
  const [callbacks, setCallbacks] = useState<any[]>([]);

  useEffect(() => {
    const ws = new WebSocket(url);

    ws.onmessage = (event) => {
      const message: WebSocketEvent = JSON.parse(event.data);

      switch (message.type) {
        case "new-endpoint":
          setEndpoints((prev) => [message.endpoint, ...prev]);
          break;
        case "incoming-webhook":
          setCallbacks((prev) => [message.data, ...prev]);
          break;
        default:
          break;
      }
    };

    return () => ws.close();
  }, [url]);

  return { endpoints, callbacks };
};
