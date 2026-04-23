import { useState, useMemo, useEffect, useRef, type SyntheticEvent } from "react";
import { trpc } from "@/lib/trpc";
import { useParams } from "wouter";
import { DEFAULT_BRAND, type BrandConfig } from "@shared/brandConfig";
import {
  Loader2,
  Phone,
  Calendar,
  CheckCircle,
  XCircle,
  Star,
  ShieldCheck,
  Clock,
  BadgeDollarSign,
  MapPin,
} from "lucide-react";

function proxyImg(url: string | undefined | null): string {
  if (!url) return "";
  const s3Prefix = "https://bathtub-pros-images.s3.us-east-2.amazonaws.com/";
  if (url.startsWith(s3Prefix)) {
    return "/api/images/" + url.slice(s3Prefix.length);
  }
  return url;
}

/** Client-side slug derivation — mirrors server/configWriter.ts companySlug() */
function toCompanySlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s]+/g, "-")
    .replace(/-{2,}/g, "-");
}

type ServiceType = "bathtub" | "shower" | "jacuzzi";

const SERVICE_LABELS: Record<ServiceType, string> = {
  bathtub: "Tub Refinishing",
  shower: "Shower Refinishing",
  jacuzzi: "Jacuzzi / Soaking Tub Refinishing",
};

function deriveFirstName(estimate: {
  firstName?: string | null;
  name: string;
}): string {
  if (estimate.firstName) return estimate.firstName;
  const parts = estimate.name.split(",");
  if (parts.length >= 2) return parts[1].trim().split(" ")[0];
  return estimate.name.split(" ")[0];
}

export default function EstimatePage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: estimate, isLoading, error } = trpc.estimates.bySlug.useQuery(
    { slug: slug ?? "" },
    { enabled: !!slug }
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
    price: number;
    beforeUrl: string;
    afterUrl: string;
    transformationImageUrl: string | null;
    transformationPrice: number | null;
    bathroomSinkPrice: number | null;
    kitchenSinkPrice: number | null;
    bookingLink: string | null;
    calendarEmbed: string | null;
    email: string | null;
    companyLogoUrl: string | null;
    companyName: string | null;
    createdAt: Date;
  };
}) {
  const firstName = deriveFirstName(estimate);
  const serviceType = (estimate.serviceType || "bathtub") as ServiceType;
  const isBathtub = serviceType === "bathtub";

  /* ── Load company config ── */
  const companySlug = estimate.companyName
    ? toCompanySlug(estimate.companyName)
    : null;

  const { data: rawConfig } = trpc.companies.bySlug.useQuery(
    { slug: companySlug! },
    { enabled: !!companySlug }
  );

  // Merge: loaded config → DEFAULT_BRAND fallback
  const cfg: BrandConfig = useMemo(() => {
    if (!rawConfig) return DEFAULT_BRAND;
    return { ...DEFAULT_BRAND, ...rawConfig };
  }, [rawConfig]);

  // Mark as viewed (first load only)
  const markViewed = trpc.estimates.markViewed.useMutation();
  const viewedRef = useRef(false);
  useEffect(() => {
    if (!viewedRef.current && estimate.slug) {
      viewedRef.current = true;
      markViewed.mutate({ slug: estimate.slug });
    }
  }, [estimate.slug]);

  // Sink upsell state
  const [selectedSinks, setSelectedSinks] = useState<{
    bathroom: boolean;
    kitchen: boolean;
  }>({ bathroom: false, kitchen: false });

  // Package state (bathtub only)
  const [selectedPackage, setSelectedPackage] = useState<
    "standard" | "transformation"
  >("standard");

  // Price calculation
  const totalPrice = useMemo(() => {
    let total = estimate.price;

    if (isBathtub && selectedPackage === "transformation" && estimate.transformationPrice) {
      total = estimate.price + estimate.transformationPrice;
    }

    if (selectedSinks.bathroom && estimate.bathroomSinkPrice) {
      total += estimate.bathroomSinkPrice;
    }
    if (selectedSinks.kitchen && estimate.kitchenSinkPrice) {
      total += estimate.kitchenSinkPrice;
    }

    return total;
  }, [estimate, selectedPackage, selectedSinks, isBathtub]);

  const serviceLabel = SERVICE_LABELS[serviceType] || SERVICE_LABELS.bathtub;

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

  // Resolve booking link: estimate-level → config-level → null
  const bookingLink = estimate.bookingLink || cfg.bookingWidgetUrl || null;

  // Derived branding values
  const trustLines = [cfg.trustStat, cfg.serviceArea, cfg.trustTagline].filter(Boolean);

  // These sections hide entirely if config has no real data — never show another brand's content
  const hasComparison = cfg.comparisonUsPoints.length > 0 && cfg.comparisonThemPoints.length > 0;
  const benefits = cfg.benefits.length > 0 ? cfg.benefits : [];
  const testimonials = cfg.testimonials.length > 0 ? cfg.testimonials : [];

  return (
    <div className="min-h-screen bg-white font-sans max-w-lg mx-auto lg:max-w-2xl">

      {/* ── HEADER ── */}
      <header className="bg-gray-900 text-white py-3 px-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          {cfg.companyLogoUrl ? (
            <img
              src={cfg.companyLogoUrl}
              alt={cfg.companyName}
              className="h-7 object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <div className="bg-blue-600 text-white font-bold text-sm px-2 py-1 rounded">
              {cfg.companyShortCode}
            </div>
          )}
          <span className="font-semibold text-sm">{cfg.companyName}</span>
        </div>
        <a
          href={`tel:${cfg.phoneTel}`}
          className="bg-green-500 hover:bg-green-600 text-white text-xs font-semibold px-3 py-2 rounded-full flex items-center gap-1 transition-colors"
        >
          <Phone className="h-3 w-3" />
          {cfg.phone}
        </a>
      </header>

      {/* ── TRUST STRIP ── */}
      {trustLines.length > 0 && (
        <div className="bg-gray-800 text-gray-300 text-[11px] leading-relaxed py-2 px-3 flex flex-col items-center gap-0.5 text-center sm:flex-row sm:justify-center sm:gap-4">
          {cfg.trustStat && (
            <span className="flex items-center gap-1">
              <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" /> {cfg.trustStat}
            </span>
          )}
          {cfg.serviceArea && <span>{cfg.serviceArea}</span>}
          {cfg.trustTagline && <span>{cfg.trustTagline}</span>}
        </div>
      )}

      {/* ── HERO ── */}
      <section className="bg-gradient-to-b from-blue-50 to-white py-8 px-5 text-center">
        <p className="text-[10px] uppercase tracking-widest text-blue-600 font-semibold mb-1.5">
          Your Personalized Estimate
        </p>
        <h1 className="text-[22px] sm:text-2xl md:text-3xl font-extrabold text-gray-900 leading-tight mb-2">
          {firstName}, Here's Your
          <br />
          <span className="text-blue-600">{serviceLabel} Quote</span>
        </h1>
        <p className="text-gray-500 text-sm leading-relaxed">
          {cfg.heroSubtext || DEFAULT_BRAND.heroSubtext}
        </p>
      </section>

      {/* ── SECTION 1: Before & After ── */}
      <section className="px-4 py-5">
        <h2 className="text-lg font-bold text-gray-900 text-center mb-3">
          Your Before & After
        </h2>
        <div className="space-y-3">
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
              Before
            </p>
            <img
              src={proxyImg(estimate.beforeUrl)}
              alt="Before"
              onError={handleImgError}
              className="rounded-lg border border-gray-200 w-full aspect-[4/3] object-cover bg-gray-100"
            />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
              After
            </p>
            <img
              src={proxyImg(estimate.afterUrl)}
              alt="After"
              onError={handleImgError}
              className="rounded-lg border border-gray-200 w-full aspect-[4/3] object-cover bg-gray-100"
            />
          </div>
        </div>

        {isBathtub && estimate.transformationImageUrl && (
          <div className="mt-3">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
              Full Transformation Preview
            </p>
            <img
              src={proxyImg(estimate.transformationImageUrl)}
              alt="Transformation"
              onError={handleImgError}
              className="rounded-lg border border-gray-200 w-full aspect-[4/3] object-cover bg-gray-100"
            />
          </div>
        )}
      </section>

      {/* ── SECTION 2: Why It Matters (Green / Red callouts) ── */}
      {hasComparison && (
        <section className="px-4 py-5">
          <div className="rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200">
              <h2 className="font-semibold text-gray-800 text-sm">
                {cfg.comparisonTitle || "Why It Matters"}
              </h2>
            </div>

            {/* Green callout */}
            <div className="p-4 bg-green-50">
              <p className="text-green-700 font-semibold text-sm mb-2 flex items-center gap-1.5">
                <CheckCircle className="h-4 w-4 shrink-0" /> {cfg.comparisonUsLabel || cfg.companyName}
              </p>
              {cfg.comparisonUsPoints.map((item) => (
                <p
                  key={item}
                  className="text-[13px] leading-snug text-green-800 flex items-start gap-1.5 mb-1.5"
                >
                  <CheckCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-green-600" />
                  {item}
                </p>
              ))}
            </div>

            <div className="border-t border-gray-200" />

            {/* Red callout */}
            <div className="p-4 bg-red-50">
              <p className="text-red-700 font-semibold text-sm mb-2 flex items-center gap-1.5">
                <XCircle className="h-4 w-4 shrink-0" /> {cfg.comparisonThemLabel || "Other Companies"}
              </p>
              {cfg.comparisonThemPoints.map((item) => (
                <p
                  key={item}
                  className="text-[13px] leading-snug text-red-800 flex items-start gap-1.5 mb-1.5"
                >
                  <XCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-red-500" />
                  {item}
                </p>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── SECTION 3: Package Selection (Bathtub Only) ── */}
      {isBathtub && (
        <section className="px-4 py-5">
          <h2 className="text-lg font-bold text-gray-900 text-center mb-4">
            Choose Your Package
          </h2>
          <div className="space-y-4 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">

            {/* Standard */}
            <button
              type="button"
              onClick={() => setSelectedPackage("standard")}
              className={`w-full rounded-xl border-2 shadow-sm p-4 flex flex-col text-left transition-all ${
                selectedPackage === "standard"
                  ? "border-gray-900 ring-2 ring-gray-900/10"
                  : "border-gray-200"
              }`}
            >
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-0.5">
                Standard
              </p>
              <h3 className="text-base font-bold text-gray-900 mb-1">
                Tub Refinishing Only
              </h3>
              <p className="text-3xl font-extrabold text-gray-900 mb-0.5">
                ${estimate.price.toLocaleString()}
              </p>
              <p className="text-[11px] text-gray-400 mb-3">
                Includes {cfg.warrantyLabel || DEFAULT_BRAND.warrantyLabel}
              </p>
              <ul className="text-[13px] text-gray-700 space-y-2.5 flex-1">
                {[
                  { title: "Includes Professional Chip Repairs & Surface Prep", desc: "We repair chips, cracks, and surface imperfections before refinishing to ensure a smooth, like-new finish." },
                  { title: "Anti-Slip Protection Included", desc: "Optional anti-slip texture is applied for added safety without compromising the clean, glossy look." },
                  { title: "Old Caulking Removed & Fresh Caulking Applied", desc: "We remove deteriorated caulking and professionally apply new, clean sealant for a finished, watertight result." },
                  { title: "Complete Refinishing System — All Included", desc: "No hidden add-ons. Everything needed for a full professional refinishing is included in one price." },
                  { title: `${cfg.warrantyLabel || DEFAULT_BRAND.warrantyLabel}`, desc: cfg.warrantyDetail || DEFAULT_BRAND.warrantyDetail },
                ].map((f) => (
                  <li key={f.title} className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-gray-900 text-[13px]">{f.title}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{f.desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
              {selectedPackage === "standard" && (
                <div className="mt-3 text-center text-sm font-semibold text-gray-900 py-1.5 bg-gray-100 rounded-lg">
                  ✓ Selected
                </div>
              )}
            </button>

            {/* Transformation */}
            <button
              type="button"
              onClick={() => setSelectedPackage("transformation")}
              className={`w-full rounded-xl border-2 shadow-md p-4 flex flex-col text-left relative transition-all mt-6 lg:mt-0 ${
                selectedPackage === "transformation"
                  ? "border-blue-600 ring-2 ring-blue-600/10"
                  : "border-gray-200"
              }`}
            >
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[11px] font-bold px-3 py-1 rounded-full whitespace-nowrap">
                Most Popular
              </span>
              <div className="flex items-start justify-between gap-3 mt-1">
                <div>
                  <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-0.5">
                    Premium
                  </p>
                  <h3 className="text-base font-bold text-gray-900 mb-1">
                    Tub & Tile Surround
                  </h3>
                </div>
                <img
                  src="/transformation.jpg"
                  alt="Completed tub and tile surround refinishing"
                  onError={handleImgError}
                  className="w-14 h-14 rounded-lg border border-gray-200 shadow-sm object-cover shrink-0"
                />
              </div>
              {estimate.transformationPrice != null ? (
                <p className="text-3xl font-extrabold text-blue-600 mb-0.5">
                  $
                  {(
                    estimate.price + estimate.transformationPrice
                  ).toLocaleString()}
                </p>
              ) : (
                <p className="text-sm font-semibold text-blue-400 mb-0.5">
                  Contact us for pricing
                </p>
              )}
              <p className="text-[11px] text-gray-400 mb-3">
                Complete the look — tub and tile surround together
              </p>
              <ul className="text-[13px] text-gray-700 space-y-2.5 flex-1">
                {[
                  { title: "Seamless Tub-and-Tile Appearance", desc: "The entire bathing area is refinished together for a clean, unified look." },
                  { title: "Brighter Walls That Match Your Tub", desc: "Tile surround is refreshed to complement the newly refinished tub." },
                  { title: "Grout Lines & Caulk Sealed Behind Coating", desc: "No more dirty grout lines — everything is sealed under the new finish." },
                  { title: "Full Bathing Area Transformed", desc: "Transforms tub, walls, and trim without demolition or replacement." },
                  { title: "Anti-Slip Protection Included", desc: "Optional anti-slip texture is applied for added safety without compromising the clean, glossy look." },
                  { title: `${cfg.warrantyLabel || DEFAULT_BRAND.warrantyLabel}`, desc: "Same warranty coverage across the full tub and tile surround." },
                ].map((f) => (
                  <li key={f.title} className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-gray-900 text-[13px]">{f.title}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{f.desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
              {selectedPackage === "transformation" && (
                <div className="mt-3 text-center text-sm font-semibold text-blue-600 py-1.5 bg-blue-50 rounded-lg">
                  ✓ Selected
                </div>
              )}
            </button>
          </div>
        </section>
      )}

      {/* ── SECTION 4: Sink Upsell ── */}
      {(estimate.bathroomSinkPrice || estimate.kitchenSinkPrice) && (
        <section className="px-4 py-5">
          <div className="rounded-xl border border-gray-200 shadow-sm p-4">
            <h2 className="text-base font-bold text-gray-900 mb-0.5">
              Don't leave your sink behind
            </h2>
            <p className="text-[13px] text-gray-500 mb-4">
              We can refinish your sink during the same visit so everything
              looks clean, consistent, and professionally finished.
            </p>

            <div className="space-y-3">
              {estimate.bathroomSinkPrice != null && (
                <label
                  className={`flex items-center justify-between gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    selectedSinks.bathroom
                      ? "border-blue-600 bg-blue-50"
                      : "border-gray-200"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <input
                      type="checkbox"
                      checked={selectedSinks.bathroom}
                      onChange={(e) =>
                        setSelectedSinks((s) => ({
                          ...s,
                          bathroom: e.target.checked,
                        }))
                      }
                      className="h-5 w-5 shrink-0 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900">
                        Bathroom Sink
                      </p>
                      <p className="text-[11px] text-gray-500">
                        Refinished to match during the same visit
                      </p>
                    </div>
                  </div>
                  <span className="text-base font-bold text-gray-900 shrink-0">
                    +${estimate.bathroomSinkPrice.toLocaleString()}
                  </span>
                </label>
              )}

              {estimate.kitchenSinkPrice != null && (
                <label
                  className={`flex items-center justify-between gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    selectedSinks.kitchen
                      ? "border-blue-600 bg-blue-50"
                      : "border-gray-200"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <input
                      type="checkbox"
                      checked={selectedSinks.kitchen}
                      onChange={(e) =>
                        setSelectedSinks((s) => ({
                          ...s,
                          kitchen: e.target.checked,
                        }))
                      }
                      className="h-5 w-5 shrink-0 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900">
                        Kitchen Sink
                      </p>
                      <p className="text-[11px] text-gray-500">
                        Refinished to match during the same visit
                      </p>
                    </div>
                  </div>
                  <span className="text-base font-bold text-gray-900 shrink-0">
                    +${estimate.kitchenSinkPrice.toLocaleString()}
                  </span>
                </label>
              )}
            </div>
          </div>
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
          <BookingButton bookingLink={bookingLink} phoneTel={cfg.phoneTel} />
        </div>
      </section>

      {/* ── BENEFITS ── */}
      {benefits.length > 0 && (
        <section className="px-4 py-4">
          <div className="grid grid-cols-2 gap-2.5">
            {benefits.map((b, i) => {
              const icons = [ShieldCheck, Clock, BadgeDollarSign, MapPin];
              const Icon = icons[i % icons.length];
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
      )}

      {/* ── TESTIMONIALS ── */}
      {testimonials.length > 0 && (
        <section className="px-4 py-5">
          <h2 className="text-lg font-bold text-gray-900 text-center mb-3">
            What Customers Say
          </h2>
          <div className="space-y-3">
            {testimonials.map((t) => (
              <blockquote
                key={t.author}
                className="bg-gray-50 border border-gray-200 rounded-xl p-3.5"
              >
                <div className="flex gap-0.5 mb-1.5">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star
                      key={i}
                      className="h-3.5 w-3.5 text-yellow-400 fill-yellow-400"
                    />
                  ))}
                </div>
                <p className="text-[13px] leading-relaxed text-gray-700 italic mb-1.5">"{t.quote}"</p>
                <p className="text-[11px] text-gray-500 font-semibold">
                  — {t.author}
                </p>
              </blockquote>
            ))}
          </div>
        </section>
      )}

      {/* ── BOOKING CTA ── */}
      <section className="bg-blue-600 text-white py-8 px-5 text-center">
        <h2 className="text-xl font-bold mb-1.5">Ready to Book?</h2>
        <p className="text-blue-100 text-[13px] mb-5">
          Book online or give us a call — we're ready when you are.
        </p>

        {bookingLink ? (
          <div className="flex flex-col items-stretch gap-3 mb-5 max-w-xs mx-auto">
            <a
              href={bookingLink}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 bg-white text-blue-700 font-bold py-3.5 rounded-full text-base hover:bg-blue-50 transition-colors shadow"
            >
              <Calendar className="h-4 w-4" />
              {(cfg as any).ctaText || "Book My Appointment"}
            </a>
            <a
              href={`tel:${cfg.phoneTel}`}
              className="flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white font-bold py-3.5 rounded-full text-base transition-colors shadow"
            >
              <Phone className="h-4 w-4" />
              {cfg.phone}
            </a>
          </div>
        ) : estimate.calendarEmbed ? (
          <div className="mb-5">
            <div
              className="bg-white rounded-xl overflow-hidden shadow-lg"
              dangerouslySetInnerHTML={{ __html: estimate.calendarEmbed }}
            />
          </div>
        ) : (
          <div className="flex flex-col items-stretch gap-3 mb-5 max-w-xs mx-auto">
            <a
              href={`tel:${cfg.phoneTel}`}
              className="flex items-center justify-center gap-2 bg-white text-blue-700 font-bold py-3.5 rounded-full text-base hover:bg-blue-50 transition-colors shadow"
            >
              <Phone className="h-4 w-4" />
              Call to Book: {cfg.phone}
            </a>
          </div>
        )}

        {cfg.footerPromo && (
          <p className="text-blue-200 text-[11px] leading-relaxed">
            {cfg.footerPromo}
          </p>
        )}
      </section>

      {/* ── TERMS ── */}
      <section className="px-4 py-5">
        <p className="text-[11px] text-gray-400 text-center leading-relaxed">
          Images are stored for 90 days and may expire after this period, and
          this estimate is valid for 6 months from the date issued.
        </p>
      </section>
    </div>
  );
}

function BookingButton({
  bookingLink,
  phoneTel,
}: {
  bookingLink: string | null;
  phoneTel: string;
}) {
  if (bookingLink) {
    return (
      <a
        href={bookingLink}
        target="_blank"
        rel="noreferrer"
        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-full text-base transition-colors shadow w-full text-center block"
      >
        Book Now
      </a>
    );
  }
  return (
    <a
      href={`tel:${phoneTel}`}
      className="bg-green-500 hover:bg-green-600 text-white font-bold py-3.5 rounded-full text-base transition-colors shadow flex items-center justify-center gap-2 w-full"
    >
      <Phone className="h-4 w-4" />
      Call Now
    </a>
  );
}
