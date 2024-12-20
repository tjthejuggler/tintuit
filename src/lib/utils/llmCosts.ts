interface CostEntry {
  timestamp: string;
  operation: string;
  model: string;
  tokens: number;
  cost: number;
}

// Claude-3 pricing (as of March 2024)
const CLAUDE_COSTS = {
  'claude-3-opus-20240229': {
    input: 0.015,  // per 1K tokens
    output: 0.075  // per 1K tokens
  },
  'claude-3-sonnet-20240229': {
    input: 0.003,  // per 1K tokens
    output: 0.015  // per 1K tokens
  },
  'claude-3-haiku-20240307': {
    input: 0.0015,  // per 1K tokens
    output: 0.0075  // per 1K tokens
  }
};

class LLMCostTracker {
  private costs: CostEntry[] = [];
  private storageKey = 'llm_costs';

  constructor() {
    this.loadCosts();
  }

  private loadCosts() {
    const stored = localStorage.getItem(this.storageKey);
    if (stored) {
      this.costs = JSON.parse(stored);
    }
  }

  private saveCosts() {
    localStorage.setItem(this.storageKey, JSON.stringify(this.costs));
  }

  trackCost(operation: string, model: string, inputTokens: number, outputTokens: number) {
    const modelCosts = CLAUDE_COSTS[model as keyof typeof CLAUDE_COSTS];
    if (!modelCosts) {
      console.warn(`Unknown model: ${model}`);
      return;
    }

    const inputCost = (inputTokens / 1000) * modelCosts.input;
    const outputCost = (outputTokens / 1000) * modelCosts.output;
    const totalCost = inputCost + outputCost;

    const entry: CostEntry = {
      timestamp: new Date().toISOString(),
      operation,
      model,
      tokens: inputTokens + outputTokens,
      cost: totalCost
    };

    this.costs.push(entry);
    this.saveCosts();

    return entry;
  }

  getTotalCost(): number {
    return this.costs.reduce((total, entry) => total + entry.cost, 0);
  }

  getCostsByOperation(): Record<string, number> {
    return this.costs.reduce((acc, entry) => {
      acc[entry.operation] = (acc[entry.operation] || 0) + entry.cost;
      return acc;
    }, {} as Record<string, number>);
  }

  getCostsByModel(): Record<string, number> {
    return this.costs.reduce((acc, entry) => {
      acc[entry.model] = (acc[entry.model] || 0) + entry.cost;
      return acc;
    }, {} as Record<string, number>);
  }

  getRecentCosts(days: number = 30): CostEntry[] {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return this.costs.filter(entry => new Date(entry.timestamp) >= cutoff);
  }

  clearCosts() {
    this.costs = [];
    this.saveCosts();
  }
}

export const llmCosts = new LLMCostTracker();
