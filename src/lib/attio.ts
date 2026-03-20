import type { AttioContact, AttioRecruitingEntry } from "@/types";

const ATTIO_BASE = "https://api.attio.com/v2";
const RECRUITING_LIST_SLUG = "recruiting";

function getApiKey(): string {
  const key = process.env.ATTIO_API_KEY;
  if (!key) throw new Error("ATTIO_API_KEY not configured");
  return key;
}

async function attioFetch(endpoint: string, options?: RequestInit) {
  const res = await fetch(`${ATTIO_BASE}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Attio API ${res.status}: ${text}`);
  }
  return res.json();
}

// Search contacts (people) by name or email
export async function searchAttioContacts(query: string): Promise<AttioContact[]> {
  const [nameResults, emailResults] = await Promise.allSettled([
    attioFetch("/objects/people/records/query", {
      method: "POST",
      body: JSON.stringify({ filter: { name: { $contains: query } }, limit: 20 }),
    }),
    attioFetch("/objects/people/records/query", {
      method: "POST",
      body: JSON.stringify({
        filter: { email_addresses: { email_address: { $contains: query } } },
        limit: 20,
      }),
    }),
  ]);

  // Merge + deduplicate
  const seen = new Set<string>();
  const records: AttioContact[] = [];
  for (const result of [nameResults, emailResults]) {
    if (result.status === "fulfilled") {
      for (const record of result.value.data ?? []) {
        const id = record.id?.record_id ?? record.id ?? "";
        if (!seen.has(id)) {
          seen.add(id);
          records.push(mapAttioRecord(record));
        }
      }
    }
  }

  return resolveCompanyNames(records);
}

// Get a single contact by record ID — includes company + recruiting entry
export async function getAttioContact(recordId: string): Promise<AttioContact | null> {
  try {
    const [personData, recruitingData] = await Promise.allSettled([
      attioFetch(`/objects/people/records/${recordId}`),
      attioFetch(`/lists/${RECRUITING_LIST_SLUG}/entries/query`, {
        method: "POST",
        body: JSON.stringify({
          filter: { parent_record_id: recordId },
          limit: 1,
        }),
      }),
    ]);

    if (personData.status !== "fulfilled") return null;
    const contact = mapAttioRecord(personData.value.data);

    // Resolve company name if we have a raw ID
    if (contact.companyId) {
      try {
        const companyData = await attioFetch(`/objects/companies/records/${contact.companyId}`);
        contact.company = companyData.data?.values?.name?.[0]?.value ?? contact.company;
      } catch { /* non-critical */ }
    }

    // Attach recruiting entry if found
    if (recruitingData.status === "fulfilled") {
      const entry = recruitingData.value.data?.[0];
      if (entry) contact.recruiting = mapRecruitingEntry(entry.entry_values ?? {});
    }

    return contact;
  } catch {
    return null;
  }
}

// Format a contact as a rich context block for the agent's system prompt
export function formatContactContext(contact: AttioContact): string {
  const lines: string[] = [`Name: ${contact.name}`];
  if (contact.email) lines.push(`Email: ${contact.email}`);
  if (contact.phone) lines.push(`Phone: ${contact.phone}`);
  if (contact.jobTitle) lines.push(`Current title: ${contact.jobTitle}`);
  if (contact.company) lines.push(`Current employer: ${contact.company}`);
  if (contact.notes) lines.push(`Notes: ${contact.notes}`);

  const r = contact.recruiting;
  if (r) {
    lines.push("\n--- Recruitment ---");
    if (r.stage) lines.push(`Stage: ${r.stage}`);
    if (r.applyingFor) lines.push(`Applying for: ${r.applyingFor}`);
    if (r.role) lines.push(`Role: ${r.role}`);
    if (r.roleLevel) lines.push(`Level: ${r.roleLevel}`);
    if (r.team) lines.push(`Team: ${r.team}`);
    if (r.hiringCompany) lines.push(`Hiring company: ${r.hiringCompany}`);
    if (r.manager) lines.push(`Manager: ${r.manager}`);
    if (r.employmentStatus) lines.push(`Employment type: ${r.employmentStatus}`);
    if (r.potentialStartDate) lines.push(`Potential start: ${r.potentialStartDate}`);
    if (r.interviewDate) lines.push(`Interview date: ${r.interviewDate}`);
    if (r.source) lines.push(`Source: ${[r.sourceType, r.source].filter(Boolean).join(" / ")}`);
  }

  return lines.join("\n");
}

// ── Private helpers ──────────────────────────────────────────────────────────

async function resolveCompanyNames(contacts: AttioContact[]): Promise<AttioContact[]> {
  const uuidPattern = /^[0-9a-f-]{36}$/i;
  const companyIds = Array.from(new Set(
    contacts.map((c) => c.companyId).filter((c): c is string => !!c && uuidPattern.test(c))
  ));

  if (companyIds.length === 0) return contacts;

  const companyMap = new Map<string, string>();
  await Promise.allSettled(
    companyIds.map(async (id) => {
      try {
        const data = await attioFetch(`/objects/companies/records/${id}`);
        const name = data.data?.values?.name?.[0]?.value;
        if (name) companyMap.set(id, name);
      } catch { /* skip */ }
    })
  );

  return contacts.map((c) => ({
    ...c,
    company: (c.companyId && companyMap.has(c.companyId))
      ? companyMap.get(c.companyId)
      : c.company,
  }));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapAttioRecord(record: any): AttioContact {
  if (!record) return { id: "", name: "Unknown" };
  const values = record.values ?? {};

  const nameObj = values.name?.[0];
  const name =
    nameObj?.full_name ||
    [nameObj?.first_name, nameObj?.last_name].filter(Boolean).join(" ") ||
    "Unknown";

  const email = values.email_addresses?.[0]?.email_address ?? undefined;
  const phone = values.phone_numbers?.[0]?.phone_number ?? undefined;
  const jobTitle = values.job_title?.[0]?.value ?? undefined;
  const notes = values.description?.[0]?.value ?? undefined;

  // Store raw company ID for resolution; name may be resolved later
  const companyEntry = values.company?.[0];
  const companyId = companyEntry?.target_record_id ?? undefined;

  return {
    id: record.id?.record_id ?? record.id ?? "",
    name,
    email,
    phone,
    jobTitle,
    companyId,
    company: companyId, // Will be overwritten after resolution
    notes,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRecruitingEntry(ev: any): AttioRecruitingEntry {
  return {
    stage: ev.stage?.[0]?.status?.title ?? undefined,
    applyingFor: ev.applying_for?.[0]?.option?.title ?? undefined,
    role: ev.role?.[0]?.value ?? undefined,
    roleLevel: ev.role_level?.[0]?.option?.title ?? undefined,
    team: ev.team?.[0]?.option?.title ?? undefined,
    manager: ev.manager?.[0]?.referenced_actor_id ?? undefined,
    employmentStatus: ev.employment_status?.[0]?.option?.title ?? undefined,
    potentialStartDate: ev.potential_start_date?.[0]?.value ?? undefined,
    sourceType: ev.source_type?.[0]?.option?.title ?? undefined,
    source: ev.source?.[0]?.option?.title ?? undefined,
    hiringCompany: ev.company_name?.[0]?.value ?? undefined,
    interviewDate: ev.interview_date?.[0]?.value ?? undefined,
  };
}
