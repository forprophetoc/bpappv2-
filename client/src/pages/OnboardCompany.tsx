import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Loader2,
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  Upload,
  Building2,
  Shield,
  Type,
  DollarSign,
  MapPin,
  CalendarCheck,
  ClipboardCheck,
  Laptop,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Step definitions                                                   */
/* ------------------------------------------------------------------ */

const STEPS = [
  { title: "Welcome", icon: Laptop },
  { title: "Company Logo", icon: Upload },
  { title: "Company Details", icon: Building2 },
  { title: "Trust Bar", icon: Shield },
  { title: "Hero Section", icon: Type },
  { title: "Pricing", icon: DollarSign },
  { title: "Service Area", icon: MapPin },
  { title: "Booking & CTA", icon: CalendarCheck },
  { title: "Review & Submit", icon: ClipboardCheck },
] as const;

/* ------------------------------------------------------------------ */
/*  Form data shape (all fields across all steps)                      */
/* ------------------------------------------------------------------ */

interface FormData {
  companyLogoUrl: string;
  companyName: string;
  phone: string;
  email: string;
  website: string;
  trustLine1: string;
  trustLine2: string;
  trustLine3: string;
  heroTitle: string;
  heroSubtitle: string;
  basePrice: string;
  planName: string;
  serviceArea: string;
  bookingLink: string;
  ctaText: string;
}

const INITIAL: FormData = {
  companyLogoUrl: "",
  companyName: "",
  phone: "",
  email: "",
  website: "",
  trustLine1: "",
  trustLine2: "",
  trustLine3: "",
  heroTitle: "",
  heroSubtitle: "",
  basePrice: "",
  planName: "",
  serviceArea: "",
  bookingLink: "",
  ctaText: "",
};

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function OnboardCompany() {
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const editSlug = new URLSearchParams(searchString).get("edit");

  const [step, setStep] = useState(editSlug ? 1 : 0);
  const [form, setForm] = useState<FormData>(INITIAL);
  const [isEditMode, setIsEditMode] = useState(!!editSlug);
  const [configLoaded, setConfigLoaded] = useState(false);

  const set = (field: keyof FormData, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  /* ---- load existing config when editing ---- */
  const { data: existingConfig, isLoading: configLoading } =
    trpc.companies.bySlug.useQuery(
      { slug: editSlug! },
      { enabled: !!editSlug && !configLoaded }
    );

  useEffect(() => {
    if (existingConfig && !configLoaded) {
      setForm({
        companyLogoUrl: existingConfig.companyLogoUrl || "",
        companyName: existingConfig.companyName || "",
        phone: existingConfig.phone || "",
        email: (existingConfig as any).email || "",
        website: (existingConfig as any).website || "",
        trustLine1: existingConfig.trustStat || "",
        trustLine2: existingConfig.trustTagline || "",
        trustLine3: existingConfig.warrantyLabel || "",
        heroTitle: (existingConfig as any).heroTitle || "",
        heroSubtitle: existingConfig.heroSubtext || "",
        basePrice: (existingConfig as any).basePrice
          ? String((existingConfig as any).basePrice)
          : "",
        planName: (existingConfig as any).planName || "",
        serviceArea: existingConfig.serviceArea || "",
        bookingLink: existingConfig.bookingWidgetUrl || "",
        ctaText: (existingConfig as any).ctaText || "",
      });
      setIsEditMode(true);
      setConfigLoaded(true);
    }
  }, [existingConfig, configLoaded]);

  const createCompany = trpc.companies.create.useMutation({
    onSuccess: (data) => {
      toast.success(`Company "${data.companyName}" onboarded!`);
      navigate(`/preview/${data.slug}`);
    },
    onError: (err) => {
      toast.error(err.message || "Failed to create company config");
    },
  });

  const updateCompany = trpc.companies.update.useMutation({
    onSuccess: (data) => {
      toast.success(`Company "${data.companyName}" updated!`);
      navigate(`/preview/${data.slug}`);
    },
    onError: (err) => {
      toast.error(err.message || "Failed to update company config");
    },
  });

  /* ---- validation per step ---- */
  function validateStep(s: number): string | null {
    switch (s) {
      case 2:
        if (!form.companyName.trim()) return "Company name is required.";
        if (!form.phone.trim()) return "Phone number is required.";
        break;
      case 5:
        if (!form.basePrice.trim()) return "Base price is required.";
        if (isNaN(Number(form.basePrice))) return "Base price must be a number.";
        break;
      case 7:
        break;
    }
    return null;
  }

  function handleNext() {
    const err = validateStep(step);
    if (err) {
      toast.error(err);
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function handleBack() {
    setStep((s) => Math.max(s - 1, 0));
  }

  function handleSubmit() {
    const phoneTel = form.phone.replace(/\D/g, "");
    const shortCode = form.companyName
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 10) || "CO";

    const payload = {
      companyName: form.companyName,
      companyShortCode: shortCode,
      phone: form.phone,
      phoneTel,
      email: form.email || undefined,
      website: form.website || undefined,
      serviceArea: form.serviceArea || "N/A",
      trustStat: form.trustLine1,
      trustTagline: form.trustLine2,
      warrantyLabel: form.trustLine3,
      warrantyDetail: "",
      heroTitle: form.heroTitle || undefined,
      heroSubtext: form.heroSubtitle,
      basePrice: form.basePrice ? Number(form.basePrice) : undefined,
      planName: form.planName || undefined,
      ctaText: form.ctaText || undefined,
      bookingWidgetUrl: form.bookingLink,
      bookingWidgetId: "",
      calendarUrl: "",
      comparisonTitle: "",
      comparisonUsLabel: "",
      comparisonUsPoints: [],
      comparisonThemLabel: "",
      comparisonThemPoints: [],
      benefits: [],
      testimonials: [],
      footerPromo: "",
      companyLogoUrl: form.companyLogoUrl || undefined,
    };

    if (isEditMode && editSlug) {
      updateCompany.mutate({ slug: editSlug, ...payload });
    } else {
      createCompany.mutate(payload);
    }
  }

  const isPending = createCompany.isPending || updateCompany.isPending;

  /* ---- loading state for edit mode ---- */
  if (editSlug && configLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  /* ---- main layout ---- */
  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      {/* Header + progress */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {isEditMode ? "Edit Company Setup" : "Company Onboarding"}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Step {step + 1} of {STEPS.length} — {STEPS[step].title}
        </p>
      </div>

      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex items-center gap-1">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const done = i < step;
            const active = i === step;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className={`w-full h-1.5 rounded-full transition-colors ${
                    done
                      ? "bg-blue-600"
                      : active
                        ? "bg-blue-400"
                        : "bg-gray-200"
                  }`}
                />
                <div className="flex items-center gap-1">
                  <Icon
                    className={`h-3.5 w-3.5 ${
                      done
                        ? "text-blue-600"
                        : active
                          ? "text-blue-500"
                          : "text-gray-400"
                    }`}
                  />
                  <span
                    className={`text-[10px] hidden lg:inline ${
                      done
                        ? "text-blue-600 font-medium"
                        : active
                          ? "text-blue-500 font-medium"
                          : "text-gray-400"
                    }`}
                  >
                    {s.title}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Video — primary element */}
      <div className="mb-6">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Step Guide
        </h3>
        <StepVideo step={step} />
        <StepHelper step={step} />
      </div>

      {/* Form — secondary action layer */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex flex-col">
        <StepContent step={step} form={form} set={set} />

        {/* Navigation buttons */}
        <div className="mt-auto pt-6 flex items-center justify-between border-t border-gray-100">
          {step > 0 ? (
            <button
              type="button"
              onClick={handleBack}
              className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 font-medium py-2 px-4 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </button>
          ) : (
            <div />
          )}

          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={handleNext}
              className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-6 rounded-lg text-sm transition-colors shadow-sm"
            >
              Continue
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isPending}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 px-6 rounded-lg text-sm transition-colors shadow-sm disabled:opacity-50"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {isEditMode ? "Updating..." : "Submitting..."}
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4" />
                  {isEditMode ? "Update & Preview" : "Submit Onboarding"}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Step content renderer                                              */
/* ------------------------------------------------------------------ */

function StepContent({
  step,
  form,
  set,
}: {
  step: number;
  form: FormData;
  set: (field: keyof FormData, value: string) => void;
}) {
  switch (step) {
    case 0:
      return <StepWelcome />;
    case 1:
      return <StepLogo form={form} set={set} />;
    case 2:
      return <StepCompanyDetails form={form} set={set} />;
    case 3:
      return <StepTrustBar form={form} set={set} />;
    case 4:
      return <StepHero form={form} set={set} />;
    case 5:
      return <StepPricing form={form} set={set} />;
    case 6:
      return <StepServiceArea form={form} set={set} />;
    case 7:
      return <StepBooking form={form} set={set} />;
    case 8:
      return <StepReview form={form} />;
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Individual step components                                         */
/* ------------------------------------------------------------------ */

function StepWelcome() {
  return (
    <div className="flex-1 flex flex-col justify-center">
      <h2 className="text-xl font-bold text-gray-900 mb-3">
        Welcome to Company Onboarding
      </h2>
      <p className="text-gray-600 mb-4">
        We'll walk you through setting up your company profile step by step.
        This takes about 5–10 minutes.
      </p>
      <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-4">
        <p className="text-sm text-blue-800 font-medium mb-2">
          Before you start, have these ready:
        </p>
        <ul className="text-sm text-blue-700 space-y-1.5 list-disc list-inside">
          <li>Your company logo (URL or file)</li>
          <li>Business phone number</li>
          <li>Base bathtub refinishing price</li>
          <li>Your booking/scheduling link</li>
          <li>A few trust-building stats or taglines</li>
        </ul>
      </div>
      <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
        <p className="text-xs text-amber-700">
          <Laptop className="h-3.5 w-3.5 inline-block mr-1 -mt-0.5" />
          This works best on a laptop or tablet.
        </p>
      </div>
    </div>
  );
}

function StepLogo({
  form,
  set,
}: {
  form: FormData;
  set: (f: keyof FormData, v: string) => void;
}) {
  return (
    <div>
      <h2 className="text-lg font-bold text-gray-900 mb-1">Company Logo</h2>
      <p className="text-sm text-gray-500 mb-5">
        Provide a URL to your company logo. This will appear on estimates and
        customer-facing pages.
      </p>
      <Field label="Logo URL">
        <input
          type="url"
          placeholder="https://example.com/logo.png"
          value={form.companyLogoUrl}
          onChange={(e) => set("companyLogoUrl", e.target.value)}
          className="form-input"
        />
      </Field>
      {form.companyLogoUrl && (
        <div className="mt-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
          <p className="text-xs text-gray-500 mb-2">Preview:</p>
          <img
            src={form.companyLogoUrl}
            alt="Logo preview"
            className="max-h-20 object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
      )}
    </div>
  );
}

function StepCompanyDetails({
  form,
  set,
}: {
  form: FormData;
  set: (f: keyof FormData, v: string) => void;
}) {
  return (
    <div>
      <h2 className="text-lg font-bold text-gray-900 mb-1">Company Details</h2>
      <p className="text-sm text-gray-500 mb-5">
        Basic information about your company.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Company Name" required>
          <input
            type="text"
            placeholder="e.g. Bathtub Pros"
            value={form.companyName}
            onChange={(e) => set("companyName", e.target.value)}
            className="form-input"
          />
        </Field>
        <Field label="Phone" required>
          <input
            type="tel"
            placeholder="e.g. 239-307-7945"
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
            className="form-input"
          />
        </Field>
        <Field label="Email">
          <input
            type="email"
            placeholder="info@company.com"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            className="form-input"
          />
        </Field>
        <Field label="Website">
          <input
            type="url"
            placeholder="https://company.com"
            value={form.website}
            onChange={(e) => set("website", e.target.value)}
            className="form-input"
          />
        </Field>
      </div>
    </div>
  );
}

function StepTrustBar({
  form,
  set,
}: {
  form: FormData;
  set: (f: keyof FormData, v: string) => void;
}) {
  return (
    <div>
      <h2 className="text-lg font-bold text-gray-900 mb-1">Trust Bar</h2>
      <p className="text-sm text-gray-500 mb-5">
        Three short trust-building statements that appear on your customer pages.
      </p>
      <div className="space-y-4">
        <Field label="Trust Line 1">
          <input
            type="text"
            placeholder="e.g. 11,000+ Tubs Refinished"
            value={form.trustLine1}
            onChange={(e) => set("trustLine1", e.target.value)}
            className="form-input"
          />
        </Field>
        <Field label="Trust Line 2">
          <input
            type="text"
            placeholder="e.g. Owner On-Site Every Job"
            value={form.trustLine2}
            onChange={(e) => set("trustLine2", e.target.value)}
            className="form-input"
          />
        </Field>
        <Field label="Trust Line 3">
          <input
            type="text"
            placeholder="e.g. 5-Year Warranty"
            value={form.trustLine3}
            onChange={(e) => set("trustLine3", e.target.value)}
            className="form-input"
          />
        </Field>
      </div>
    </div>
  );
}

function StepHero({
  form,
  set,
}: {
  form: FormData;
  set: (f: keyof FormData, v: string) => void;
}) {
  return (
    <div>
      <h2 className="text-lg font-bold text-gray-900 mb-1">Hero Section</h2>
      <p className="text-sm text-gray-500 mb-5">
        The headline and subtitle customers see first on your estimate page.
      </p>
      <div className="space-y-4">
        <Field label="Headline">
          <input
            type="text"
            placeholder="e.g. Your Bathtub, Like New Again"
            value={form.heroTitle}
            onChange={(e) => set("heroTitle", e.target.value)}
            className="form-input"
          />
        </Field>
        <Field label="Subtitle">
          <textarea
            placeholder="e.g. Based on your bathroom, here's the transformation you can expect — no demo, no mess, done in one day."
            value={form.heroSubtitle}
            onChange={(e) => set("heroSubtitle", e.target.value)}
            rows={3}
            className="form-input resize-y"
          />
        </Field>
      </div>
    </div>
  );
}

function StepPricing({
  form,
  set,
}: {
  form: FormData;
  set: (f: keyof FormData, v: string) => void;
}) {
  return (
    <div>
      <h2 className="text-lg font-bold text-gray-900 mb-1">Pricing</h2>
      <p className="text-sm text-gray-500 mb-5">
        Set your base bathtub refinishing price.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Base Bathtub Price" required>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
              $
            </span>
            <input
              type="number"
              placeholder="e.g. 495"
              value={form.basePrice}
              onChange={(e) => set("basePrice", e.target.value)}
              className="form-input pl-7"
              min="0"
            />
          </div>
        </Field>
        <Field label="Plan Name">
          <input
            type="text"
            placeholder="e.g. Standard Refinish"
            value={form.planName}
            onChange={(e) => set("planName", e.target.value)}
            className="form-input"
          />
        </Field>
      </div>
    </div>
  );
}

function StepServiceArea({
  form,
  set,
}: {
  form: FormData;
  set: (f: keyof FormData, v: string) => void;
}) {
  return (
    <div>
      <h2 className="text-lg font-bold text-gray-900 mb-1">Service Area</h2>
      <p className="text-sm text-gray-500 mb-5">
        Describe the areas you serve. You can list cities, counties, or regions.
      </p>
      <Field label="Service Area">
        <textarea
          placeholder="e.g. Covering All of Southwest Florida & Barrier Islands&#10;Naples, Fort Myers, Cape Coral, Bonita Springs"
          value={form.serviceArea}
          onChange={(e) => set("serviceArea", e.target.value)}
          rows={4}
          className="form-input resize-y"
        />
      </Field>
    </div>
  );
}

function StepBooking({
  form,
  set,
}: {
  form: FormData;
  set: (f: keyof FormData, v: string) => void;
}) {
  return (
    <div>
      <h2 className="text-lg font-bold text-gray-900 mb-1">Booking & CTA</h2>
      <p className="text-sm text-gray-500 mb-5">
        Your booking/scheduling link and call-to-action text.
      </p>
      <div className="space-y-4">
        <Field label="Booking Link">
          <input
            type="url"
            placeholder="https://api.leadconnectorhq.com/widget/booking/..."
            value={form.bookingLink}
            onChange={(e) => set("bookingLink", e.target.value)}
            className="form-input"
          />
        </Field>
        <Field label="CTA Text">
          <input
            type="text"
            placeholder="e.g. Book Your Free Estimate"
            value={form.ctaText}
            onChange={(e) => set("ctaText", e.target.value)}
            className="form-input"
          />
        </Field>
      </div>
    </div>
  );
}

function StepReview({ form }: { form: FormData }) {
  const sections = [
    {
      title: "Company Logo",
      items: [{ label: "Logo URL", value: form.companyLogoUrl }],
    },
    {
      title: "Company Details",
      items: [
        { label: "Company Name", value: form.companyName },
        { label: "Phone", value: form.phone },
        { label: "Email", value: form.email },
        { label: "Website", value: form.website },
      ],
    },
    {
      title: "Trust Bar",
      items: [
        { label: "Line 1", value: form.trustLine1 },
        { label: "Line 2", value: form.trustLine2 },
        { label: "Line 3", value: form.trustLine3 },
      ],
    },
    {
      title: "Hero Section",
      items: [
        { label: "Headline", value: form.heroTitle },
        { label: "Subtitle", value: form.heroSubtitle },
      ],
    },
    {
      title: "Pricing",
      items: [
        {
          label: "Base Price",
          value: form.basePrice ? `$${form.basePrice}` : "",
        },
        { label: "Plan Name", value: form.planName },
      ],
    },
    {
      title: "Service Area",
      items: [{ label: "Service Area", value: form.serviceArea }],
    },
    {
      title: "Booking & CTA",
      items: [
        { label: "Booking Link", value: form.bookingLink },
        { label: "CTA Text", value: form.ctaText },
      ],
    },
  ];

  return (
    <div>
      <h2 className="text-lg font-bold text-gray-900 mb-1">
        Review & Submit
      </h2>
      <p className="text-sm text-gray-500 mb-5">
        Review your entries below. Use the Back button to make changes.
      </p>
      <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
        {sections.map((section) => (
          <div
            key={section.title}
            className="border border-gray-100 rounded-lg p-3"
          >
            <h3 className="text-sm font-semibold text-gray-700 mb-2">
              {section.title}
            </h3>
            <div className="space-y-1">
              {section.items.map((item) => (
                <div key={item.label} className="flex text-sm">
                  <span className="text-gray-500 w-28 shrink-0">
                    {item.label}:
                  </span>
                  <span
                    className={`${item.value ? "text-gray-900" : "text-gray-300 italic"} break-all`}
                  >
                    {item.value || "Not provided"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Step video (right panel)                                           */
/* ------------------------------------------------------------------ */

const STEP_VIDEOS: Record<number, string> = {
  0: "/videos/welcome.mp4",
  1: "/videos/step01.mp4",
  2: "/videos/step02.mp4",
  3: "/videos/step03.mp4",
  4: "/videos/step04.mp4",
  5: "/videos/step05.mp4",
  6: "/videos/step06.mp4",
  7: "/videos/step07.mp4",
  8: "/videos/step08.mp4",
};

function StepVideo({ step }: { step: number }) {
  const src = STEP_VIDEOS[step];

  if (!src) {
    return (
      <div className="w-full bg-gray-100 border border-dashed border-gray-300 rounded-xl p-6 text-center">
        <div className="text-gray-400 text-sm">
          Step video unavailable for this section.
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <video
        key={src}
        src={src}
        controls
        muted
        playsInline
        className="w-full max-h-[420px] rounded-xl border border-gray-200 bg-black object-contain"
        onError={(e) => {
          const el = e.currentTarget;
          el.style.display = "none";
          const fallback = el.nextElementSibling;
          if (fallback) (fallback as HTMLElement).style.display = "";
        }}
      />
      <div
        className="w-full bg-gray-100 border border-dashed border-gray-300 rounded-xl p-6 text-center"
        style={{ display: "none" }}
      >
        <div className="text-gray-400 text-sm">
          Step video unavailable for this section.
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Step helper (right panel contextual tips)                          */
/* ------------------------------------------------------------------ */

function StepHelper({ step }: { step: number }) {
  const tips: Record<number, string> = {
    0: "Take a moment to gather everything you need. This flow saves your progress between steps.",
    1: "A clear, high-quality logo helps build trust with customers. PNG or SVG formats work best.",
    2: "Your company name and phone number will appear on all customer-facing pages.",
    3: "Trust lines appear prominently on your estimate page. Keep them short and impactful.",
    4: "The headline is the first thing customers read. Make it clear and compelling.",
    5: "Enter your standard bathtub refinishing price. You can adjust pricing tiers later.",
    6: "Let customers know exactly where you operate. Be specific but inclusive.",
    7: "Your booking link connects directly to your scheduling system. The CTA text drives action.",
    8: "Review everything carefully. You can go back to any step to make changes before submitting.",
  };

  return tips[step] ? (
    <p className="text-xs text-gray-500 mt-2 leading-relaxed">
      {tips[step]}
    </p>
  ) : null;
}

/* ------------------------------------------------------------------ */
/*  Shared field wrapper                                               */
/* ------------------------------------------------------------------ */

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-semibold text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
