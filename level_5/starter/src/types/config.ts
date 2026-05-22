export interface Config {
  server: {
    port: number;
    host: string;
  };
  paths: {
    workspace: string;
    database: string;
  };
  gemini: {
    apiKey: string;
    defaultModel: string;
    fallbackModel: string;
  };
  telegram: {
    botToken: string;
    allowedSenders: string[];
  };
  agent: {
    name: string;
    tone: string;
    traits: string[];
    maxToolRounds: number;
    compactionThreshold: number;
    heartbeatIntervalMs: number;
    timezone: string;
    dailyTokenBudget: number;
  };
  vertex: {
    project: string | null;
    region: string;
  };
}
