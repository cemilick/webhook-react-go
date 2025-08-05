import { useEffect, useState } from "react";

interface WebSocketEvent {
  type: string;
  endpoint?: any;
  data?: any;
  uuid?: string;
  browserId?: string;
}

export const useWebhookWS = (url: string) => {
  const [endpoints, setEndpoints] = useState<any[]>([]);
  const [callbacks, setCallbacks] = useState<any[]>([]);

  useEffect(() => {
    const ws = new WebSocket(url);

    const browserId = localStorage.getItem('BrowserID');
    if (!browserId) {
      console.error("BrowserID not found in localStorage");
      return;
    }

    ws.onmessage = (event) => {
      const message: WebSocketEvent = JSON.parse(event.data);

      switch (message.type) {
        case "new-endpoint":
            if (message.endpoint && message.browserId === browserId) {
                console.log('New endpoint received:', message.endpoint);
                setEndpoints((prev) => [message.endpoint, ...prev]);
            }
          break;
        case "incoming-webhook":
          if (message.data && message.browserId === browserId) {
            console.log('Incoming webhook data:', message.data);
            setCallbacks((prev) => [...prev, message.data]);
          }
          break;
        default:
          break;
      }
    };

    return () => ws.close();
  }, [url]);

  return { endpoints, callbacks };
};
