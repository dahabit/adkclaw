export interface CronJob {
  id: string;
  name: string | null;
  scheduleKind: 'cron';
  schedule: string;
  task: string;
  sessionKey: string;
  channel: string | null;
  target: string | null;
  enabled: boolean;
  idempotencyKey: string | null;
  createdAt: number;
  updatedAt: number;
  lastRunAt: number | null;
  nextRunAt: number | null;
}

export interface CronJobInput {
  id?: string;
  name?: string;
  schedule: string;
  task: string;
  sessionKey: string;
  channel?: string | null;
  target?: string | null;
  idempotencyKey?: string | null;
}

export interface CronRun {
  id: number;
  jobId: string;
  firedAt: number;
  completedAt: number | null;
  status: 'pending' | 'success' | 'failed' | 'skipped';
  result: string | null;
  error: string | null;
  idempotencyKey: string | null;
}

export type DeliveryFn = (channel: string, target: string, text: string) => Promise<void>;
