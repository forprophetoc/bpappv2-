import { useState, useMemo, useEffect, useRef, type SyntheticEvent } from "react";
import { trpc } from "@/lib/trpc";
import { useParams } from "wouter";
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
import { COMPANY, ESTIMATE_PAGE, EPOXY_PAGE, CABINET_PAGE } from "../../../esticlose.config";

type ServiceType = "bathtub" | "shower" | "jacuzzi" | "epoxy" | "cabinet";

const SERVICE_LABELS: Record<ServiceType, string> = {
  bathtub: "Tub Refinishing",
  shower: "Shower Refinishing",
  jacuzzi: "Jacuzzi / Soaking Tub Refinishing",
  epoxy: "Epoxy Flooring",
  cabinet: "Cabinet Refinishing",
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
    baseColor: string | null;
    flakeColor: string | null;
    maintenancePlanPrice: number | null;
    uvClearCoatPrice: number | null;
    upperCabinetColor: string | null;
    lowerCabinetColor: string | null;
    softCloseHingeUpgrade: number | null;
    hardwareReplacement: number | null;
    hardwareUpgrade: number | null;
    bookingLink: string | null;
    calendarEmbed: string | null;
    email: string | null;
    companyLogoUrl: string | null;
    createdAt: Date;
  };
}) {
  const firstName = deriveFirstName(estimate);
  const serviceType = (estimate.serviceType || "bathtub") as ServiceType;
  const isBathtub = serviceType === "bathtub";
  const isEpoxy = serviceType === "epoxy";
  const isCabinet = serviceType === "cabinet";

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
    "standard" | "gold"
  >("standard");

  // Epoxy upsell state
  const [selectedEpoxyUpsells, setSelectedEpoxyUpsells] = useState<{
    maintenancePlan: boolean;
    uvClearCoat: boolean;
  }>({ maintenancePlan: false, uvClearCoat: false });

  // Cabinet upsell state
  const [selectedCabinetUpsells, setSelectedCabinetUpsells] = useState<{
    softCloseHinge: boolean;
    hardwareReplacement: boolean;
    hardwareUpgrade: boolean;
  }>({ softCloseHinge: false, hardwareReplacement: false, hardwareUpgrade: false });

  // Price calculation
  const totalPrice = useMemo(() => {
    let total = estimate.price;

    if (isBathtub && selectedPackage === "gold" && estimate.transformationPrice) {
      total = estimate.transformationPrice;
    }

    if (selectedSinks.bathroom && estimate.bathroomSinkPrice) {
      total += estimate.bathroomSinkPrice;
    }
    if (selectedSinks.kitchen && estimate.kitchenSinkPrice) {
      total += estimate.kitchenSinkPrice;
    }

    if (selectedEpoxyUpsells.maintenancePlan && estimate.maintenancePlanPrice) {
      total += estimate.maintenancePlanPrice;
    }
    if (selectedEpoxyUpsells.uvClearCoat && estimate.uvClearCoatPrice) {
      total += estimate.uvClearCoatPrice;
    }

    if (selectedCabinetUpsells.softCloseHinge && estimate.softCloseHingeUpgrade) {
      total += estimate.softCloseHingeUpgrade;
    }
    if (selectedCabinetUpsells.hardwareReplacement && estimate.hardwareReplacement) {
      total += estimate.hardwareReplacement;
    }
    if (selectedCabinetUpsells.hardwareUpgrade && estimate.hardwareUpgrade) {
      total += estimate.hardwareUpgrade;
    }

    return total;
  }, [estimate, selectedPackage, selectedSinks, selectedEpoxyUpsells, selectedCabinetUpsells, isBathtub]);

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

  return (
    <div className="min-h-screen bg-white font-sans max-w-lg mx-auto lg:max-w-2xl">

      {/* ── HEADER ── */}
      <header className="bg-gray-900 text-white py-3 px-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 text-white font-bold text-sm px-2 py-1 rounded">
            {isCabinet ? CABINET_PAGE.headerBadge : isEpoxy ? EPOXY_PAGE.headerBadge : ESTIMATE_PAGE.headerBadge}
          </div>
          <span className="font-semibold text-sm">{isCabinet ? CABINET_PAGE.headerTitle : isEpoxy ? EPOXY_PAGE.headerTitle : ESTIMATE_PAGE.headerTitle}</span>
        </div>
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
        {ESTIMATE_PAGE.trustStrip.map((item, i) => (
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
          {firstName}, Here's Your
          <br />
          <span className="text-blue-600">{serviceLabel} Quote</span>
        </h1>
        <p className="text-gray-500 text-sm leading-relaxed">
          {isCabinet ? CABINET_PAGE.heroSubtitle : isEpoxy ? EPOXY_PAGE.heroSubtitle : ESTIMATE_PAGE.heroSubtitle}
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
              src={estimate.beforeUrl}
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
              src={estimate.afterUrl}
              alt="After"
              onError={handleImgError}
              className="rounded-lg border border-gray-200 w-full aspect-[4/3] object-cover bg-gray-100"
            />
          </div>
        </div>

        {/* Epoxy color selections */}
        {isEpoxy && (estimate.baseColor || estimate.flakeColor) && (
          <div className="mt-4 grid grid-cols-2 gap-3">
            {estimate.baseColor && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Base Color</p>
                <p className="text-sm font-bold text-gray-900 capitalize">{estimate.baseColor.replace("-", " ")}</p>
              </div>
            )}
            {estimate.flakeColor && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Flake Color</p>
                <p className="text-sm font-bold text-gray-900 capitalize">{estimate.flakeColor.replace("-", " ")}</p>
              </div>
            )}
          </div>
        )}

        {/* Cabinet color selections */}
        {isCabinet && (estimate.upperCabinetColor || estimate.lowerCabinetColor) && (
          <div className="mt-4 grid grid-cols-2 gap-3">
            {estimate.upperCabinetColor && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Upper Cabinets</p>
                <p className="text-sm font-bold text-gray-900">{estimate.upperCabinetColor}</p>
              </div>
            )}
            {estimate.lowerCabinetColor && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Lower Cabinets</p>
                <p className="text-sm font-bold text-gray-900">{estimate.lowerCabinetColor}</p>
              </div>
            )}
          </div>
        )}

      </section>

      {/* ── SECTION 2: Why It Matters (Green / Red callouts) ── */}
      <section className="px-4 py-5">
        {(() => {
          const green = isCabinet ? CABINET_PAGE.greenCallout : isEpoxy ? EPOXY_PAGE.greenCallout : ESTIMATE_PAGE.greenCallout;
          const red = isCabinet ? CABINET_PAGE.redCallout : isEpoxy ? EPOXY_PAGE.redCallout : ESTIMATE_PAGE.redCallout;
          const heading = isCabinet
            ? "Why It Matters — Not All Cabinet Work Is Equal"
            : isEpoxy
            ? "Why It Matters — Not All Epoxy Is Equal"
            : "Why It Matters — Not All Refinishing Is Equal";
          return (
            <div className="rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200">
                <h2 className="font-semibold text-gray-800 text-sm">{heading}</h2>
              </div>

              <div className="p-4 bg-green-50">
                <p className="text-green-700 font-semibold text-sm mb-2 flex items-center gap-1.5">
                  <CheckCircle className="h-4 w-4 shrink-0" /> {green.heading}
                </p>
                {green.items.map((item) => (
                  <p key={item} className="text-[13px] leading-snug text-green-800 flex items-start gap-1.5 mb-1.5">
                    <CheckCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-green-600" />
                    {item}
                  </p>
                ))}
              </div>

              <div className="border-t border-gray-200" />

              <div className="p-4 bg-red-50">
                <p className="text-red-700 font-semibold text-sm mb-2 flex items-center gap-1.5">
                  <XCircle className="h-4 w-4 shrink-0" /> {red.heading}
                </p>
                {red.items.map((item) => (
                  <p key={item} className="text-[13px] leading-snug text-red-800 flex items-start gap-1.5 mb-1.5">
                    <XCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-red-500" />
                    {item}
                  </p>
                ))}
              </div>
            </div>
          );
        })()}
      </section>

      {/* ── SECTION 3: Package Selection (Bathtub Only) ── */}
      {isBathtub && (
        <section className="px-4 py-5">
          <h2 className="text-lg font-bold text-gray-900 text-center mb-4">
            Choose Your Package
          </h2>
          <div className="space-y-5 lg:grid lg:grid-cols-2 lg:gap-5 lg:space-y-0">

            {/* Standard Package */}
            <button
              type="button"
              onClick={() => setSelectedPackage("standard")}
              className={`w-full rounded-xl border-2 shadow-sm p-5 flex flex-col text-left transition-all ${
                selectedPackage === "standard"
                  ? "border-gray-900 ring-2 ring-gray-900/10"
                  : "border-gray-200"
              }`}
            >
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-0.5">
                {ESTIMATE_PAGE.standardPackage.name}
              </p>
              <h3 className="text-base font-bold text-gray-900 mb-1">
                {ESTIMATE_PAGE.standardPackage.title}
              </h3>
              <p className="text-3xl font-extrabold text-gray-900 mb-0.5">
                ${estimate.price.toLocaleString()}
              </p>
              <p className="text-[11px] text-gray-400 mb-4">
                {ESTIMATE_PAGE.standardPackage.warrantyLabel}
              </p>
              <ul className="text-[13px] text-gray-700 space-y-3 flex-1">
                {ESTIMATE_PAGE.standardPackage.features.map((f) => (
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
                <div className="mt-4 text-center text-sm font-semibold text-gray-900 py-2 bg-gray-100 rounded-lg">
                  ✓ Selected
                </div>
              )}
            </button>

            {/* Gold Package (Recommended) */}
            <button
              type="button"
              onClick={() => setSelectedPackage("gold")}
              className={`w-full rounded-xl border-2 shadow-md p-5 flex flex-col text-left relative transition-all mt-6 lg:mt-0 ${
                selectedPackage === "gold"
                  ? "border-blue-600 ring-2 ring-blue-600/20 bg-blue-50/30"
                  : "border-blue-200 bg-blue-50/10"
              }`}
            >
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[11px] font-bold px-4 py-1 rounded-full whitespace-nowrap shadow-sm">
                {ESTIMATE_PAGE.goldPackage.badge}
              </span>
              <div className="mt-1">
                <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-0.5">
                  {ESTIMATE_PAGE.goldPackage.name} Package
                </p>
                <h3 className="text-base font-bold text-gray-900 mb-1">
                  {ESTIMATE_PAGE.goldPackage.title}
                </h3>
              </div>
              {estimate.transformationPrice != null ? (
                <p className="text-3xl font-extrabold text-blue-600 mb-0.5">
                  ${estimate.transformationPrice.toLocaleString()}
                </p>
              ) : (
                <p className="text-sm font-semibold text-blue-400 mb-0.5">
                  Contact us for pricing
                </p>
              )}
              <p className="text-[11px] text-gray-500 mb-4 leading-relaxed">
                {ESTIMATE_PAGE.goldPackage.subtitle}
              </p>
              <ul className="text-[13px] text-gray-700 space-y-3 flex-1">
                {ESTIMATE_PAGE.goldPackage.features.map((f) => (
                  <li key={f.title} className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-gray-900 text-[13px]">{f.title}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{f.desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
              {selectedPackage === "gold" && (
                <div className="mt-4 text-center text-sm font-semibold text-blue-600 py-2 bg-blue-100 rounded-lg">
                  ✓ Selected
                </div>
              )}
            </button>
          </div>
        </section>
      )}

      {/* ── SECTION 4: Sink Upsell (refinishing only) ── */}
      {!isEpoxy && !isCabinet && (estimate.bathroomSinkPrice || estimate.kitchenSinkPrice) && (
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

      {/* ── SECTION 5: Epoxy Upsells ── */}
      {isEpoxy && (estimate.maintenancePlanPrice || estimate.uvClearCoatPrice) && (
        <section className="px-4 py-5">
          <div className="rounded-xl border border-gray-200 shadow-sm p-4">
            <h2 className="text-base font-bold text-gray-900 mb-0.5">
              Protect your investment
            </h2>
            <p className="text-[13px] text-gray-500 mb-4">
              Add optional upgrades to keep your floor looking its best for years to come.
            </p>

            <div className="space-y-3">
              {estimate.maintenancePlanPrice != null && (
                <label
                  className={`flex items-center justify-between gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    selectedEpoxyUpsells.maintenancePlan
                      ? "border-blue-600 bg-blue-50"
                      : "border-gray-200"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <input
                      type="checkbox"
                      checked={selectedEpoxyUpsells.maintenancePlan}
                      onChange={(e) =>
                        setSelectedEpoxyUpsells((s) => ({
                          ...s,
                          maintenancePlan: e.target.checked,
                        }))
                      }
                      className="h-5 w-5 shrink-0 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900">
                        Annual Maintenance Plan
                      </p>
                      <p className="text-[11px] text-gray-500">
                        Keep your floor looking sharp year after year
                      </p>
                    </div>
                  </div>
                  <span className="text-base font-bold text-gray-900 shrink-0">
                    +${estimate.maintenancePlanPrice.toLocaleString()}
                  </span>
                </label>
              )}

              {estimate.uvClearCoatPrice != null && (
                <label
                  className={`flex items-center justify-between gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    selectedEpoxyUpsells.uvClearCoat
                      ? "border-blue-600 bg-blue-50"
                      : "border-gray-200"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <input
                      type="checkbox"
                      checked={selectedEpoxyUpsells.uvClearCoat}
                      onChange={(e) =>
                        setSelectedEpoxyUpsells((s) => ({
                          ...s,
                          uvClearCoat: e.target.checked,
                        }))
                      }
                      className="h-5 w-5 shrink-0 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900">
                        UV-Protected Clear Coat
                      </p>
                      <p className="text-[11px] text-gray-500">
                        Added durability and protection against fading
                      </p>
                    </div>
                  </div>
                  <span className="text-base font-bold text-gray-900 shrink-0">
                    +${estimate.uvClearCoatPrice.toLocaleString()}
                  </span>
                </label>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── SECTION 6: Cabinet Upsells ── */}
      {isCabinet && (estimate.softCloseHingeUpgrade || estimate.hardwareReplacement || estimate.hardwareUpgrade) && (
        <section className="px-4 py-5">
          <div className="rounded-xl border border-gray-200 shadow-sm p-4">
            <h2 className="text-base font-bold text-gray-900 mb-0.5">
              Upgrade your hardware
            </h2>
            <p className="text-[13px] text-gray-500 mb-4">
              Complete the look with upgraded hinges and hardware.
            </p>

            <div className="space-y-3">
              {estimate.softCloseHingeUpgrade != null && (
                <label className={`flex items-center justify-between gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${selectedCabinetUpsells.softCloseHinge ? "border-blue-600 bg-blue-50" : "border-gray-200"}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <input type="checkbox" checked={selectedCabinetUpsells.softCloseHinge} onChange={(e) => setSelectedCabinetUpsells((s) => ({ ...s, softCloseHinge: e.target.checked }))} className="h-5 w-5 shrink-0 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900">Soft-Close Hinge Upgrade</p>
                      <p className="text-[11px] text-gray-500">Per door — quiet, smooth close on every cabinet</p>
                    </div>
                  </div>
                  <span className="text-base font-bold text-gray-900 shrink-0">+${estimate.softCloseHingeUpgrade.toLocaleString()}</span>
                </label>
              )}

              {estimate.hardwareReplacement != null && (
                <label className={`flex items-center justify-between gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${selectedCabinetUpsells.hardwareReplacement ? "border-blue-600 bg-blue-50" : "border-gray-200"}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <input type="checkbox" checked={selectedCabinetUpsells.hardwareReplacement} onChange={(e) => setSelectedCabinetUpsells((s) => ({ ...s, hardwareReplacement: e.target.checked }))} className="h-5 w-5 shrink-0 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900">Hardware Replacement</p>
                      <p className="text-[11px] text-gray-500">Same hole spacing — fresh new look, easy swap</p>
                    </div>
                  </div>
                  <span className="text-base font-bold text-gray-900 shrink-0">+${estimate.hardwareReplacement.toLocaleString()}</span>
                </label>
              )}

              {estimate.hardwareUpgrade != null && (
                <label className={`flex items-center justify-between gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${selectedCabinetUpsells.hardwareUpgrade ? "border-blue-600 bg-blue-50" : "border-gray-200"}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <input type="checkbox" checked={selectedCabinetUpsells.hardwareUpgrade} onChange={(e) => setSelectedCabinetUpsells((s) => ({ ...s, hardwareUpgrade: e.target.checked }))} className="h-5 w-5 shrink-0 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900">Hardware Upgrade</p>
                      <p className="text-[11px] text-gray-500">New hole pattern — custom install for a premium finish</p>
                    </div>
                  </div>
                  <span className="text-base font-bold text-gray-900 shrink-0">+${estimate.hardwareUpgrade.toLocaleString()}</span>
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
          <BookingButton />
        </div>
      </section>

      {/* ── BENEFITS ── */}
      <section className="px-4 py-4">
        <div className="grid grid-cols-2 gap-2.5">
          {(isCabinet ? CABINET_PAGE.benefits : isEpoxy ? EPOXY_PAGE.benefits : ESTIMATE_PAGE.benefits).map((b, i) => {
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
          {(isCabinet ? CABINET_PAGE.testimonials : isEpoxy ? EPOXY_PAGE.testimonials : ESTIMATE_PAGE.testimonials).map((t) => (
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

      {/* ── EMBEDDED BOOKING CALENDAR ── */}
      <section id="booking-calendar" className="px-4 py-5">
        <div className="rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="bg-green-500 py-3 px-4 text-center">
            <h2 className="text-lg font-bold text-white flex items-center justify-center gap-2">
              <Calendar className="h-5 w-5" />
              Book Now
            </h2>
            <p className="text-green-100 text-xs mt-0.5">Select a date and time that works for you</p>
          </div>
          {COMPANY.bookingLink ? (
            <iframe
              src={COMPANY.bookingLink}
              className="w-full border-0"
              style={{ minHeight: "600px" }}
              title="Book an appointment"
            />
          ) : (
            <div className="bg-white p-8 text-center text-gray-400 text-sm">
              Booking calendar not configured
            </div>
          )}
        </div>
      </section>

      {/* ── BOOKING CTA ── */}
      <section className="bg-blue-600 text-white py-8 px-5 text-center">
        <h2 className="text-xl font-bold mb-1.5">{ESTIMATE_PAGE.ctaHeading}</h2>
        <p className="text-blue-100 text-[13px] mb-5">
          {ESTIMATE_PAGE.ctaSubtext}
        </p>

        <div className="flex flex-col items-stretch gap-3 mb-5 max-w-xs mx-auto">
          <button
            onClick={() => document.getElementById("booking-calendar")?.scrollIntoView({ behavior: "smooth" })}
            className="flex items-center justify-center gap-2 bg-white text-blue-700 font-bold py-3.5 rounded-full text-base hover:bg-blue-50 transition-colors shadow"
          >
            <Calendar className="h-4 w-4" />
            Book Now
          </button>
          <a
            href={`tel:${COMPANY.phone}`}
            className="flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white font-bold py-3.5 rounded-full text-base transition-colors shadow"
          >
            <Phone className="h-4 w-4" />
            {COMPANY.phoneDisplay}
          </a>
        </div>

        <p className="text-blue-200 text-[11px] leading-relaxed">
          {ESTIMATE_PAGE.footerPromo}
        </p>
      </section>

      {/* ── TERMS ── */}
      <section className="px-4 py-5">
        <p className="text-[11px] text-gray-400 text-center leading-relaxed">
          {ESTIMATE_PAGE.termsText}
        </p>
      </section>
    </div>
  );
}

function BookingButton() {
  return (
    <button
      onClick={() => document.getElementById("booking-calendar")?.scrollIntoView({ behavior: "smooth" })}
      className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-full text-base transition-colors shadow w-full text-center block cursor-pointer"
    >
      Book Now
    </button>
  );
}

