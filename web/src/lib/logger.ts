export interface LogEntry {
  timestamp: string;
  level: 'info' | 'debug' | 'error' | 'reasoning';
  message: string;
  data?: any;
}

export class StagehandLogger {
  private logs: LogEntry[] = [];
  private listeners: ((log: LogEntry) => void)[] = [];

  log(level: LogEntry['level'], message: string, data?: any) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data
    };
    
    this.logs.push(entry);
    this.notifyListeners(entry);
    
    // Also log to console for development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[${entry.level.toUpperCase()}] ${entry.message}`, data || '');
    }
  }

  addListener(listener: (log: LogEntry) => void) {
    this.listeners.push(listener);
  }

  removeListener(listener: (log: LogEntry) => void) {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  private notifyListeners(entry: LogEntry) {
    this.listeners.forEach(listener => listener(entry));
  }

  getLogs() {
    return this.logs;
  }

  clear() {
    this.logs = [];
  }
}

export const stagehandLogger = new StagehandLogger();
