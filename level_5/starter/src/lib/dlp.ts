/**
 * dlp.ts — Cloud DLP-backed PII redactor for the logger.
 *
 * Replaces the regex redactor from L4 with Google's Cloud DLP API. Knows
 * names, addresses, emails, phones, payment cards, government IDs, and
 * 100+ other infoTypes — anything regex can't reliably catch.
 *
 * Usage:
 *   - Set GOOGLE_CLOUD_PROJECT (DLP needs a project context)
 *   - Set LOG_REDACT=true to enable DLP at logger boundaries
 *   - Call redactPii(text) where you'd previously call the regex redactor
 *
 * Cost: ~$1 per 1000 inspection units (~10K chars / unit). Negligible at
 * workshop scale. For high-volume logging, batch + cache.
 *
 * If you want to stay regex-only, set LOG_REDACT=regex and use the L4 fallback.
 *
 * NOTE: this module dynamic-imports `@google-cloud/dlp` so the dependency is
 * optional — the daemon starts even when DLP isn't installed. redactPii returns
 * the input unchanged when the SDK is missing or PROJECT is unset.
 */

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT ?? '';

const INFO_TYPES = [
  { name: 'EMAIL_ADDRESS' },
  { name: 'PHONE_NUMBER' },
  { name: 'STREET_ADDRESS' },
  { name: 'PERSON_NAME' },
  { name: 'CREDIT_CARD_NUMBER' },
  { name: 'IP_ADDRESS' },
  { name: 'US_SOCIAL_SECURITY_NUMBER' },
  { name: 'IBAN_CODE' },
];

type DlpClient = {
  deidentifyContent(req: unknown): Promise<[{ item?: { value?: string } }]>;
};

let cachedClient: DlpClient | null | undefined;

async function getClient(): Promise<DlpClient | null> {
  if (cachedClient !== undefined) return cachedClient;
  if (!PROJECT) {
    cachedClient = null;
    return null;
  }
  try {
    const mod = (await import('@google-cloud/dlp')) as unknown as {
      default: { DlpServiceClient: new () => DlpClient };
      DlpServiceClient?: new () => DlpClient;
    };
    const Ctor = mod.default?.DlpServiceClient ?? mod.DlpServiceClient;
    if (!Ctor) {
      cachedClient = null;
      return null;
    }
    cachedClient = new Ctor();
    return cachedClient;
  } catch {
    cachedClient = null;
    return null;
  }
}

export async function redactPii(text: string): Promise<string> {
  if (!text) return text;
  const client = await getClient();
  if (!client) return text; // graceful degradation when SDK or project missing

  const [response] = await client.deidentifyContent({
    parent: `projects/${PROJECT}/locations/global`,
    deidentifyConfig: {
      infoTypeTransformations: {
        transformations: [{ primitiveTransformation: { replaceWithInfoTypeConfig: {} } }],
      },
    },
    inspectConfig: { infoTypes: INFO_TYPES, minLikelihood: 'POSSIBLE' },
    item: { value: text },
  });
  return response.item?.value ?? text;
}

/** Reset internal cache. Test-only. */
export function resetDlpClient(): void {
  cachedClient = undefined;
}
