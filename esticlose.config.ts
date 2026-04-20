/**
 * EstiClose Tier 1 — Local Configuration
 *
 * This file replaces ALL values that were previously read from GHL.
 * Every customer-facing field on the estimate page pulls from here.
 */

export const COMPANY = {
  name: "Bathtub Pros",
  phone: "(239) 307-7945",
  phoneDisplay: "(239) 307-7945",
  logoUrl: "https://lirp.cdn-website.com/fa4035d5/dms3rep/multi/opt/original-logos-small-640w.jpg",
  bookingLink: "https://api.leadconnectorhq.com/widget/booking/Ie1eUTKuBkr3kxbRoKRy",
  websiteUrl: "https://www.bathtubpros.com",
  supportEmail: "info@bathtubpros.com",
  serviceArea: "Southwest Florida",
  bathroomSinkPrice: 199,
  kitchenSinkPrice: 249,
  epoxyMaintenancePlanPrice: 199,
  epoxyUvClearCoatPrice: 349,
  /** Default prices per service (used as form defaults in New Estimate) */
  defaultPrices: {
    Tub: 299,
    Shower: 299,
    "Soaking Tub/Jacuzzi": 699,
    "Tub & Tile": 499,
    "Epoxy Flooring": 1499,
    "Cabinet Refinishing": 2999,
  } as Record<string, number>,
};

export const ESTIMATE_PAGE = {
  /** Header bar */
  headerBadge: "BP",
  headerTitle: "Bathtub Pros",

  /** Trust strip — short proof points shown below the header */
  trustStrip: [
    "5-Star Rated",
    "Serving Southwest Florida",
    "Owner On-Site Every Job",
  ],

  /** Hero subtitle */
  heroSubtitle:
    "Based on your bathroom, here's the transformation you can expect — no demo, no mess, done in one day.",

  /** Green callout — what YOUR company does right */
  greenCallout: {
    heading: "What You Get With Us",
    items: [
      "Owner on-site every job",
      "\"Real\" warranty honored since 2013",
      "No runs, drips or sags — or we go back and fix",
      "11,000+ refinished tubs",
      "No upcharges or hidden fees ever",
      "Proud member of the Professional Bathtub Refinishers Association",
    ],
  },

  /** Package labels */
  standardPackage: {
    name: "Standard",
    title: "Standard Package",
    warrantyLabel: "Three Year No Peel Warranty",
    features: [
      {
        title: "Professional Bathtub Refinishing",
        desc: "Complete refinishing with deep cleaning and surface prep.",
      },
      {
        title: "Clean, Glossy White Finish",
        desc: "Like-new appearance with a durable, glossy coating.",
      },
      {
        title: "Three Year No Peel Warranty",
        desc: "Solid coverage backed by the same team that's been doing this since 2013.",
      },
    ],
  },

  goldPackage: {
    name: "Gold",
    title: "Gold Package",
    subtitle: "Our most complete package — built for homeowners who want it done right the first time.",
    badge: "Recommended",
    features: [
      {
        title: "Everything in Standard Package",
        desc: "All the same professional refinishing, prep, and glossy finish.",
      },
      {
        title: "Premium Coating System",
        desc: "Enhanced durability with an epoxy primer for ultimate adhesion.",
      },
      {
        title: "Extended Finish Life",
        desc: "Built to last longer, especially in high-use and coastal environments.",
      },
      {
        title: "Best for Beach Communities",
        desc: "Designed to hold up in high-humidity, salt-air environments.",
      },
      {
        title: "Chip Repair & Anti-Slip Included",
        desc: "We repair chips and add safety texture — no extra charge.",
      },
      {
        title: "Limited Lifetime No Peel Warranty",
        desc: "The strongest warranty we offer — your finish is protected for as long as you own the home.",
      },
    ],
  },

  /** Benefits grid */
  benefits: [
    { label: "Warranty Included", sub: "Every job covered" },
    { label: "Same-Day Done", sub: "In & out in one visit" },
    { label: "Save Thousands", sub: "vs. full replacement" },
    { label: "Local Experts", sub: COMPANY.serviceArea },
  ],

  /** Testimonials */
  testimonials: [
    {
      quote:
        "I was skeptical at first but WOW. My tub looks brand new. The technician was professional, clean, and done in a few hours. Worth every penny.",
      author: "Sandra M.",
    },
    {
      quote:
        "We had quotes for $4,000+ to replace the tub. They did it for a fraction of the cost and it looks just as good. Highly recommend.",
      author: "James T.",
    },
    {
      quote:
        "On time, explained everything, and the finish is flawless. 5 stars without hesitation.",
      author: "Maria R.",
    },
  ],

  /** Bottom CTA section */
  ctaHeading: "Ready to Book?",
  ctaSubtext: "Book online or give us a call — we're ready when you are.",

  /** Terms text at the bottom of the estimate page */
  termsText:
    "Images are stored for 90 days and may expire after this period, and this estimate is valid for 6 months from the date issued.",

  /** Footer promo line */
  footerPromo:
    "No mess, no demo - Same-day completion - 10% off for veterans & first responders",
};

export const EPOXY_PAGE = {
  heroSubtitle:
    "Based on your space, here's the epoxy flooring transformation you can expect — professionally installed, built to last.",

  greenCallout: {
    heading: "What You Get With Us",
    items: [
      "Professional-grade coating system",
      "Clean, even flake finish in the color combo you choose",
      "Optional UV-protected clear coat for added durability",
      "Optional annual maintenance plan to keep it looking sharp",
    ],
  },

  redCallout: {
    heading: "Most Other Companies...",
    items: [
      "Rush the install and skip proper prep",
      "Use lower-grade coatings that wear out fast",
      "Offer finishes that fade, peel, or yellow",
      "Leave you with little protection after the job",
    ],
  },

  warrantyLabel: "Limited Warranty",

  baseColors: [
    { value: "light-gray", label: "Light Gray" },
    { value: "dark-gray", label: "Dark Gray" },
    { value: "tan", label: "Tan" },
    { value: "earth-tone", label: "Earth Tone" },
    { value: "custom", label: "Custom" },
  ],

  flakeColors: [
    { value: "domino", label: "Domino" },
    { value: "nightfall", label: "Nightfall" },
    { value: "creekbed", label: "Creekbed" },
    { value: "shoreline", label: "Shoreline" },
    { value: "wombat", label: "Wombat" },
  ],

  benefits: [
    { label: "Limited Warranty", sub: "Every job covered" },
    { label: "Professional Install", sub: "Done right the first time" },
    { label: "Save Thousands", sub: "vs. full replacement" },
    { label: "Local Experts", sub: COMPANY.serviceArea },
  ],

  testimonials: [
    {
      quote:
        "Our garage floor was cracked and stained for years. They came in, prepped everything properly, and now it looks like a showroom. Incredible transformation.",
      author: "Mike D.",
    },
    {
      quote:
        "We got quotes from three companies. These guys were the most thorough, explained the process, and the flake finish turned out better than we imagined.",
      author: "Karen L.",
    },
    {
      quote:
        "Professional from start to finish. The crew was clean, on time, and the floor coating is holding up perfectly after six months. Highly recommend.",
      author: "Jason R.",
    },
  ],

  headerBadge: "BP",
  headerTitle: "Bathtub Pros Epoxy",
};

export const CABINET_PAGE = {
  heroSubtitle:
    "Based on your kitchen, here's the cabinet transformation you can expect — no demo, no mess, professionally refinished.",

  greenCallout: {
    heading: "What You Get With Us",
    items: [
      "Smooth, factory-like cabinet finish",
      "Even, consistent color application",
      "Durable coating built for daily use",
      "Updated look without full replacement",
    ],
  },

  redCallout: {
    heading: "Most Other Companies...",
    items: [
      "Brush or roll finishes that leave visible texture",
      "Uneven color and inconsistent coverage",
      "Use lower-grade coatings that chip and wear",
      "Cut corners on prep for faster turnaround",
    ],
  },

  warrantyLabel: "Limited Warranty",

  benefits: [
    { label: "Limited Warranty", sub: "Every job covered" },
    { label: "Professional Spray", sub: "Factory-like finish" },
    { label: "Save Thousands", sub: "vs. full replacement" },
    { label: "Local Experts", sub: COMPANY.serviceArea },
  ],

  testimonials: [
    {
      quote:
        "We were quoted $15,000 to replace our cabinets. These guys refinished them for a fraction of the cost and they look brand new. Absolutely worth it.",
      author: "Lisa M.",
    },
    {
      quote:
        "The finish is incredibly smooth — you'd never know they weren't new cabinets. Professional crew, clean work, and done on time.",
      author: "David K.",
    },
    {
      quote:
        "We changed our mind on the color last minute and they handled it perfectly. The kitchen looks completely transformed. Highly recommend.",
      author: "Sarah T.",
    },
  ],

  headerBadge: "BP",
  headerTitle: "Bathtub Pros Cabinet Refinishing",
};

/**
 * SMS / Email templates for sending estimate links.
 * {{firstName}} and {{estimateUrl}} are replaced at runtime.
 */
export const MESSAGING = {
  smsTemplate: "Hi {{firstName}}, here is your estimate from {{companyName}}: {{estimateUrl}}",
  emailSubject: "Your {{companyName}} Estimate",
  emailBody: "Hi {{firstName}},\n\nHere is your personalized estimate from {{companyName}}:\n{{estimateUrl}}\n\nThank you!",
};
