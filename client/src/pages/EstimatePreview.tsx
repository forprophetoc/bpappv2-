/**
 * Dev-only preview route: renders the customer-facing estimate page
 * with realistic hardcoded data so the UI can be verified without
 * needing a database record.
 *
 * Route: /preview-estimate
 */
import { useState, useMemo } from "react";
import {
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

type ServiceType = "bathtub" | "shower" | "jacuzzi";

const SERVICE_LABELS: Record<ServiceType, string> = {
  bathtub: "Tub Refinishing",
  shower: "Shower Refinishing",
  jacuzzi: "Jacuzzi / Soaking Tub Refinishing",
};

const TEST_ESTIMATES: Record<ServiceType, TestEstimate> = {
  bathtub: {
    firstName: "Jane",
    name: "Jane Smith",
    serviceType: "bathtub",
    price: 875,
    beforeUrl:
      "https://bathtub-pros-images.s3.us-east-1.amazonaws.com/generated/1744739498498-f3a5e2f3-0530-4aed-b70e-9d7bb389e38d.png",
    afterUrl:
      "https://bathtub-pros-images.s3.us-east-1.amazonaws.com/generated/1744739498498-f3a5e2f3-0530-4aed-b70e-9d7bb389e38d.png",
    transformationImageUrl:
      "https://bathtub-pros-images.s3.us-east-1.amazonaws.com/generated/1744739498498-f3a5e2f3-0530-4aed-b70e-9d7bb389e38d.png",
    transformationPrice: 275,
    bathroomSinkPrice: 225,
    kitchenSinkPrice: 250,
    bookingLink: "https://api.leadconnectorhq.com/widget/booking/Pbt4MIKvOcDf1sLjqaMS",
    calendarEmbed: null,
  },
  shower: {
    firstName: "Mike",
    name: "Mike Johnson",
    serviceType: "shower",
    price: 750,
    beforeUrl:
      "https://bathtub-pros-images.s3.us-east-1.amazonaws.com/generated/1744739498498-f3a5e2f3-0530-4aed-b70e-9d7bb389e38d.png",
    afterUrl:
      "https://bathtub-pros-images.s3.us-east-1.amazonaws.com/generated/1744739498498-f3a5e2f3-0530-4aed-b70e-9d7bb389e38d.png",
    transformationImageUrl: null,
    transformationPrice: null,
    bathroomSinkPrice: 225,
    kitchenSinkPrice: 250,
    bookingLink: null,
    calendarEmbed: null,
  },
  jacuzzi: {
    firstName: "Sarah",
    name: "Sarah Williams",
    serviceType: "jacuzzi",
    price: 1200,
    beforeUrl:
      "https://bathtub-pros-images.s3.us-east-1.amazonaws.com/generated/1744739498498-f3a5e2f3-0530-4aed-b70e-9d7bb389e38d.png",
    afterUrl:
      "https://bathtub-pros-images.s3.us-east-1.amazonaws.com/generated/1744739498498-f3a5e2f3-0530-4aed-b70e-9d7bb389e38d.png",
    transformationImageUrl: null,
    transformationPrice: null,
    bathroomSinkPrice: 225,
    kitchenSinkPrice: null,
    bookingLink: null,
    calendarEmbed: null,
  },
};

interface TestEstimate {
  firstName: string;
  name: string;
  serviceType: ServiceType;
  price: number;
  beforeUrl: string;
  afterUrl: string;
  transformationImageUrl: string | null;
  transformationPrice: number | null;
  bathroomSinkPrice: number | null;
  kitchenSinkPrice: number | null;
  bookingLink: string | null;
  calendarEmbed: string | null;
}

export default function EstimatePreview() {
  const [activeType, setActiveType] = useState<ServiceType>("bathtub");
  const estimate = TEST_ESTIMATES[activeType];

  return (
    <div>
      {/* Dev toolbar */}
      <div className="bg-yellow-100 border-b border-yellow-300 px-4 py-2 flex items-center gap-4 text-sm">
        <span className="font-bold text-yellow-800">DEV PREVIEW</span>
        <span className="text-yellow-700">Service type:</span>
        {(["bathtub", "shower", "jacuzzi"] as ServiceType[]).map((t) => (
          <button
            key={t}
            onClick={() => setActiveType(t)}
            className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
              activeType === t
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Actual estimate page */}
      <EstimatePageContent estimate={estimate} />
    </div>
  );
}

function EstimatePageContent({ estimate }: { estimate: TestEstimate }) {
  const firstName = estimate.firstName;
  const serviceType = estimate.serviceType;
  const isBathtub = serviceType === "bathtub";

  const [selectedSinks, setSelectedSinks] = useState<{
    bathroom: boolean;
    kitchen: boolean;
  }>({ bathroom: false, kitchen: false });

  const [selectedPackage, setSelectedPackage] = useState<
    "standard" | "transformation"
  >("standard");

  const totalPrice = useMemo(() => {
    let total = estimate.price;
    if (
      isBathtub &&
      selectedPackage === "transformation" &&
      estimate.transformationPrice
    ) {
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

  const serviceLabel = SERVICE_LABELS[serviceType];

  return (
    <div className="min-h-screen bg-white font-sans">
      {/* Header */}
      <header className="bg-gray-900 text-white py-3 px-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 text-white font-bold text-sm px-2 py-1 rounded">
            BP
          </div>
          <span className="font-semibold text-sm">Bathtub Pros</span>
        </div>
        <a
          href="tel:2393077945"
          className="bg-green-500 hover:bg-green-600 text-white text-sm font-semibold px-4 py-2 rounded-full flex items-center gap-1 transition-colors"
        >
          <Phone className="h-3.5 w-3.5" />
          239-307-7945
        </a>
      </header>

      {/* Trust strip */}
      <div className="bg-gray-800 text-gray-300 text-xs py-2 px-4 flex items-center justify-center gap-6 flex-wrap">
        <span className="flex items-center gap-1">
          <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" /> 11,000+
          Tubs Refinished
        </span>
        <span>Covering All of Southwest Florida & Barrier Islands</span>
        <span>Owner On-Site Every Job</span>
      </div>

      {/* Hero */}
      <section className="bg-gradient-to-b from-blue-50 to-white py-10 px-4 text-center">
        <p className="text-xs uppercase tracking-widest text-blue-600 font-semibold mb-2">
          Your Personalized Estimate
        </p>
        <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 leading-tight mb-3">
          {firstName}, Here's Your
          <br />
          <span className="text-blue-600">{serviceLabel} Quote</span>
        </h1>
        <p className="text-gray-500 max-w-md mx-auto text-sm">
          Based on your bathroom, here's the transformation you can expect — no
          demo, no mess, done in one day.
        </p>
      </section>

      {/* SECTION 1: Before & After */}
      <section className="max-w-2xl mx-auto px-4 py-6">
        <h2 className="text-xl font-bold text-gray-900 text-center mb-4">
          Your Before & After
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Before
            </p>
            <img
              src={estimate.beforeUrl}
              alt="Before"
              className="rounded-xl border border-gray-200 w-full h-56 object-cover bg-gray-100"
            />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              After
            </p>
            <img
              src={estimate.afterUrl}
              alt="After"
              className="rounded-xl border border-gray-200 w-full h-56 object-cover bg-gray-100"
            />
          </div>
        </div>

        {isBathtub && estimate.transformationImageUrl && (
          <div className="mt-4 space-y-1">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Full Transformation Preview
            </p>
            <img
              src={estimate.transformationImageUrl}
              alt="Transformation"
              className="rounded-xl border border-gray-200 w-full h-56 object-cover bg-gray-100"
            />
          </div>
        )}
      </section>

      {/* SECTION 2: Why It Matters */}
      <section className="max-w-2xl mx-auto px-4 py-6">
        <div className="rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
            <h2 className="font-semibold text-gray-800">
              Why It Matters — Not All Refinishing Is Equal
            </h2>
          </div>
          <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-200">
            <div className="p-4 bg-green-50">
              <p className="text-green-700 font-semibold text-sm mb-3 flex items-center gap-1">
                <CheckCircle className="h-4 w-4" /> The Bathtub Pros Way
              </p>
              {[
                "Step 1 — Bonding Agent: Chemically bonds to surface",
                "Step 2 — Primer: Creates stable base layer (most skip this)",
                "Step 3 — Professional Topcoat: Durable, glossy, like-new finish",
                "Full 3-coat system = lasts 10-15 years",
                "5-Year Warranty, honored since 2013",
              ].map((item) => (
                <p
                  key={item}
                  className="text-xs text-green-800 flex items-start gap-1.5 mb-1.5"
                >
                  <CheckCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-green-600" />
                  {item}
                </p>
              ))}
            </div>
            <div className="p-4 bg-red-50">
              <p className="text-red-700 font-semibold text-sm mb-3 flex items-center gap-1">
                <XCircle className="h-4 w-4" /> The Fly-By-Night Way
              </p>
              {[
                "Bonding agent only — no primer",
                "Single topcoat over unstable surface",
                "Looks fine 1-2 years, then peels",
                "No warranty, or one they won't honor",
                "You end up paying twice",
              ].map((item) => (
                <p
                  key={item}
                  className="text-xs text-red-800 flex items-start gap-1.5 mb-1.5"
                >
                  <XCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-red-500" />
                  {item}
                </p>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: Package Selection (Bathtub Only) */}
      {isBathtub && (
        <section className="max-w-2xl mx-auto px-4 py-6">
          <h2 className="text-xl font-bold text-gray-900 text-center mb-4">
            Choose Your Package
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {/* Standard */}
            <button
              type="button"
              onClick={() => setSelectedPackage("standard")}
              className={`rounded-xl border-2 shadow-sm p-6 flex flex-col text-left transition-all ${
                selectedPackage === "standard"
                  ? "border-gray-900 ring-2 ring-gray-900/10"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Standard
              </p>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                Tub Refinishing Only
              </h3>
              <p className="text-4xl font-extrabold text-gray-900 mb-1">
                ${estimate.price.toLocaleString()}
              </p>
              <p className="text-xs text-gray-400 mb-4">
                Includes 5-Year Warranty
              </p>
              <ul className="text-sm text-gray-700 space-y-1.5 flex-1">
                {[
                  "Full 3-step refinishing process",
                  "Professional-grade topcoat",
                  "5-Year Warranty included",
                  "Same-day completion",
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              {selectedPackage === "standard" && (
                <div className="mt-4 text-center text-sm font-semibold text-gray-900">
                  Selected
                </div>
              )}
            </button>

            {/* Transformation */}
            <button
              type="button"
              onClick={() => setSelectedPackage("transformation")}
              className={`rounded-xl border-2 shadow-md p-6 flex flex-col text-left relative transition-all ${
                selectedPackage === "transformation"
                  ? "border-blue-600 ring-2 ring-blue-600/10"
                  : "border-gray-200 hover:border-blue-300"
              }`}
            >
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                Most Popular
              </span>
              <p className="text-sm font-semibold text-blue-600 uppercase tracking-wide mb-1">
                Premium
              </p>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                Full Transformation
              </h3>
              {estimate.transformationPrice != null ? (
                <p className="text-4xl font-extrabold text-blue-600 mb-1">
                  $
                  {(
                    estimate.price + estimate.transformationPrice
                  ).toLocaleString()}
                </p>
              ) : (
                <p className="text-sm font-semibold text-blue-400 mb-1">
                  Contact us for pricing
                </p>
              )}
              <p className="text-xs text-gray-400 mb-4">
                Includes 5-Year Warranty + extras
              </p>
              <ul className="text-sm text-gray-700 space-y-1.5 flex-1">
                {[
                  "Everything in Tub Refinishing",
                  "Caulk replacement & resealing",
                  "Color upgrade option",
                  "Priority scheduling",
                  "Extended care kit included",
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-blue-500 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              {selectedPackage === "transformation" && (
                <div className="mt-4 text-center text-sm font-semibold text-blue-600">
                  Selected
                </div>
              )}
            </button>
          </div>
        </section>
      )}

      {/* SECTION 4: Sink Upsell (All Services) */}
      {(estimate.bathroomSinkPrice || estimate.kitchenSinkPrice) && (
        <section className="max-w-2xl mx-auto px-4 py-6">
          <div className="rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-1">
              Don't leave your sink behind
            </h2>
            <p className="text-sm text-gray-500 mb-5">
              We can refinish your sink during the same visit so everything
              looks clean, consistent, and professionally finished.
            </p>

            <div className="space-y-3">
              {estimate.bathroomSinkPrice != null && (
                <label
                  className={`flex items-center justify-between p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    selectedSinks.bathroom
                      ? "border-blue-600 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedSinks.bathroom}
                      onChange={(e) =>
                        setSelectedSinks((s) => ({
                          ...s,
                          bathroom: e.target.checked,
                        }))
                      }
                      className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        Bathroom Sink
                      </p>
                      <p className="text-xs text-gray-500">
                        Refinished to match during the same visit
                      </p>
                    </div>
                  </div>
                  <span className="text-lg font-bold text-gray-900">
                    +${estimate.bathroomSinkPrice.toLocaleString()}
                  </span>
                </label>
              )}

              {estimate.kitchenSinkPrice != null && (
                <label
                  className={`flex items-center justify-between p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    selectedSinks.kitchen
                      ? "border-blue-600 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedSinks.kitchen}
                      onChange={(e) =>
                        setSelectedSinks((s) => ({
                          ...s,
                          kitchen: e.target.checked,
                        }))
                      }
                      className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        Kitchen Sink
                      </p>
                      <p className="text-xs text-gray-500">
                        Refinished to match during the same visit
                      </p>
                    </div>
                  </div>
                  <span className="text-lg font-bold text-gray-900">
                    +${estimate.kitchenSinkPrice.toLocaleString()}
                  </span>
                </label>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Running Total */}
      <section className="max-w-2xl mx-auto px-4 py-4">
        <div className="bg-gray-900 text-white rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">
              Your Estimate Total
            </p>
            <p className="text-3xl font-extrabold">
              ${totalPrice.toLocaleString()}
            </p>
          </div>
          {estimate.bookingLink ? (
            <a
              href={estimate.bookingLink}
              target="_blank"
              rel="noreferrer"
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-full text-sm transition-colors shadow"
            >
              Book Now
            </a>
          ) : (
            <a
              href="tel:2393077945"
              className="bg-green-500 hover:bg-green-600 text-white font-bold px-6 py-3 rounded-full text-sm transition-colors shadow flex items-center gap-2"
            >
              <Phone className="h-4 w-4" />
              Call Now
            </a>
          )}
        </div>
      </section>

      {/* Benefits row */}
      <section className="max-w-2xl mx-auto px-4 py-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            {
              icon: ShieldCheck,
              label: "5-Year Warranty",
              sub: "Every job covered",
            },
            {
              icon: Clock,
              label: "Same-Day Done",
              sub: "In & out in one visit",
            },
            {
              icon: BadgeDollarSign,
              label: "Save Thousands",
              sub: "vs. full replacement",
            },
            {
              icon: MapPin,
              label: "Local Experts",
              sub: "Naples - Ft Myers - CC",
            },
          ].map((b) => (
            <div
              key={b.label}
              className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center"
            >
              <b.icon className="h-5 w-5 mx-auto mb-1 text-blue-600" />
              <p className="font-semibold text-gray-800 text-sm">{b.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{b.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 5: Testimonials */}
      <section className="max-w-2xl mx-auto px-4 py-6">
        <h2 className="text-xl font-bold text-gray-900 text-center mb-4">
          What Customers Say
        </h2>
        <div className="space-y-4">
          {[
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
          ].map((t) => (
            <blockquote
              key={t.author}
              className="bg-gray-50 border border-gray-200 rounded-xl p-4"
            >
              <div className="flex gap-0.5 mb-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star
                    key={i}
                    className="h-3.5 w-3.5 text-yellow-400 fill-yellow-400"
                  />
                ))}
              </div>
              <p className="text-sm text-gray-700 italic mb-2">"{t.quote}"</p>
              <p className="text-xs text-gray-500 font-semibold">
                — {t.author}
              </p>
            </blockquote>
          ))}
        </div>
      </section>

      {/* SECTION 6: Booking */}
      <section className="bg-blue-600 text-white py-10 px-4 text-center">
        <h2 className="text-2xl font-bold mb-2">Ready to Book?</h2>
        <p className="text-blue-100 text-sm mb-6">
          Book online or give us a call — we're ready when you are.
        </p>

        {estimate.bookingLink ? (
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-5">
            <a
              href={estimate.bookingLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 bg-white text-blue-700 font-bold px-8 py-3 rounded-full text-base hover:bg-blue-50 transition-colors shadow"
            >
              <Calendar className="h-4 w-4" />
              Book My Appointment
            </a>
            <a
              href="tel:2393077945"
              className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white font-bold px-8 py-3 rounded-full text-base transition-colors shadow"
            >
              <Phone className="h-4 w-4" />
              239-307-7945
            </a>
          </div>
        ) : estimate.calendarEmbed ? (
          <div className="max-w-2xl mx-auto mb-5">
            <div
              className="bg-white rounded-xl overflow-hidden shadow-lg"
              dangerouslySetInnerHTML={{ __html: estimate.calendarEmbed }}
            />
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-5">
            <a
              href="tel:2393077945"
              className="inline-flex items-center gap-2 bg-white text-blue-700 font-bold px-8 py-3 rounded-full text-base hover:bg-blue-50 transition-colors shadow"
            >
              <Phone className="h-4 w-4" />
              Call to Book: 239-307-7945
            </a>
          </div>
        )}

        <p className="text-blue-200 text-xs">
          5-Year Warranty - No mess, no demo - Same-day completion - 10% off for
          veterans & first responders
        </p>
      </section>

      {/* SECTION 7: Terms */}
      <section className="max-w-2xl mx-auto px-4 py-6">
        <div className="text-center">
          <p className="text-xs text-gray-400">
            Images are stored for 90 days and may expire after this period, and
            this estimate is valid for 6 months from the date issued.
          </p>
        </div>
      </section>
    </div>
  );
}
