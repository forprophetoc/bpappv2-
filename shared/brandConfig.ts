/**
 * Brand configuration — single source of truth for all customer-facing branding.
 *
 * Every customer-visible string (company name, phone, logo, trust copy,
 * testimonials, service area, etc.) MUST come from this config. No hardcoded
 * brand values anywhere else in the codebase.
 *
 * To onboard a new customer: provide a different BrandConfig object.
 * The Bathtub Pros config below is the default / first customer.
 */

export interface Testimonial {
  quote: string;
  author: string;
}

export interface BenefitItem {
  label: string;
  sub: string;
}

export interface BrandConfig {
  companyName: string;
  companyShortCode: string;
  phone: string;
  phoneTel: string;
  email?: string;
  website?: string;
  serviceArea: string;
  trustStat: string;
  trustTagline: string;
  warrantyLabel: string;
  warrantyDetail: string;
  heroTitle?: string;
  heroSubtext: string;
  basePrice?: number;
  planName?: string;
  ctaText?: string;
  comparisonTitle: string;
  comparisonUsLabel: string;
  comparisonUsPoints: string[];
  comparisonThemLabel: string;
  comparisonThemPoints: string[];
  benefits: BenefitItem[];
  testimonials: Testimonial[];
  footerPromo: string;
  calendarUrl: string;
  bookingWidgetUrl: string;
  bookingWidgetId: string;
  companyLogoUrl?: string;
}

/**
 * Bathtub Pros — default brand config (first customer).
 */
export const DEFAULT_BRAND: BrandConfig = {
  companyName: "Bathtub Pros",
  companyShortCode: "BP",
  phone: "239-307-7945",
  phoneTel: "2393077945",
  serviceArea: "Covering All of Southwest Florida & Barrier Islands",
  trustStat: "11,000+ Tubs Refinished",
  trustTagline: "Owner On-Site Every Job",
  warrantyLabel: "5-Year Warranty",
  warrantyDetail: "Every job covered",
  heroSubtext:
    "Based on your bathroom, here's the transformation you can expect — no demo, no mess, done in one day.",
  comparisonTitle: "Why It Matters — Not All Refinishing Is Equal",
  comparisonUsLabel: "The Bathtub Pros Way",
  comparisonUsPoints: [
    "Step 1 — Bonding Agent: Chemically bonds to surface",
    "Step 2 — Primer: Creates stable base layer (most skip this)",
    "Step 3 — Professional Topcoat: Durable, glossy, like-new finish",
    "Full 3-coat system = lasts 10-15 years",
    "5-Year Warranty, honored since 2013",
  ],
  comparisonThemLabel: "The Fly-By-Night Way",
  comparisonThemPoints: [
    "Bonding agent only — no primer",
    "Single topcoat over unstable surface",
    "Looks fine 1-2 years, then peels",
    "No warranty, or one they won't honor",
    "You end up paying twice",
  ],
  benefits: [
    { label: "5-Year Warranty", sub: "Every job covered" },
    { label: "Same-Day Done", sub: "In & out in one visit" },
    { label: "Save Thousands", sub: "vs. full replacement" },
    { label: "Local Experts", sub: "Naples - Ft Myers - CC" },
  ],
  testimonials: [
    {
      quote:
        "I was skeptical at first but WOW. My tub looks brand new. The technician was professional, clean, and done in a few hours. Worth every penny.",
      author: "Sandra M., Naples",
    },
    {
      quote:
        "We had quotes for $4,000+ to replace the tub. Bathtub Pros did it for a fraction of the cost and it looks just as good. Highly recommend.",
      author: "James T., Fort Myers",
    },
    {
      quote:
        "David was fantastic — on time, explained everything, and the finish is flawless. 5 stars without hesitation.",
      author: "Maria R., Cape Coral",
    },
  ],
  footerPromo:
    "5-Year Warranty - No mess, no demo - Same-day completion - 10% off for veterans & first responders",
  calendarUrl: "https://app.gohighlevel.com/calendar",
  bookingWidgetUrl:
    "https://api.leadconnectorhq.com/widget/booking/Pbt4MIKvOcDf1sLjqaMS",
  bookingWidgetId: "Pbt4MIKvOcDf1sLjqaMS_1744812926498",
};

/**
 * Active brand for this deployment.
 * Future: resolve dynamically based on tenant / subdomain / env var.
 */
export const brand: BrandConfig = DEFAULT_BRAND;
