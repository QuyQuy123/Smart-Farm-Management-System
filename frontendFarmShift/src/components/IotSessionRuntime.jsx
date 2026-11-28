import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { startIotSession, stopIotSession } from '../services/iotSession';

export function IotSessionRuntime() {
  const { user } = useAuth();
  const account = user?.email;
  useEffect(() => {
    if (!account) return;
    startIotSession();
    return stopIotSession;
  }, [account]);
  return null;
}
