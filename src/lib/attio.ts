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
  try {
    // Use Attio's search endpoint
    const data = await attioFetch("/objects/people/records/query", {
      method: "POST",
      body: JSON.stringify({
        filter: {
          name: { $contains: query },
        },
        limit: 20,
        sorts: [{ attribute: "name", field: "first_name", direction: "asc" }],
      }),
    });

    return (data.data ?? []).map(mapAttioRecord);
  } catch {
    // Try email search if name search fails
    try {
      const data = await attioFetch("/objects/people/records/query", {
        method: "POST",
        body: JSON.stringify({
          filter: {
            email_addresses: { email_address: { $contains: query } },
          },
          limit: 20,
        }),
      });
      return (data.data ?? []).map(mapAttioRecord);
    } catch {
      return [];
    }
  }
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

  const firstName = values.first_name?.[0]?.value ?? "";
  const lastName = values.last_name?.[0]?.value ?? "";
  const name = [firstName, lastName].filter(Boolean).join(" ") || "Unknown";

  const email = values.email_addresses?.[0]?.email_address ?? undefined;
  const phone = values.phone_numbers?.[0]?.phone_number ?? undefined;
  const jobTitle = values.job_title?.[0]?.value ?? undefined;
  const notes = values.description?.[0]?.value ?? undefined;

  // Company may be a linked record
  const companyRef = values.company?.[0]?.target_record_id ?? undefined;

  return {
    id: record.id?.record_id ?? record.id ?? "",
    name,
    email,
    phone,
    jobTitle,
    company: companyRef, // Will be resolved separately if needed
    notes,
  };
}
