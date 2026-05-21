import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';

// dlp.ts dynamic-imports `@google-cloud/dlp`. The mock returns a stable module
// shape; per-test behaviour lives in `h`, which the class reads at call time.
const h = vi.hoisted(() => ({
  deidentify: vi.fn(),
  ctorCount: 0,
  ctorThrows: false,
}));

vi.mock('@google-cloud/dlp', () => {
  const DlpServiceClient = class {
    constructor() {
      h.ctorCount++;
      if (h.ctorThrows) throw new Error('client init failed');
    }
    deidentifyContent(req: unknown) {
      return h.deidentify(req);
    }
  };
  // dlp.ts reads `mod.default?.DlpServiceClient` — vitest's strict mock throws
  // unless a `default` export is present, so expose the SDK both ways.
  return { DlpServiceClient, default: { DlpServiceClient } };
});

// dlp.ts captures GOOGLE_CLOUD_PROJECT into a module-level const at import
// time, so every scenario re-imports the module with a fresh env.
async function importFresh() {
  vi.resetModules();
  return import('./dlp.js');
}

describe('redactPii', () => {
  beforeEach(() => {
    h.deidentify = vi.fn();
    h.ctorCount = 0;
    h.ctorThrows = false;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('returns input unchanged when GOOGLE_CLOUD_PROJECT is unset', async () => {
    vi.stubEnv('GOOGLE_CLOUD_PROJECT', '');
    const { redactPii } = await importFresh();

    expect(await redactPii('reach me at user@example.com')).toBe('reach me at user@example.com');
    expect(h.ctorCount).toBe(0);
  });

  it('returns empty input unchanged without touching the SDK', async () => {
    vi.stubEnv('GOOGLE_CLOUD_PROJECT', 'test-project');
    const { redactPii } = await importFresh();

    expect(await redactPii('')).toBe('');
    expect(h.ctorCount).toBe(0);
  });

  it('redacts via Cloud DLP when project + SDK are available', async () => {
    vi.stubEnv('GOOGLE_CLOUD_PROJECT', 'test-project');
    h.deidentify.mockResolvedValue([{ item: { value: 'reach me at [EMAIL_ADDRESS]' } }]);
    const { redactPii } = await importFresh();

    const out = await redactPii('reach me at alice@example.com');

    expect(out).toBe('reach me at [EMAIL_ADDRESS]');
    expect(h.deidentify).toHaveBeenCalledOnce();
    const req = h.deidentify.mock.calls[0]?.[0] as {
      parent: string;
      inspectConfig: { infoTypes: { name: string }[] };
      item: { value: string };
    };
    expect(req.parent).toBe('projects/test-project/locations/global');
    expect(req.item.value).toBe('reach me at alice@example.com');
    expect(req.inspectConfig.infoTypes).toEqual(
      expect.arrayContaining([{ name: 'EMAIL_ADDRESS' }]),
    );
  });

  it('falls back to input when the DLP response carries no item value', async () => {
    vi.stubEnv('GOOGLE_CLOUD_PROJECT', 'p');
    h.deidentify.mockResolvedValue([{}]);
    const { redactPii } = await importFresh();

    expect(await redactPii('keep this exact text')).toBe('keep this exact text');
  });

  it('falls back to input when the DLP client fails to initialise', async () => {
    vi.stubEnv('GOOGLE_CLOUD_PROJECT', 'p');
    h.ctorThrows = true;
    const { redactPii } = await importFresh();

    expect(await redactPii('user@example.com')).toBe('user@example.com');
  });

  it('constructs the DLP client once and caches it across calls', async () => {
    vi.stubEnv('GOOGLE_CLOUD_PROJECT', 'p');
    h.deidentify.mockResolvedValue([{ item: { value: 'x' } }]);
    const { redactPii } = await importFresh();

    await redactPii('first');
    await redactPii('second');

    expect(h.ctorCount).toBe(1);
    expect(h.deidentify).toHaveBeenCalledTimes(2);
  });

  it('resetDlpClient forces the client to be rebuilt', async () => {
    vi.stubEnv('GOOGLE_CLOUD_PROJECT', 'p');
    h.deidentify.mockResolvedValue([{ item: { value: 'x' } }]);
    const { redactPii, resetDlpClient } = await importFresh();

    await redactPii('first');
    resetDlpClient();
    await redactPii('second');

    expect(h.ctorCount).toBe(2);
  });
});
