import { useState, useMemo, useEffect, useRef, type SyntheticEvent } from "react";
import { trpc } from "@/lib/trpc";
import { useParams } from "wouter";
import {
  Loader2,
  Phone,
  Calendar,
  CheckCircle,
  Star,
  ShieldCheck,
  Clock,
  BadgeDollarSign,
  MapPin,
} from "lucide-react";
import LiveCounter from "@/components/estimate/LiveCounter";
import PackageCards from "@/components/estimate/PackageCards";
import UpsellMatrix from "@/components/estimate/UpsellMatrix";
import PlanModal from "@/components/estimate/PlanModal";
import { BOOKING_LINKS_BY_DURATION, buildBookingUrl } from "@shared/const";

// ── Hardcoded company config (backported from V4 bathtub-pros config) ──

const COMPANY = {
  name: "Bathtub Pros",
  phone: "(239) 307-7945",
  phoneDisplay: "(239) 307-7945",
  logoUrl: "https://lirp.cdn-website.com/fa4035d5/dms3rep/multi/opt/original-logos-small-640w.jpg",
  bookingLink: "https://app.squareup.com/appointments/buyer/widget/3za2737yf8u5y8/L09VQVGB6SQB7",
  websiteUrl: "https://www.bathtubpros.com",
  historicalTubBaseline: 11000,
  lastWarrantyClaimDate: null as string | null,
};

const TRUST_STRIP = [
  "5-Star Rated",
  "Serving Southwest Florida",
  "Owner On-Site Every Job",
];

const GREEN_CALLOUT = {
  heading: "What You Get With Us",
  items: [
    "Owner on-site every job",
    "\"Real\" warranty honored since 2013",
    "No runs, drips or sags — or we go back and fix",
    "11,000+ refinished tubs",
    "No upcharges or hidden fees ever",
    "Proud member of the Professional Bathtub Refinishers Association",
  ],
};

const STANDARD_PACKAGE = {
  name: "Standard",
  title: "Silver Package",
  warrantyLabel: "Three Year No Peel Warranty",
  features: [
    { title: "Professional Bathtub Refinishing", desc: "Complete refinishing with deep cleaning and surface prep." },
    { title: "Clean, Glossy White Finish", desc: "Like-new appearance with a durable, glossy coating." },
    { title: "Three Year No Peel Warranty", desc: "Solid coverage backed by the same team that's been doing this since 2013." },
  ],
};

const GOLD_PACKAGE = {
  name: "Gold",
  title: "Gold Package",
  subtitle: "Our most complete package — built for homeowners who want it done right the first time.",
  badge: "Recommended",
  features: [
    { title: "Everything in Silver Package", desc: "All the same professional refinishing, prep, and glossy finish." },
    { title: "Premium Coating System", desc: "Enhanced durability with an epoxy primer for ultimate adhesion." },
    { title: "Extended Finish Life", desc: "Built to last longer, especially in high-use and coastal environments." },
    { title: "Best for Beach Communities", desc: "Designed to hold up in high-humidity, salt-air environments." },
    { title: "Chip Repair & Anti-Slip Included", desc: "We repair chips and add safety texture — no extra charge." },
    { title: "Limited Lifetime No Peel Warranty", desc: "The strongest warranty we offer — your finish is protected for as long as you own the home." },
  ],
};

const BENEFITS = [
  { label: "Warranty Included", sub: "Every job covered" },
  { label: "Same-Day Done", sub: "In & out in one visit" },
  { label: "Save Thousands", sub: "vs. full replacement" },
  { label: "Local Experts", sub: "Southwest Florida" },
];

const TESTIMONIALS = [
  { quote: "I was skeptical at first but WOW. My tub looks brand new. The technician was professional, clean, and done in a few hours. Worth every penny.", author: "Sandra M." },
  { quote: "We had quotes for $4,000+ to replace the tub. They did it for a fraction of the cost and it looks just as good. Highly recommend.", author: "James T." },
  { quote: "On time, explained everything, and the finish is flawless. 5 stars without hesitation.", author: "Maria R." },
];

const TERMS_TEXT = "Images are stored for 90 days and may expire after this period, and this estimate is valid for 6 months from the date issued.";

// ── End config ──

type ServiceType = "bathtub" | "shower" | "jacuzzi" | "tub_tile";

const SERVICE_LABELS: Record<ServiceType, string> = {
  bathtub: "Tub Refinishing",
  shower: "Shower Refinishing",
  jacuzzi: "Jacuzzi / Soaking Tub Refinishing",
  tub_tile: "Tub & Tile Refinishing",
};

const BENEFIT_ICONS = [ShieldCheck, Clock, BadgeDollarSign, MapPin];

function deriveFirstName(estimate: {
  firstName?: string | null;
  name: string;
}): string {
  if (estimate.firstName) return estimate.firstName;
  const parts = estimate.name.split(",");
  if (parts.length >= 2) return parts[1].trim().split(" ")[0];
  return estimate.name.split(" ")[0];
}

function slugFromUrl(): string {
  const parts = window.location.pathname.split("/");
  const idx = parts.indexOf("estimate");
  return idx >= 0 && parts[idx + 1] ? parts[idx + 1] : "";
}

export default function EstimatePage({
  params,
}: {
  params?: { slug?: string };
}) {
  const routeParams = useParams<{ slug: string }>();
  const slug = params?.slug || routeParams.slug || slugFromUrl();

  const { data: estimate, isLoading, error } = trpc.estimates.bySlug.useQuery(
    { slug },
    { enabled: !!slug, retry: 2 }
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !estimate) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-center px-4">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          Estimate Not Found
        </h1>
        <p className="text-gray-500">
          This estimate link may have expired or been removed.
        </p>
      </div>
    );
  }

  return <EstimateView estimate={estimate} />;
}

function EstimateView({
  estimate,
}: {
  estimate: {
    id: number;
    slug: string;
    name: string;
    firstName: string | null;
    lastName: string | null;
    service: string;
    serviceType: string;
    duration: string | null;
    price: number;
    beforeUrl: string;
    afterUrl: string;
    transformationImageUrl: string | null;
    transformationPrice: number | null;
    bathroomSinkPrice: number | null;
    tileSurroundPrice: number | null;
    otherBathroomPrice: number | null;
    stripFee: number | null;
    bookingLink: string | null;
    calendarEmbed: string | null;
    email: string | null;
    companyLogoUrl: string | null;
    createdAt: Date;
  };
}) {
  const firstName = deriveFirstName(estimate);
  const serviceType = (estimate.serviceType || "bathtub") as ServiceType;
  const isRefinishing = ["bathtub", "shower", "jacuzzi", "tub_tile"].includes(serviceType);

  // Mark as viewed (first load only)
  const markViewed = trpc.estimates.markViewed.useMutation();
  const viewedRef = useRef(false);
  useEffect(() => {
    if (!viewedRef.current && estimate.slug) {
      viewedRef.current = true;
      markViewed.mutate({ slug: estimate.slug });
    }
  }, [estimate.slug]);

  // Package + upsell state
  const [selectedPackage, setSelectedPackage] = useState<"standard" | "gold" | null>(null);
  const [selectedUpsells, setSelectedUpsells] = useState<Record<string, boolean>>({});
  const [recommendedUpsells, setRecommendedUpsells] = useState<string[]>([]);
  const [planModalOpen, setPlanModalOpen] = useState(false);

  // Available upsell IDs (filtered by service type + price gates)
  const availableUpsellIds = useMemo(() => {
    const matrix: Record<string, string[]> = {
      bathtub: ["bathroomSink", "tileSurround"],
      tub_tile: ["bathroomSink"],
      shower: ["bathroomSink", "otherBathroom"],
      jacuzzi: ["bathroomSink"],
    };
    const allowed = matrix[serviceType] || [];
    const priceMap: Record<string, number | null> = {
      bathroomSink: estimate.bathroomSinkPrice,
      tileSurround: estimate.tileSurroundPrice,
      otherBathroom: estimate.otherBathroomPrice,
    };
    return allowed.filter((id) => {
      const p = priceMap[id];
      return p != null && p > 0;
    });
  }, [serviceType, estimate]);

  // Price calculation
  const totalPrice = useMemo(() => {
    let total = estimate.price;

    if (selectedPackage === "gold" && estimate.transformationPrice) {
      total = estimate.transformationPrice;
    }

    const priceMap: Record<string, number | null> = {
      bathroomSink: estimate.bathroomSinkPrice,
      tileSurround: estimate.tileSurroundPrice,
      otherBathroom: estimate.otherBathroomPrice,
    };
    for (const [id, checked] of Object.entries(selectedUpsells)) {
      if (checked && priceMap[id]) {
        total += priceMap[id]!;
      }
    }

    if (estimate.stripFee) {
      total += estimate.stripFee;
    }

    return total;
  }, [estimate, selectedPackage, selectedUpsells]);

  const serviceLabel = SERVICE_LABELS[serviceType] || SERVICE_LABELS.bathtub;

  const heroSubtitle = "Based on your bathroom, here's the transformation you can expect — no demo, no mess, done in one day.";

  const handleImgError = (e: SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    img.style.display = "none";
    const parent = img.parentElement;
    if (parent) {
      const fallback = document.createElement("div");
      fallback.className = "rounded-xl border border-gray-200 bg-gray-100 flex items-center justify-center py-12 text-gray-400 text-sm";
      fallback.textContent = "Photo not available";
      parent.appendChild(fallback);
    }
  };

  const handleToggleUpsell = (id: string) => {
    setSelectedUpsells((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handlePlanConfirm = (rec: { package: "standard" | "gold"; recommendedUpsells: string[] }) => {
    setSelectedPackage(rec.package);
    setRecommendedUpsells(rec.recommendedUpsells);
  };

  const handlePlanChooseForMyself = (rec: { package: "standard" | "gold"; recommendedUpsells: string[] }) => {
    setRecommendedUpsells(rec.recommendedUpsells);
  };

  if (!isRefinishing) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-center px-4">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          Estimate Not Found
        </h1>
        <p className="text-gray-500">
          This estimate link may have expired or been removed.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white font-sans max-w-lg mx-auto lg:max-w-2xl">

      {/* ── HEADER ── */}
      <header className="bg-gray-900 text-white py-3 px-4 flex items-center justify-between sticky top-0 z-50">
        <a href={COMPANY.websiteUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
          {(estimate.companyLogoUrl || COMPANY.logoUrl) ? (
            <img src={estimate.companyLogoUrl || COMPANY.logoUrl} alt={COMPANY.name} className="h-8 rounded" />
          ) : (
            <>
              <div className="bg-blue-600 text-white font-bold text-sm px-2 py-1 rounded">BP</div>
              <span className="font-semibold text-sm">{COMPANY.name}</span>
            </>
          )}
        </a>
        <a
          href={`tel:${COMPANY.phone}`}
          className="bg-green-500 hover:bg-green-600 text-white text-xs font-semibold px-3 py-2 rounded-full flex items-center gap-1 transition-colors"
        >
          <Phone className="h-3 w-3" />
          {COMPANY.phoneDisplay}
        </a>
      </header>

      {/* ── TRUST STRIP ── */}
      <div className="bg-gray-800 text-gray-300 text-[11px] leading-relaxed py-2 px-3 flex flex-col items-center gap-0.5 text-center sm:flex-row sm:justify-center sm:gap-4">
        {TRUST_STRIP.map((item, i) => (
          <span key={i} className={i === 0 ? "flex items-center gap-1" : ""}>
            {i === 0 && <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />}
            {item}
          </span>
        ))}
      </div>

      {/* ── HERO ── */}
      <section className="bg-gradient-to-b from-blue-50 to-white py-8 px-5 text-center">
        <p className="text-[10px] uppercase tracking-widest text-blue-600 font-semibold mb-1.5">
          Your Personalized Estimate
        </p>
        <h1 className="text-[22px] sm:text-2xl md:text-3xl font-extrabold text-gray-900 leading-tight mb-2">
          {firstName}, Here's What Your Tub Will Look Like
          <br />
          <span className="text-blue-600">— And Your Price</span>
        </h1>
        <p className="text-gray-500 text-sm leading-relaxed">
          {heroSubtitle}
        </p>
      </section>

      {/* ── SECTION 1: Before & After ── */}
      <section className="px-4 py-5">
        <h2 className="text-lg font-bold text-gray-900 text-center mb-3">
          Your Before & After
        </h2>
        <div className="space-y-3">
          {estimate.beforeUrl && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Before</p>
              <img
                src={estimate.beforeUrl}
                alt="Before"
                onError={handleImgError}
                className="rounded-lg border border-gray-200 w-full aspect-[4/3] object-contain bg-gray-100"
              />
            </div>
          )}
          {estimate.afterUrl && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">After</p>
              <img
                src={estimate.afterUrl}
                alt="After"
                onError={handleImgError}
                className="rounded-lg border border-gray-200 w-full aspect-[4/3] object-contain bg-gray-100"
              />
            </div>
          )}
        </div>

        {/* Transformation image */}
        {estimate.transformationImageUrl && (
          <div className="mt-4 space-y-1">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
              Full Transformation Preview
            </p>
            <img
              src={estimate.transformationImageUrl}
              alt="Transformation"
              onError={handleImgError}
              className="rounded-lg border border-gray-200 w-full aspect-[4/3] object-cover bg-gray-100"
            />
          </div>
        )}
      </section>

      {/* ── TRUST BAR ── */}
      {isRefinishing && (
        <section className="px-4 py-3">
          <div className="text-center space-y-1">
            <div className="flex items-center justify-center gap-1 text-sm text-gray-700">
              <div className="flex gap-0.5">
                {[1,2,3,4,5].map((i) => <Star key={i} className="h-3.5 w-3.5 text-yellow-400 fill-yellow-400" />)}
              </div>
              <span className="font-semibold ml-1">4.7 average</span>
              <span className="text-gray-400">·</span>
              <span>200+ five-star reviews</span>
              <span className="text-gray-400">·</span>
              <LiveCounter type="tubs" tubCount={null} baseline={COMPANY.historicalTubBaseline || 11000} />
            </div>
            <p className="text-xs text-gray-500">Locally owned and operated since 2013</p>
          </div>
        </section>
      )}

      {/* ── WARRANTY COUNTER BAND ── */}
      {isRefinishing && (
        <section className="px-4 py-3">
          <div className="bg-gray-900 text-white rounded-xl p-6">
            <LiveCounter
              type="warranty"
              lastClaimDate={COMPANY.lastWarrantyClaimDate || null}
              baseline={COMPANY.historicalTubBaseline || 11000}
            />
          </div>
        </section>
      )}

      {/* ── SECTION 2: Why It Matters ── */}
      <section className="px-4 py-5">
        <div className="rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200">
            <h2 className="font-semibold text-gray-800 text-sm">
              Why It Matters — Not All Refinishing Is Equal
            </h2>
          </div>
          <div className="p-4 bg-green-50">
            <p className="text-green-700 font-semibold text-sm mb-2 flex items-center gap-1.5">
              <CheckCircle className="h-4 w-4 shrink-0" /> {GREEN_CALLOUT.heading}
            </p>
            {GREEN_CALLOUT.items.map((item) => (
              <p key={item} className="text-[13px] leading-snug text-green-800 flex items-start gap-1.5 mb-1.5">
                <CheckCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-green-600" />
                {item}
              </p>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 3: Package Selection ── */}
      {isRefinishing && (
        <section className="px-4 py-5">
          <h2 className="text-lg font-bold text-gray-900 text-center mb-4">Choose Your Package</h2>
          <PackageCards
            estimate={{ price: estimate.price, transformationPrice: estimate.transformationPrice }}
            silverConfig={{
              name: "Silver",
              title: STANDARD_PACKAGE.title,
              warrantyHeadline: "3-Year Warranty",
              warrantySubline: "No-peel coverage on every job",
              features: STANDARD_PACKAGE.features,
            }}
            goldConfig={{
              name: GOLD_PACKAGE.name,
              title: GOLD_PACKAGE.title,
              badge: GOLD_PACKAGE.badge,
              warrantyHeadline: "LIFETIME WARRANTY",
              warrantySubline: "Protected against peeling for as long as you own the home",
              features: GOLD_PACKAGE.features,
            }}
            selectedPackage={selectedPackage}
            onSelectPackage={setSelectedPackage}
          />
        </section>
      )}

      {/* ── HELP ME CHOOSE + PLAN MODAL ── */}
      {isRefinishing && (
        <>
          <div className="px-4 pb-3 text-center">
            <button
              type="button"
              onClick={() => setPlanModalOpen(true)}
              className="text-sm text-blue-600 hover:text-blue-700 underline font-medium"
            >
              Help me choose my plan
            </button>
          </div>
          <PlanModal
            isOpen={planModalOpen}
            onClose={() => setPlanModalOpen(false)}
            onConfirm={handlePlanConfirm}
            onChooseForMyself={handlePlanChooseForMyself}
            availableUpsellIds={availableUpsellIds}
            silverPrice={estimate.price}
            goldPrice={estimate.transformationPrice}
          />
        </>
      )}

      {/* ── UPSELL MATRIX ── */}
      {isRefinishing && (
        <section className="px-4 py-5">
          <UpsellMatrix
            estimate={{
              bathroomSinkPrice: estimate.bathroomSinkPrice,
              tileSurroundPrice: estimate.tileSurroundPrice,
              otherBathroomPrice: estimate.otherBathroomPrice,
            }}
            serviceType={serviceType}
            selectedUpsells={selectedUpsells}
            onToggleUpsell={handleToggleUpsell}
            recommendedUpsells={recommendedUpsells}
          />
        </section>
      )}

      {/* ── RUNNING TOTAL + CTA ── */}
      <section className="px-4 py-4">
        <div className="bg-gray-900 text-white rounded-xl p-5 flex flex-col items-center gap-3 text-center">
          <div>
            <p className="text-[11px] text-gray-400 uppercase tracking-wider">
              Your Estimate Total
            </p>
            <p className="text-4xl font-extrabold">
              ${totalPrice.toLocaleString()}
            </p>
          </div>
          <BookingButton estimate={estimate} />
        </div>
      </section>

      {/* ── BENEFITS ── */}
      <section className="px-4 py-4">
        <div className="grid grid-cols-2 gap-2.5">
          {BENEFITS.map((b, i) => {
            const Icon = BENEFIT_ICONS[i] || ShieldCheck;
            return (
              <div
                key={b.label}
                className="bg-gray-50 border border-gray-200 rounded-lg py-3 px-2 text-center"
              >
                <Icon className="h-5 w-5 mx-auto mb-1 text-blue-600" />
                <p className="font-semibold text-gray-800 text-[13px]">{b.label}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">{b.sub}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="px-4 py-5">
        <h2 className="text-lg font-bold text-gray-900 text-center mb-3">
          What Customers Say
        </h2>
        <div className="space-y-3">
          {TESTIMONIALS.map((t) => (
            <blockquote
              key={t.author}
              className="bg-gray-50 border border-gray-200 rounded-xl p-3.5"
            >
              <div className="flex gap-0.5 mb-1.5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} className="h-3.5 w-3.5 text-yellow-400 fill-yellow-400" />
                ))}
              </div>
              <p className="text-[13px] leading-relaxed text-gray-700 italic mb-1.5">"{t.quote}"</p>
              <p className="text-[11px] text-gray-500 font-semibold">— {t.author}</p>
            </blockquote>
          ))}
        </div>
      </section>

      {/* ── EMBEDDED BOOKING CALENDAR ── */}
      <section id="booking-calendar" className="px-4 py-5">
        <div className="rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="bg-green-500 py-3 px-4 text-center">
            <h2 className="text-lg font-bold text-white flex items-center justify-center gap-2">
              <Calendar className="h-5 w-5" />
              Book My Appointment
            </h2>
            <p className="text-green-100 text-xs mt-0.5">Select a date and time that works for you</p>
          </div>
          {(BOOKING_LINKS_BY_DURATION[estimate.duration ?? ""] || estimate.bookingLink || COMPANY.bookingLink) ? (
            <div className="bg-white p-8 flex justify-center">
              <a
                href={buildBookingUrl(estimate.duration ?? "", { firstName: estimate.firstName, lastName: estimate.lastName, email: estimate.email, phone: (estimate as any).phone ?? null }, estimate.bookingLink || COMPANY.bookingLink || "#")}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 py-4 rounded-full text-base transition-colors shadow-md inline-block text-center"
              >
                Book My Appointment
              </a>
            </div>
          ) : (
            <div className="bg-white p-8 text-center text-gray-400 text-sm">
              Booking calendar not configured
            </div>
          )}
        </div>
      </section>

      {/* ── TERMS ── */}
      <section className="px-4 py-5">
        <p className="text-[11px] text-gray-400 text-center leading-relaxed">
          {TERMS_TEXT}
        </p>
      </section>
    </div>
  );
}

function BookingButton({
  estimate,
}: {
  estimate: {
    bookingLink: string | null;
    duration: string | null;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone?: string | null;
  };
}) {
  const bookingUrl = buildBookingUrl(
    estimate.duration ?? "",
    {
      firstName: estimate.firstName,
      lastName: estimate.lastName,
      email: estimate.email,
      phone: estimate.phone ?? null,
    },
    estimate.bookingLink || COMPANY.bookingLink,
  );
  if (!bookingUrl) return null;

  return (
    <a
      href={bookingUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-full text-base transition-colors shadow w-full text-center block cursor-pointer inline-block"
    >
      Book My Appointment
    </a>
  );
}
