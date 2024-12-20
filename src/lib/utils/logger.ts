interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  data?: any;
}

class Logger {
  private logs: LogEntry[] = [];
  private maxLogs = 1000;
  private sessionId: string;

  constructor() {
    // Create unique session ID
    this.sessionId = new Date().toISOString();
    
    // Load existing logs from localStorage
    try {
      const storedLogs = localStorage.getItem('app_logs');
      if (storedLogs) {
        this.logs = JSON.parse(storedLogs);
      }
    } catch (e) {
      console.warn('Failed to load logs from localStorage');
    }

    // Initialize logger
    this.info('Logger initialized', { sessionId: this.sessionId });
  }

  private write(level: string, message: string, data?: any) {
    const timestamp = new Date().toISOString();
    const entry: LogEntry = { timestamp, level, message };
    
    if (data !== undefined) {
      if (typeof data === 'object') {
        try {
          entry.data = JSON.parse(JSON.stringify(data));
        } catch (error) {
          entry.data = '[Error stringifying data]';
        }
      } else {
        entry.data = String(data);
      }
    }

    // Add to logs array
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift(); // Remove oldest log
    }

    // Format and log to console
    const logMessage = `[${timestamp}] [${level}] [${this.sessionId}] ${message}${
      data !== undefined ? '\n' + JSON.stringify(data, null, 2) : ''
    }`;
    switch (level) {
      case 'ERROR':
        console.error(logMessage);
        break;
      case 'WARN':
        console.warn(logMessage);
        break;
      case 'DEBUG':
        console.debug(logMessage);
        break;
      default:
        console.log(logMessage);
    }

    // Save to localStorage
    try {
      localStorage.setItem('app_logs', JSON.stringify(this.logs));
    } catch (e) {
      console.warn('Failed to save logs to localStorage');
    }
  }

  error(message: string, error?: unknown) {
    let errorData: Record<string, unknown> = {};
    
    if (error instanceof Error) {
      errorData = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };

      // Add Anthropic API error details if available
      const anthropicError = (error as any).error;
      if (anthropicError && typeof anthropicError === 'object') {
        errorData.anthropicError = anthropicError;
      }

      // Add response data if available
      const response = (error as any).response;
      if (response && typeof response === 'object' && 'data' in response) {
        errorData.responseData = response.data;
      }
    } else if (error !== undefined) {
      errorData = { error };
    }

    this.write('ERROR', message, errorData);
  }

  debug(message: string, data?: unknown) {
    this.write('DEBUG', message, data);
  }

  warn(message: string, data?: unknown) {
    this.write('WARN', message, data);
  }

  info(message: string, data?: unknown) {
    this.write('INFO', message, data);
  }

  // Get all logs
  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  // Clear logs
  clearLogs(): void {
    this.logs = [];
    try {
      localStorage.removeItem('app_logs');
    } catch (e) {
      console.warn('Failed to clear logs from localStorage');
    }
  }

  // Download logs as JSON file
  downloadLogs(): void {
    const blob = new Blob([JSON.stringify(this.logs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `app-logs-${new Date().toISOString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

export const logger = new Logger();
