import { useEffect, useState } from 'react';
import { dashboardSocket, MessageHandler } from '../services/websocket';
import { ConnectionStatus, DashboardWebSocketMessage } from '../types';

export function useDashboardSocket(onMessage?: MessageHandler) {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(
    dashboardSocket.getStatus()
  );

  useEffect(() => {
    const unsubStatus = dashboardSocket.subscribeStatus((status) => {
      setConnectionStatus(status);
    });

    let unsubMsg: (() => void) | undefined;
    if (onMessage) {
      unsubMsg = dashboardSocket.subscribe(onMessage);
    }

    dashboardSocket.connect();

    return () => {
      unsubStatus();
      if (unsubMsg) unsubMsg();
    };
  }, [onMessage]);

  return { connectionStatus };
}
