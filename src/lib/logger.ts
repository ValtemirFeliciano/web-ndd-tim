/**
 * Sistema de logging completo com exportação para arquivo
 */

export type LogLevel = "info" | "ok" | "warn" | "error";

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  details?: string;
  context?: string;
}

class Logger {
  private logs: LogEntry[] = [];
  private sessionId: string;

  constructor() {
    this.sessionId = this.generateSessionId();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private getTimestamp(): string {
    const now = new Date();
    return now.toISOString();
  }

  private formatTime(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  }

  log(level: LogLevel, message: string, details?: string, context?: string): void {
    const entry: LogEntry = {
      timestamp: this.getTimestamp(),
      level,
      message,
      details,
      context,
    };
    this.logs.push(entry);

    // Limitar a 500 logs em memória
    if (this.logs.length > 500) {
      this.logs.shift();
    }
  }

  info(message: string, details?: string, context?: string): void {
    this.log("info", message, details, context);
  }

  ok(message: string, details?: string, context?: string): void {
    this.log("ok", message, details, context);
  }

  warn(message: string, details?: string, context?: string): void {
    this.log("warn", message, details, context);
  }

  error(message: string, details?: string, context?: string): void {
    this.log("error", message, details, context);
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  clear(): void {
    this.logs = [];
    this.sessionId = this.generateSessionId();
  }

  exportToText(): string {
    const lines: string[] = [];
    
    lines.push("=".repeat(80));
    lines.push("NDD FORGE - LOG COMPLETO");
    lines.push("=".repeat(80));
    lines.push(`Sessão: ${this.sessionId}`);
    lines.push(`Data/Hora: ${new Date().toLocaleString("pt-BR")}`);
    lines.push(`Total de logs: ${this.logs.length}`);
    lines.push("=".repeat(80));
    lines.push("");

    this.logs.forEach((entry) => {
      const time = this.formatTime(entry.timestamp);
      const levelSymbol = {
        info: "▸",
        ok: "✓",
        warn: "▲",
        error: "✕",
      }[entry.level];

      lines.push(`[${time}] ${levelSymbol} ${entry.message}`);
      
      if (entry.context) {
        lines.push(`  Contexto: ${entry.context}`);
      }
      
      if (entry.details) {
        lines.push(`  Detalhes:`);
        entry.details.split("\n").forEach((line) => {
          lines.push(`    ${line}`);
        });
      }
      
      lines.push("");
    });

    lines.push("=".repeat(80));
    lines.push("FIM DO LOG");
    lines.push("=".repeat(80));

    return lines.join("\n");
  }

  exportToFile(): void {
    const content = this.exportToText();
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").substring(0, 19);
    const filename = `ndd-forge-log-${timestamp}.txt`;
    
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }
}

// Instância global do logger
export const logger = new Logger();
