import { Prisma, PrismaClient } from '@prisma/client';

type SalebotLeadPayload = {
  client_phone: string;
  message: 'site_lead_new';
  resume_bot: boolean;

  source?: string;
  form_type?: string;
  external_lead_id?: string;
  service?: string;
  event_date?: string;
  event_time?: string;
  participants?: string;
  client_name?: string;
  contact_method?: string;
  comment?: string;
  page_url?: string;
  created_at?: string;
};

const DEFAULT_CALLBACK_URL =
  'https://chatter.salebot.pro/api/e18680292d435639749017466c45c09d/callback';

function formatDateDdMmYyyy(yyyyMmDd: string | null | undefined): string | undefined {
  if (!yyyyMmDd) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(yyyyMmDd.trim());
  if (!m) return undefined;
  return `${m[3]}.${m[2]}.${m[1]}`;
}

function formatDateTimeDdMmYyyyHhMm(dt: Date | null | undefined): string | undefined {
  if (!dt) return undefined;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(dt.getDate())}.${pad(dt.getMonth() + 1)}.${dt.getFullYear()} ${pad(dt.getHours())}:${pad(
    dt.getMinutes()
  )}`;
}

async function fetchJsonWithTimeout(url: string, payload: unknown, timeoutMs: number) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const text = await res.text().catch(() => '');
    return { ok: res.ok, status: res.status, bodyText: text };
  } finally {
    clearTimeout(t);
  }
}

function shouldRetry(status: number | null, err: unknown) {
  if (err) return true; // timeout / network error
  if (status == null) return true;
  if (status >= 500) return true;
  return false;
}

export async function sendSalebotLead(params: {
  prisma: PrismaClient;
  externalLeadId: string;
  leadType: 'BOOKING' | 'WORKSHOP_REQUEST';
  payload: Omit<SalebotLeadPayload, 'external_lead_id'>;
}) {
  if (process.env.SALEBOT_ENABLED === '0' || process.env.NODE_ENV === 'test') {
    return { skipped: true as const };
  }

  const callbackUrl = process.env.SALEBOT_CALLBACK_URL || DEFAULT_CALLBACK_URL;
  const maxAttempts = Math.max(1, Math.min(3, parseInt(String(process.env.SALEBOT_RETRY_ATTEMPTS || '3'), 10) || 3));
  const timeoutMs = Math.max(1000, parseInt(String(process.env.SALEBOT_TIMEOUT_MS || '8000'), 10) || 8000);

  const fullPayload: SalebotLeadPayload = {
    ...params.payload,
    external_lead_id: params.externalLeadId,
  };

  // Dedup: create a record first; if it already exists, skip sending.
  try {
    await params.prisma.salebotCallback.create({
      data: {
        externalLeadId: params.externalLeadId,
        leadType: params.leadType,
        requestBody: JSON.stringify(fullPayload),
        status: 'PENDING',
        attempts: 0,
      },
    });
  } catch (e: any) {
    const isUnique = e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
    if (isUnique) {
      console.info('salebot: duplicate skipped', { externalLeadId: params.externalLeadId, leadType: params.leadType });
      return { skipped: true as const };
    }
    console.error('salebot: failed to create dedup record', e);
    // If we can't persist dedup record, still avoid breaking user flow: do not send.
    return { skipped: true as const, error: 'dedup_record_create_failed' as const };
  }

  let lastError: unknown = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await params.prisma.salebotCallback.update({
      where: { externalLeadId: params.externalLeadId },
      data: { attempts: attempt, updatedAt: new Date() },
    });

    let status: number | null = null;
    let responseBody = '';
    try {
      const res = await fetchJsonWithTimeout(callbackUrl, fullPayload, timeoutMs);
      status = res.status;
      responseBody = res.bodyText;

      console.info('salebot: response', {
        externalLeadId: params.externalLeadId,
        attempt,
        status,
        responseBody,
      });

      await params.prisma.salebotCallback.update({
        where: { externalLeadId: params.externalLeadId },
        data: {
          httpStatus: status,
          responseBody,
          status: res.ok ? 'SENT' : status >= 400 && status < 500 ? 'FAILED' : 'PENDING',
          lastError: res.ok ? null : `HTTP ${status}`,
        },
      });

      if (res.ok) return { ok: true as const, status };
      if (status >= 400 && status < 500) {
        // no retry for 4xx
        return { ok: false as const, status, noRetry: true as const };
      }

      lastError = new Error(`HTTP ${status}`);
      if (!shouldRetry(status, null) || attempt === maxAttempts) break;
    } catch (err) {
      lastError = err;
      console.error('salebot: request error', { externalLeadId: params.externalLeadId, attempt, err });

      await params.prisma.salebotCallback.update({
        where: { externalLeadId: params.externalLeadId },
        data: {
          status: attempt === maxAttempts ? 'FAILED' : 'PENDING',
          lastError: err instanceof Error ? err.message : String(err),
        },
      });

      if (!shouldRetry(null, err) || attempt === maxAttempts) break;
    }

    // simple linear backoff: 300ms, 600ms
    if (attempt < maxAttempts) {
      const delayMs = 300 * attempt;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  await params.prisma.salebotCallback.update({
    where: { externalLeadId: params.externalLeadId },
    data: { status: 'FAILED', lastError: lastError instanceof Error ? lastError.message : String(lastError) },
  });
  return { ok: false as const, error: 'failed_after_retries' as const };
}

export function buildSalebotBookingPayload(args: {
  phone: string;
  source?: string;
  service?: string;
  eventDateYyyyMmDd?: string;
  eventTime?: string;
  participants?: number;
  clientName?: string;
  contactMethod?: string;
  comment?: string | null;
  pageUrl?: string | null;
  createdAt?: Date;
}) {
  return {
    client_phone: args.phone,
    message: 'site_lead_new' as const,
    resume_bot: true,
    source: args.source,
    form_type: 'calendar_booking',
    service: args.service,
    event_date: formatDateDdMmYyyy(args.eventDateYyyyMmDd),
    event_time: args.eventTime,
    participants: args.participants != null ? String(args.participants) : undefined,
    client_name: args.clientName,
    contact_method: args.contactMethod,
    comment: args.comment ?? undefined,
    page_url: args.pageUrl ?? undefined,
    created_at: formatDateTimeDdMmYyyyHhMm(args.createdAt),
  };
}

export function buildSalebotWorkshopRequestPayload(args: {
  phone: string;
  source?: string;
  service?: string;
  eventDateYyyyMmDd?: string;
  eventTime?: string;
  participants?: number;
  clientName?: string;
  contactMethod?: string;
  comment?: string | null;
  pageUrl?: string | null;
  createdAt?: Date;
}) {
  return {
    client_phone: args.phone,
    message: 'site_lead_new' as const,
    resume_bot: true,
    source: args.source,
    form_type: 'workshop_request',
    service: args.service,
    event_date: formatDateDdMmYyyy(args.eventDateYyyyMmDd),
    event_time: args.eventTime,
    participants: args.participants != null ? String(args.participants) : undefined,
    client_name: args.clientName,
    contact_method: args.contactMethod,
    comment: args.comment ?? undefined,
    page_url: args.pageUrl ?? undefined,
    created_at: formatDateTimeDdMmYyyyHhMm(args.createdAt),
  };
}

