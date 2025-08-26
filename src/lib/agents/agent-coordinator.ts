import { BaseAgent, AgentMessage } from './base-agent';
import { SearchAgent } from './search-agent';

export interface AgentTask {
  id: string;
  type: string;
  payload: any;
  priority: 'low' | 'medium' | 'high' | 'critical';
  assignedAgent?: string;
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'failed';
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  result?: any;
  error?: string;
}

export class AgentCoordinator {
  private agents: Map<string, BaseAgent> = new Map();
  private taskQueue: AgentTask[] = [];
  private activeTasks: Map<string, AgentTask> = new Map();
  private isRunning: boolean = false;
  private taskProcessorInterval?: NodeJS.Timeout;

  constructor() {
    this.initializeDefaultAgents();
  }

  private initializeDefaultAgents(): void {
    // Create default search agent
    const searchAgent = new SearchAgent('search-agent-1');
    this.registerAgent(searchAgent);
  }

  async registerAgent(agent: BaseAgent): Promise<void> {
    try {
      await agent.initialize();
      this.agents.set(agent.getId(), agent);
      console.log(`Agent registered: ${agent.getType()} (${agent.getId()})`);
    } catch (error) {
      console.error(`Failed to register agent ${agent.getId()}:`, error);
      throw error;
    }
  }

  async unregisterAgent(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (agent) {
      await agent.shutdown();
      this.agents.delete(agentId);
      console.log(`Agent unregistered: ${agentId}`);
    }
  }

  async createTask(
    type: string,
    payload: any,
    priority: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ): Promise<string> {
    const task: AgentTask = {
      id: this.generateTaskId(),
      type,
      payload,
      priority,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    this.taskQueue.push(task);
    this.sortTaskQueue();
    
    console.log(`Task created: ${task.id} (${type}, ${priority} priority)`);
    return task.id;
  }

  async getTask(taskId: string): Promise<AgentTask | undefined> {
    // Check active tasks first
    const activeTask = this.activeTasks.get(taskId);
    if (activeTask) {
      return activeTask;
    }

    // Check task queue
    return this.taskQueue.find(task => task.id === taskId);
  }

  async getTasks(filter?: {
    status?: string;
    type?: string;
    agentId?: string;
  }): Promise<AgentTask[]> {
    let tasks = [...this.taskQueue, ...Array.from(this.activeTasks.values())];

    if (filter) {
      tasks = tasks.filter(task => {
        if (filter.status && task.status !== filter.status) return false;
        if (filter.type && task.type !== filter.type) return false;
        if (filter.agentId && task.assignedAgent !== filter.agentId) return false;
        return true;
      });
    }

    return tasks.sort((a, b) => {
      // Sort by priority and creation time
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('Agent coordinator is already running');
      return;
    }

    this.isRunning = true;
    console.log('Starting agent coordinator');

    // Start task processor
    this.taskProcessorInterval = setInterval(() => {
      this.processTaskQueue();
    }, 1000); // Process tasks every second

    // Set up agent event handlers
    this.setupAgentEventHandlers();
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.log('Agent coordinator is not running');
      return;
    }

    this.isRunning = false;
    
    if (this.taskProcessorInterval) {
      clearInterval(this.taskProcessorInterval);
      this.taskProcessorInterval = undefined;
    }

    console.log('Agent coordinator stopped');
  }

  private async processTaskQueue(): Promise<void> {
    if (this.taskQueue.length === 0) return;

    const task = this.taskQueue.shift();
    if (!task) return;

    // Find suitable agent for the task
    const agent = this.findSuitableAgent(task);
    if (!agent) {
      console.log(`No suitable agent found for task ${task.id}`);
      // Re-queue the task with lower priority
      if (task.priority !== 'low') {
        task.priority = 'low' as any;
        this.taskQueue.push(task);
      }
      return;
    }

    // Assign task to agent
    task.assignedAgent = agent.getId();
    task.status = 'assigned';
    task.startedAt = new Date().toISOString();
    this.activeTasks.set(task.id, task);

    console.log(`Task ${task.id} assigned to ${agent.getType()} (${agent.getId()})`);

    // Execute task
    try {
      const result = await this.executeTask(agent, task);
      
      task.status = 'completed';
      task.completedAt = new Date().toISOString();
      task.result = result;
      
      console.log(`Task ${task.id} completed successfully`);
    } catch (error) {
      task.status = 'failed';
      task.completedAt = new Date().toISOString();
      task.error = error instanceof Error ? error.message : String(error);
      
      console.error(`Task ${task.id} failed:`, error);
    }

    // Remove from active tasks
    this.activeTasks.delete(task.id);
  }

  private findSuitableAgent(task: AgentTask): BaseAgent | null {
    const availableAgents = Array.from(this.agents.values()).filter(agent => 
      agent.getStatus() === 'idle'
    );

    if (availableAgents.length === 0) {
      return null;
    }

    // Simple agent selection based on task type
    switch (task.type) {
      case 'search':
      case 'web-search':
      case 'vector-search':
      case 'hybrid-search':
        // Find search agent
        return availableAgents.find(agent => 
          agent.getType() === 'search-agent' && agent.getCapabilities().search
        ) || availableAgents[0];
      
      default:
        // Return first available agent
        return availableAgents[0];
    }
  }

  private async executeTask(agent: BaseAgent, task: AgentTask): Promise<any> {
    task.status = 'in_progress';
    agent.setStatus('busy');

    try {
      // Send message to agent
      const messageId = await agent.sendMessage(agent.getId(), task.type, task.payload);
      
      // Wait for agent to process the message
      // In a real implementation, this would be more sophisticated
      const result = await agent.processMessage({
        id: messageId,
        type: task.type,
        from: 'coordinator',
        to: agent.getId(),
        payload: task.payload,
        timestamp: new Date().toISOString()
      });

      return result;
    } finally {
      agent.setStatus('idle');
    }
  }

  private sortTaskQueue(): void {
    const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    
    this.taskQueue.sort((a, b) => {
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }

  private setupAgentEventHandlers(): void {
    // Set up event handlers for all agents
    this.agents.forEach(agent => {
      agent.on('statusChanged', (data) => {
        console.log(`Agent ${agent.getId()} status changed to ${data.status}`);
      });

      agent.on('messageSent', (message: AgentMessage) => {
        console.log(`Agent ${agent.getId()} sent message to ${message.to}`);
      });

      agent.on('messageReceived', (message: AgentMessage) => {
        console.log(`Agent ${agent.getId()} received message from ${message.from}`);
      });
    });
  }

  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async getStats(): Promise<{
    totalAgents: number;
    activeAgents: number;
    totalTasks: number;
    pendingTasks: number;
    activeTasks: number;
    completedTasks: number;
    failedTasks: number;
  }> {
    const allTasks = await this.getTasks();
    
    return {
      totalAgents: this.agents.size,
      activeAgents: Array.from(this.agents.values()).filter(agent => 
        agent.getStatus() === 'busy'
      ).length,
      totalTasks: allTasks.length,
      pendingTasks: allTasks.filter(task => task.status === 'pending').length,
      activeTasks: allTasks.filter(task => task.status === 'in_progress').length,
      completedTasks: allTasks.filter(task => task.status === 'completed').length,
      failedTasks: allTasks.filter(task => task.status === 'failed').length
    };
  }
}

// Global instance
export const agentCoordinator = new AgentCoordinator();