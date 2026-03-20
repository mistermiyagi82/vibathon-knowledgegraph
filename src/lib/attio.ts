import type { AttioContact } from "@/types";

const ATTIO_BASE = "https://api.attio.com/v2";

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
  // Try name search and email search in parallel
  const [nameResults, emailResults] = await Promise.allSettled([
    attioFetch("/objects/people/records/query", {
      method: "POST",
      body: JSON.stringify({
        filter: { name: { $contains: query } },
        limit: 20,
      }),
    }),
    attioFetch("/objects/people/records/query", {
      method: "POST",
      body: JSON.stringify({
        filter: { email_addresses: { email_address: { $contains: query } } },
        limit: 20,
      }),
    }),
  ]);

  // Merge results, deduplicate by record_id
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

  // Resolve company names in parallel
  return resolveCompanyNames(records);
}

async function resolveCompanyNames(contacts: AttioContact[]): Promise<AttioContact[]> {
  // Collect unique company IDs that look like UUIDs (unresolved refs)
  const uuidPattern = /^[0-9a-f-]{36}$/i;
  const companyIds = Array.from(new Set(
    contacts.map((c) => c.company).filter((c): c is string => !!c && uuidPattern.test(c))
  ));

  if (companyIds.length === 0) return contacts;

  // Fetch all companies in parallel
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

  // Merge company names back
  return contacts.map((c) => ({
    ...c,
    company: (c.company && companyMap.has(c.company)) ? companyMap.get(c.company) : c.company,
  }));
}

// Get a single contact by record ID
export async function getAttioContact(recordId: string): Promise<AttioContact | null> {
  try {
    const data = await attioFetch(`/objects/people/records/${recordId}`);
    return mapAttioRecord(data.data);
  } catch {
    return null;
  }
}

// Get contact's company info
export async function getAttioCompany(companyId: string): Promise<{ name: string; domain?: string } | null> {
  try {
    const data = await attioFetch(`/objects/companies/records/${companyId}`);
    const values = data.data?.values ?? {};
    return {
      name: values.name?.[0]?.value ?? "Unknown",
      domain: values.domains?.[0]?.domain ?? undefined,
    };
  } catch {
    return null;
  }
}

// Format a contact as a rich context string for the system prompt injection
export function formatContactContext(contact: AttioContact): string {
  const lines: string[] = [
    `Name: ${contact.name}`,
  ];
  if (contact.email) lines.push(`Email: ${contact.email}`);
  if (contact.phone) lines.push(`Phone: ${contact.phone}`);
  if (contact.jobTitle) lines.push(`Title: ${contact.jobTitle}`);
  if (contact.company) lines.push(`Company: ${contact.company}`);
  if (contact.status) lines.push(`Recruitment status: ${contact.status}`);
  if (contact.notes) lines.push(`\nNotes:\n${contact.notes}`);
  return lines.join("\n");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapAttioRecord(record: any): AttioContact {
  if (!record) return { id: "", name: "Unknown" };
  const values = record.values ?? {};

  // Attio v2: name is stored as values.name[0].full_name (or first_name + last_name within same object)
  const nameObj = values.name?.[0];
  const name =
    nameObj?.full_name ||
    [nameObj?.first_name, nameObj?.last_name].filter(Boolean).join(" ") ||
    "Unknown";

  const email = values.email_addresses?.[0]?.email_address ?? undefined;
  const phone = values.phone_numbers?.[0]?.phone_number ?? undefined;
  const jobTitle = values.job_title?.[0]?.value ?? undefined;
  const notes = values.description?.[0]?.value ?? undefined;

  // Company: prefer the referenced record's name if available, otherwise skip UUID
  const companyEntry = values.company?.[0];
  const company = companyEntry?.target_record?.values?.name?.[0]?.value
    ?? companyEntry?.name
    ?? undefined;

  return {
    id: record.id?.record_id ?? record.id ?? "",
    name,
    email,
    phone,
    jobTitle,
    company,
    notes,
  };
}
