export const COOKIE_NAME = "app_session_id";
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = 'Please login (10001)';
export const NOT_ADMIN_ERR_MSG = 'You do not have required permission (10002)';

/**
 * Per-duration booking deep links.
 * Three GHL calendars, each with its own slot length (3hr / 5hr / 8hr).
 * All share availability through the same GHL team-member account.
 * Keyed by estimate.duration (values from DURATIONS in NewEstimate.tsx).
 * 4-hr rounds UP to 5-hr; 6-hr rounds UP to Full Day.
 */
export const BOOKING_LINKS_BY_DURATION: Record<string, string> = {
  "3 Hours": "https://calendar.bathtubpros.com",
  "4 Hours": "https://calendar.bathtubpros.com",
  "5 Hours": "https://calendar.bathtubpros.com",
  "6 Hours": "https://calendar.bathtubpros.com",
  "Full Day": "https://calendar.bathtubpros.com",
};

/**
 * Type for the subset of estimate fields needed to pre-fill the booking widget.
 */
export interface BookingPrefillInfo {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  service?: string | null;
  price?: number | null;
  beforeImage?: string | null;
  afterImage?: string | null;
}

/**
 * Build the booking URL for a given service type, with customer info appended
 * as query parameters so the calendar widget can pre-fill the form.
 * If no customer info is provided, returns the bare booking URL.
 *
 * Returns empty string if no booking URL is configured for the serviceType.
 */
export function buildBookingUrl(
  serviceType: string,
  info: BookingPrefillInfo = {},
  fallback?: string,
): string {
  const base = BOOKING_LINKS_BY_DURATION[serviceType] || fallback || "";
  if (!base) return "";

  const params = new URLSearchParams();
  if (info.service) params.set("service", info.service);
  if (info.price !== null && info.price !== undefined) params.set("price", String(info.price));
  if (info.firstName) params.set("firstName", info.firstName);
  if (info.lastName) params.set("lastName", info.lastName);
  if (info.email) params.set("email", info.email);
  if (info.phone) params.set("phone", info.phone);
  if (info.beforeImage) params.set("beforeImage", info.beforeImage);
  if (info.afterImage) params.set("afterImage", info.afterImage);

  const query = params.toString();
  return query ? `${base}?${query}` : base;
}
