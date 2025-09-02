import fs from 'fs';
import path from 'path';

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'debug' | 'error' | 'reasoning' | 'stagehand';
  message: string;
  data?: any;
  sessionId?: string;
}

export class FileLogger {
  private logDir: string;
  private sessionId: string;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
    this.logDir = path.join(process.cwd(), 'logs');
    this.ensureLogDirectory();
  }

  private ensureLogDirectory() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private getLogFilePath() {
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    return path.join(this.logDir, `stagehand-${timestamp}-${this.sessionId}.log`);
  }

  log(level: LogEntry['level'], message: string, data?: any) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
      sessionId: this.sessionId
    };

    const logLine = `[${entry.timestamp}] [${entry.level.toUpperCase()}] ${entry.message}${data ? ` | Data: ${JSON.stringify(data, null, 2)}` : ''}\n`;
    
    try {
      fs.appendFileSync(this.getLogFilePath(), logLine);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }

    // Also log to console
    console.log(`[${entry.level.toUpperCase()}] ${entry.message}`, data || '');
  }

  logStagehandReasoning(message: string, data?: any) {
    this.log('stagehand', `🤖 REASONING: ${message}`, data);
  }

  logFormAnalysis(fieldName: string, action: string, data?: any) {
    this.log('reasoning', `📝 FORM: ${fieldName} - ${action}`, data);
  }

  logNavigation(step: string, action: string, data?: any) {
    this.log('reasoning', `🧭 NAV: ${step} - ${action}`, data);
  }

  logDecision(reasoning: string, decision: string, data?: any) {
    this.log('reasoning', `🧠 DECISION: ${reasoning} → ${decision}`, data);
  }
}
