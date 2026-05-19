import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { spawn } from 'node:child_process';
import { audit } from './audit.js';

vi.mock('node:child_process');

describe('audit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('spawns the audit-security.ts script via tsx', async () => {
    const mockChild = {
      on: vi.fn((event, cb) => {
        if (event === 'exit') {
          cb(0);
        }
      }),
    };
    vi.mocked(spawn).mockReturnValue(mockChild as any);

    const code = await audit();
    expect(code).toBe(0);
    expect(spawn).toHaveBeenCalledWith(
      'npx',
      expect.arrayContaining(['tsx']),
      expect.objectContaining({ stdio: 'inherit' }),
    );
  });

  it('resolves to exit code from the spawned process', async () => {
    const mockChild = {
      on: vi.fn((event, cb) => {
        if (event === 'exit') {
          cb(42);
        }
      }),
    };
    vi.mocked(spawn).mockReturnValue(mockChild as any);

    const code = await audit();
    expect(code).toBe(42);
  });

  it('defaults to code 1 if exit code is null/undefined', async () => {
    const mockChild = {
      on: vi.fn((event, cb) => {
        if (event === 'exit') {
          cb(null);
        }
      }),
    };
    vi.mocked(spawn).mockReturnValue(mockChild as any);

    const code = await audit();
    expect(code).toBe(1);
  });

  it('passes stdio: inherit to preserve process output', async () => {
    const mockChild = {
      on: vi.fn((event, cb) => {
        if (event === 'exit') {
          cb(0);
        }
      }),
    };
    vi.mocked(spawn).mockReturnValue(mockChild as any);

    await audit();
    expect(spawn).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ stdio: 'inherit' }),
    );
  });

  it('resolves to a promise', () => {
    const mockChild = {
      on: vi.fn((event, cb) => {
        if (event === 'exit') {
          cb(0);
        }
      }),
    };
    vi.mocked(spawn).mockReturnValue(mockChild as any);

    const result = audit();
    expect(result).toBeInstanceOf(Promise);
  });
});
