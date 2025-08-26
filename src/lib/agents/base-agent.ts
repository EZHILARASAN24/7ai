export interface AgentMessage {
  id: string;
  type: string;
  from: string;
  to: string;
  payload: any;
  timestamp: string;
}

export interface AgentCapabilities {
  search: boolean;
  processing: boolean;
  safety: boolean;
  specialized: string[];
}

export abstract class BaseAgent {
  protected id: string;
  protected type: string;
  protected capabilities: AgentCapabilities;
  protected status: 'idle' | 'busy' | 'error';
  protected messageQueue: AgentMessage[];
  protected eventHandlers: Map<string, ((data: any) => void)[]>;

  constructor(id: string, type: string, capabilities: AgentCapabilities) {
    this.id = id;
    this.type = type;
    this.capabilities = capabilities;
    this.status = 'idle';
    this.messageQueue = [];
    this.eventHandlers = new Map();
  }

  abstract initialize(): Promise<void>;
  abstract processMessage(message: AgentMessage): Promise<any>;
  abstract shutdown(): Promise<void>;

  getId(): string {
    return this.id;
  }

  getType(): string {
    return this.type;
  }

  getCapabilities(): AgentCapabilities {
    return this.capabilities;
  }

  getStatus(): string {
    return this.status;
  }

  setStatus(status: 'idle' | 'busy' | 'error'): void {
    this.status = status;
    this.emit('statusChanged', { status });
  }

  async sendMessage(to: string, type: string, payload: any): Promise<string> {
    const message: AgentMessage = {
      id: this.generateMessageId(),
      type,
      from: this.id,
      to,
      payload,
      timestamp: new Date().toISOString()
    };

    this.messageQueue.push(message);
    this.emit('messageSent', message);
    
    return message.id;
  }

  async receiveMessage(message: AgentMessage): Promise<void> {
    if (message.to !== this.id) {
      throw new Error(`Message addressed to ${message.to}, but this agent is ${this.id}`);
    }

    this.messageQueue.push(message);
    this.emit('messageReceived', message);
    
    // Process the message
    await this.processMessage(message);
  }

  protected generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Event system for agent communication
  on(event: string, handler: (data: any) => void): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  off(event: string, handler: (data: any) => void): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  protected emit(event: string, data: any): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
        }
      });
    }
  }

  // Helper methods for common operations
  protected async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  protected log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    const timestamp = new Date().toISOString();
    console[level](`[${timestamp}] [${this.type}:${this.id}] ${message}`);
  }

  // Validation helpers
  protected validatePayload(payload: any, requiredFields: string[]): boolean {
    for (const field of requiredFields) {
      if (!(field in payload)) {
        this.log(`Missing required field: ${field}`, 'error');
        return false;
      }
    }
    return true;
  }

  protected sanitizeInput(input: string): string {
    // Basic input sanitization
    return input
      .replace(/[<>]/g, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .trim();
  }
}