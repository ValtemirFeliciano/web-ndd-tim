import { useState, useEffect } from "react";
import { logger, type LogEntry } from "../lib/logger";

export function useLogger() {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    // Atualizar logs periodicamente
    const interval = setInterval(() => {
      setLogs(logger.getLogs());
    }, 100);

    return () => clearInterval(interval);
  }, []);

  const downloadLog = () => {
    logger.exportToFile();
  };

  const clearLogs = () => {
    logger.clear();
    setLogs([]);
  };

  return {
    logs,
    downloadLog,
    clearLogs,
    log: logger,
  };
}
