import type { AttioContact } from "@/types";

const GRAPHITI_URL = process.env.GRAPHITI_URL ?? "http://localhost:8001";

export async function graphitiSearch(query: string, groupIds?: string[]): Promise<string> {
  const res = await fetch(`${GRAPHITI_URL}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, group_ids: groupIds, max_facts: 10 }),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`Graphiti search failed: ${res.status}`);
  const data = await res.json();
  const facts = data.facts as { fact: string; name: string; valid_at: string | null; invalid_at: string | null }[];
  if (!facts.length) return "No relevant graph facts found.";
  return facts
    .map((f) => {
      const validity = f.valid_at ? ` [since ${f.valid_at.slice(0, 10)}]` : "";
      const expired = f.invalid_at ? ` [expired ${f.invalid_at.slice(0, 10)}]` : "";
      return `• ${f.fact}${validity}${expired}`;
    })
    .join("\n");
}

export async function graphitiIngestEpisode(chatId: string, name: string, body: string): Promise<void> {
  await fetch(`${GRAPHITI_URL}/episodes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, episode_body: body, group_id: chatId, source: "message" }),
    signal: AbortSignal.timeout(3000),
  });
}

export async function graphitiHealthy(): Promise<boolean> {
  try {
    const res = await fetch(`${GRAPHITI_URL}/healthcheck`, { signal: AbortSignal.timeout(1000) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function graphitiIngestContact(chatId: string, contact: AttioContact): Promise<void> {
  // Episode 1: Candidate profile — always
  const profileParts: string[] = [
    `[Candidate Profile]`,
    `${contact.name} is a candidate in the recruiting pipeline.`,
  ];
  if (contact.email) profileParts.push(`Their email address is ${contact.email}.`);
  if (contact.phone) profileParts.push(`Their phone number is ${contact.phone}.`);
  if (contact.jobTitle && contact.company)
    profileParts.push(`They currently hold the title of ${contact.jobTitle} at ${contact.company}.`);
  else if (contact.jobTitle)
    profileParts.push(`Their current job title is ${contact.jobTitle}.`);
  else if (contact.company)
    profileParts.push(`They currently work at ${contact.company}.`);
  if (contact.notes) profileParts.push(`Additional notes: ${contact.notes}.`);

  await graphitiIngestEpisode(chatId, `profile-${contact.id}`, profileParts.join(" "));

  // Episode 2: Recruiting status — only if recruiting data exists
  const r = contact.recruiting;
  if (r) {
    const recruitingParts: string[] = [`[Recruiting Status]`];
    const stageText = r.stage ? `"${r.stage}"` : "an unknown stage";
    recruitingParts.push(`${contact.name} is currently at the ${stageText} stage of the recruiting process.`);
    if (r.employmentStatus)   recruitingParts.push(`The position type is ${r.employmentStatus}.`);
    if (r.roleLevel)          recruitingParts.push(`The role level is ${r.roleLevel}.`);
    if (r.team)               recruitingParts.push(`They are being considered for the ${r.team} team.`);
    if (r.manager)            recruitingParts.push(`The hiring manager is ${r.manager}.`);
    const sourceStr = [r.sourceType, r.source].filter(Boolean).join(" / ");
    if (sourceStr)            recruitingParts.push(`They were sourced via ${sourceStr}.`);
    if (r.potentialStartDate) recruitingParts.push(`Their potential start date is ${r.potentialStartDate}.`);
    if (r.interviewDate)      recruitingParts.push(`An interview is scheduled for ${r.interviewDate}.`);

    await graphitiIngestEpisode(chatId, `recruiting-${contact.id}`, recruitingParts.join(" "));

    // Episode 3: Vacancy details — structured vacancy preferred, legacy fallback
    const v = r.vacancy;
    if (v?.title || r.applyingFor || r.role) {
      const vacancyParts: string[] = [`[Vacancy]`];
      if (v?.title) {
        const statusSuffix = v.status ? ` (status: ${v.status})` : "";
        vacancyParts.push(`${contact.name} is applying for the role of ${v.title}${statusSuffix}.`);
        if (v.description)        vacancyParts.push(`Role description: ${v.description}.`);
        if (v.requirements)       vacancyParts.push(`Requirements: ${v.requirements}.`);
        if (v.company)            vacancyParts.push(`The hiring company is ${v.company}.`);
        if (v.companyDescription) vacancyParts.push(`About the company: ${v.companyDescription}.`);
        if (v.companyWebsite)     vacancyParts.push(`Company website: ${v.companyWebsite}.`);
      } else {
        const roleStr = r.applyingFor ?? r.role ?? "an unspecified role";
        vacancyParts.push(`${contact.name} is applying for ${roleStr}.`);
        if (r.hiringCompany) vacancyParts.push(`The hiring company is ${r.hiringCompany}.`);
      }
      await graphitiIngestEpisode(chatId, `vacancy-${contact.id}`, vacancyParts.join(" "));
    }
  }
}
