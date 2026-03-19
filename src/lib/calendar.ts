import { google } from "googleapis";

// Google Calendar integration for Daniel & Daisy's calendars.
//
// Setup (one-time per person):
//   1. Go to /admin/google-auth to get the OAuth URL
//   2. Authenticate and copy the auth code
//   3. POST /api/admin/google-auth with { code } to exchange for tokens
//   4. Copy the refresh_token into your .env:
//      DANIEL_GOOGLE_REFRESH_TOKEN=...
//      DAISY_GOOGLE_REFRESH_TOKEN=...
//      DANIEL_GOOGLE_CALENDAR_ID=daniel@example.com
//      DAISY_GOOGLE_CALENDAR_ID=daisy@example.com
//      GOOGLE_CLIENT_ID=...
//      GOOGLE_CLIENT_SECRET=...

type Person = "daniel" | "daisy";

interface TimeSlot {
  start: string; // ISO datetime
  end: string;   // ISO datetime
  label: string; // Human-readable e.g. "Monday 9:00 – 10:00"
}

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/admin/google-auth/callback"
  );
}

function getRefreshToken(person: Person): string | undefined {
  return person === "daniel"
    ? process.env.DANIEL_GOOGLE_REFRESH_TOKEN
    : process.env.DAISY_GOOGLE_REFRESH_TOKEN;
}

function getCalendarId(person: Person): string {
  return (
    (person === "daniel"
      ? process.env.DANIEL_GOOGLE_CALENDAR_ID
      : process.env.DAISY_GOOGLE_CALENDAR_ID) ?? "primary"
  );
}

// Generate the OAuth URL for a person to authenticate
export function getGoogleAuthUrl(): string {
  const client = getOAuth2Client();
  return client.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/calendar.readonly"],
    prompt: "consent",
  });
}

// Exchange an auth code for tokens (returns refresh_token)
export async function exchangeGoogleCode(code: string): Promise<{ refresh_token: string; email?: string }> {
  const client = getOAuth2Client();
  const { tokens } = await client.getToken(code);
  return { refresh_token: tokens.refresh_token ?? "" };
}

// Get available time slots for a person on a given date range
export async function getCalendarAvailability(
  person: Person,
  dateFrom: string, // YYYY-MM-DD
  dateTo: string    // YYYY-MM-DD (inclusive)
): Promise<{ slots: TimeSlot[]; error?: string }> {
  const refreshToken = getRefreshToken(person);
  if (!refreshToken) {
    return {
      slots: [],
      error: `No Google Calendar credentials configured for ${person}. Ask them to authenticate at /admin/google-auth.`,
    };
  }

  try {
    const auth = getOAuth2Client();
    auth.setCredentials({ refresh_token: refreshToken });
    const calendar = google.calendar({ version: "v3", auth });

    const timeMin = new Date(`${dateFrom}T00:00:00`).toISOString();
    const timeMax = new Date(`${dateTo}T23:59:59`).toISOString();

    // Get busy periods via freebusy
    const freeBusyRes = await calendar.freebusy.query({
      requestBody: {
        timeMin,
        timeMax,
        items: [{ id: getCalendarId(person) }],
        timeZone: "Europe/Amsterdam",
      },
    });

    const busyPeriods = freeBusyRes.data.calendars?.[getCalendarId(person)]?.busy ?? [];

    // Generate candidate slots (9:00 – 17:00, 1-hour blocks, Mon–Fri)
    const slots = generateSlots(dateFrom, dateTo, busyPeriods as Array<{ start: string; end: string }>);

    return { slots };
  } catch (err) {
    return { slots: [], error: String(err) };
  }
}

function generateSlots(
  dateFrom: string,
  dateTo: string,
  busyPeriods: Array<{ start: string; end: string }>
): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const tz = "Europe/Amsterdam";

  let current = new Date(`${dateFrom}T00:00:00+01:00`);
  const end = new Date(`${dateTo}T23:59:59+01:00`);

  while (current <= end) {
    const dayOfWeek = current.getDay();
    // Skip weekends
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      // Try slots from 9:00 to 16:00 (1-hour slots)
      for (let hour = 9; hour < 17; hour++) {
        const slotStart = new Date(current);
        slotStart.setHours(hour, 0, 0, 0);
        const slotEnd = new Date(current);
        slotEnd.setHours(hour + 1, 0, 0, 0);

        // Check if slot overlaps any busy period
        const isBusy = busyPeriods.some((busy) => {
          const busyStart = new Date(busy.start);
          const busyEnd = new Date(busy.end);
          return slotStart < busyEnd && slotEnd > busyStart;
        });

        if (!isBusy) {
          const label = slotStart.toLocaleString("en-GB", {
            weekday: "long",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            timeZone: tz,
          }) + " – " + slotEnd.toLocaleString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: tz,
          });

          slots.push({
            start: slotStart.toISOString(),
            end: slotEnd.toISOString(),
            label,
          });
        }
      }
    }
    // Advance to next day
    current.setDate(current.getDate() + 1);
    current.setHours(0, 0, 0, 0);
  }

  return slots;
}

export function formatAvailability(person: Person, result: { slots: TimeSlot[]; error?: string }): string {
  if (result.error) return `Could not fetch ${person}'s calendar: ${result.error}`;
  if (result.slots.length === 0) return `${person} has no availability in that period.`;

  const lines = result.slots.slice(0, 10).map((s) => `- ${s.label}`);
  return `${person.charAt(0).toUpperCase() + person.slice(1)}'s available slots:\n${lines.join("\n")}${result.slots.length > 10 ? `\n...and ${result.slots.length - 10} more` : ""}`;
}
