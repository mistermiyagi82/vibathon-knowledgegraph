import type { AttioContact, AttioRecruitingEntry, AttioVacancy } from "@/types";

const ATTIO_BASE = "https://api.attio.com/v2";
const RECRUITING_LIST_SLUG = "recruiting";
const VACANCIES_OBJECT_SLUG = "vacancies";

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
        body: JSON.stringify({ limit: 500 }),
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

    // Attach recruiting entry if found — filter by parent_record_id client-side
    if (recruitingData.status === "fulfilled") {
      const entry = (recruitingData.value.data ?? []).find(
        (e: { parent_record_id: string }) => e.parent_record_id === recordId
      );
      if (entry) {
        const recruiting = mapRecruitingEntry(entry.entry_values ?? {});

        // Follow vacancy chain: recruiting entry → vacancy → company
        if (recruiting.vacancyId) {
          recruiting.vacancy = await resolveVacancy(recruiting.vacancyId);
        }

        contact.recruiting = recruiting;
      }
    }

    return contact;
  } catch {
    return null;
  }
}

// Stage pipeline — ordered list of all stages with their Attio status IDs
export const RECRUITING_STAGES = [
  { id: "046aec2e-7150-4810-a494-41b5969f8ed3", title: "New" },
  { id: "5852454e-68a4-444b-bfb1-79fd3959f104", title: "Screening by Daisy" },
  { id: "3b0416cf-aca1-45c9-bfe2-6351fffafeeb", title: "Proposed" },
  { id: "01cc90c3-96ea-47ec-b17a-f4f934620ce0", title: "Scheduling Interview" },
  { id: "1979590f-15ec-49d8-b978-531db42f9175", title: "Interview Planned" },
  { id: "f1809efd-4005-4548-820c-4c7037df00d9", title: "Final Interview Planned" },
  { id: "a4a089d3-10fc-4807-bcf1-bd987b203915", title: "Wait for feedback" },
  { id: "649d0f6a-e76d-4248-b5ab-d94711306354", title: "Hired" },
  { id: "26174821-f090-4abe-b340-03063423150a", title: "Rejected after Interview" },
  { id: "ae9761b6-cdc0-47d1-90de-afe70b080b68", title: "Rejected" },
  { id: "b06ee9e5-1f35-4c67-b065-ea71c97724a4", title: "Candidate dropped out" },
];

// Update a candidate's stage in the recruiting list
export async function updateCandidateStage(entryId: string, stageName: string): Promise<string> {
  const stage = RECRUITING_STAGES.find(
    (s) => s.title.toLowerCase() === stageName.toLowerCase()
  );
  if (!stage) {
    const names = RECRUITING_STAGES.map((s) => s.title).join(", ");
    return `Unknown stage "${stageName}". Available stages: ${names}`;
  }

  await attioFetch(`/lists/${RECRUITING_LIST_SLUG}/entries/${entryId}`, {
    method: "PATCH",
    body: JSON.stringify({
      data: {
        entry_values: {
          stage: [{ status: stage.id }],
        },
      },
    }),
  });

  return `Stage updated to "${stage.title}"`;
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
    if (r.employmentStatus) lines.push(`Employment type: ${r.employmentStatus}`);
    if (r.roleLevel) lines.push(`Level: ${r.roleLevel}`);
    if (r.team) lines.push(`Team: ${r.team}`);
    if (r.manager) lines.push(`Manager: ${r.manager}`);
    if (r.potentialStartDate) lines.push(`Potential start: ${r.potentialStartDate}`);
    if (r.interviewDate) lines.push(`Interview date: ${r.interviewDate}`);
    if (r.source) lines.push(`Source: ${[r.sourceType, r.source].filter(Boolean).join(" / ")}`);

    // Vacancy chain: role details + hiring company
    const v = r.vacancy;
    if (v) {
      lines.push("\n--- Vacancy ---");
      if (v.title) lines.push(`Role: ${v.title}`);
      if (v.status) lines.push(`Vacancy status: ${v.status}`);
      if (v.description) lines.push(`Description: ${v.description}`);
      if (v.requirements) lines.push(`Requirements: ${v.requirements}`);
      if (v.company) {
        lines.push("\n--- Hiring Company ---");
        lines.push(`Company: ${v.company}`);
        if (v.companyWebsite) lines.push(`Website: ${v.companyWebsite}`);
        if (v.companyDescription) lines.push(`About: ${v.companyDescription}`);
      }
    } else {
      // Fallback to legacy text fields
      if (r.applyingFor) lines.push(`Applying for: ${r.applyingFor}`);
      if (r.role) lines.push(`Role: ${r.role}`);
      if (r.hiringCompany) lines.push(`Hiring company: ${r.hiringCompany}`);
    }
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
    hiringCompany: ev.hiring_company?.[0]?.target_record_id ?? ev.company_name?.[0]?.value ?? undefined,
    interviewDate: ev.interview_date?.[0]?.value ?? undefined,
    // Linked vacancy record (resolved separately)
    vacancyId: ev.vacancy?.[0]?.target_record_id ?? undefined,
    entryId: ev.entry_id?.[0]?.value ?? undefined,
  };
}

async function resolveVacancy(vacancyId: string): Promise<AttioVacancy> {
  const vacancy: AttioVacancy = { id: vacancyId };
  try {
    const data = await attioFetch(`/objects/${VACANCIES_OBJECT_SLUG}/records/${vacancyId}`);
    const v = data.data?.values ?? {};
    vacancy.title = v.title?.[0]?.value ?? undefined;
    vacancy.description = v.description?.[0]?.value ?? undefined;
    vacancy.requirements = v.requirements?.[0]?.value ?? undefined;
    vacancy.status = v.status?.[0]?.option?.title ?? v.status?.[0]?.value ?? undefined;

    // Follow vacancy → company chain
    const companyId = v.company?.[0]?.target_record_id ?? undefined;
    if (companyId) {
      vacancy.companyId = companyId;
      try {
        const companyData = await attioFetch(`/objects/companies/records/${companyId}`);
        const cv = companyData.data?.values ?? {};
        vacancy.company = cv.name?.[0]?.value ?? undefined;
        vacancy.companyDescription = cv.description?.[0]?.value ?? undefined;
        vacancy.companyWebsite = cv.domains?.[0]?.domain ?? undefined;
      } catch { /* non-critical */ }
    }
  } catch { /* non-critical */ }
  return vacancy;
}
