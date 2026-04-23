import { useState } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import type { BrandConfig } from "../../../shared/brandConfig";
import {
  Building2,
  Image,
  Shield,
  Type,
  DollarSign,
  MapPin,
  MousePointerClick,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  ChevronRight,
} from "lucide-react";

// ── Status types ──────────────────────────────────────────────
type Status = "good" | "needs-improvement" | "missing";

interface SectionResult {
  name: string;
  status: Status;
  icon: React.ElementType;
  fields: { label: string; value: string }[];
  hint: string;
}

// ── Status evaluation ──────────────────────────────────────────
function evaluateCompany(c: BrandConfig): SectionResult {
  const fields = [
    { label: "Company Name", value: c.companyName || "" },
    { label: "Phone", value: c.phone || "" },
    { label: "Phone (tel)", value: c.phoneTel || "" },
    { label: "Short Code", value: c.companyShortCode || "" },
  ];
  const hasName = !!c.companyName?.trim();
  const hasPhone = !!c.phone?.trim();
  const hasTel = !!c.phoneTel?.trim();
  const hasCode = !!c.companyShortCode?.trim();

  let status: Status = "good";
  if (!hasName || !hasPhone) status = "missing";
  else if (!hasTel || !hasCode) status = "needs-improvement";

  return { name: "Company", status, icon: Building2, fields, hint: "Name and phone are required. Short code used for internal reference." };
}

function evaluateLogo(c: BrandConfig): SectionResult {
  const url = c.companyLogoUrl || "";
  const fields = [{ label: "Logo URL", value: url || "(none)" }];
  const status: Status = url.trim() ? "good" : "missing";
  return { name: "Logo", status, icon: Image, fields, hint: "Use a clean PNG if available." };
}

function evaluateTrustBar(c: BrandConfig): SectionResult {
  const items = [
    { label: "Trust Stat", value: c.trustStat || "" },
    { label: "Trust Tagline", value: c.trustTagline || "" },
    { label: "Warranty Label", value: c.warrantyLabel || "" },
    { label: "Warranty Detail", value: c.warrantyDetail || "" },
  ];
  const filled = items.filter((i) => i.value.trim().length > 0);
  const isPlaceholder = (v: string) => /^(test|placeholder|tbd|xxx|asdf)/i.test(v.trim());
  const hasWeak = filled.some((i) => i.value.trim().length < 4 || isPlaceholder(i.value));

  let status: Status = "good";
  if (filled.length === 0) status = "missing";
  else if (filled.length === 1 || hasWeak) status = "needs-improvement";

  return {
    name: "Trust Bar",
    status,
    icon: Shield,
    fields: items.map((i) => ({ label: i.label, value: i.value || "(empty)" })),
    hint: "Best with years in business, jobs completed, warranty, owner-operated.",
  };
}

function evaluateHero(c: BrandConfig): SectionResult {
  const title = c.heroSubtext || "";
  // BrandConfig doesn't have a separate headline field — heroSubtext is the main hero copy
  const fields = [
    { label: "Hero Subtext", value: title || "(empty)" },
  ];
  let status: Status = "good";
  if (!title.trim()) status = "missing";

  return { name: "Hero", status, icon: Type, fields, hint: "Hero subtext is shown below the main headline on the estimate page." };
}

function evaluatePricing(c: BrandConfig): SectionResult {
  // Current BrandConfig doesn't have explicit pricing fields — check benefits/footerPromo for pricing signals
  // For now, flag as info-only since pricing is in estimate creation, not brand config
  const fields = [
    { label: "Footer Promo", value: c.footerPromo || "(empty)" },
    { label: "Benefits Count", value: String(c.benefits?.length || 0) },
  ];
  const hasBenefits = (c.benefits?.length || 0) > 0;
  const hasPromo = !!c.footerPromo?.trim();

  let status: Status = "good";
  if (!hasBenefits && !hasPromo) status = "missing";
  else if (!hasBenefits || !hasPromo) status = "needs-improvement";

  return {
    name: "Pricing / Benefits",
    status,
    icon: DollarSign,
    fields: [
      ...fields,
      ...(c.benefits || []).map((b, i) => ({ label: `Benefit ${i + 1}`, value: `${b.label} — ${b.sub}` })),
    ],
    hint: "Two plans can improve upsell, but one clean plan is acceptable. Benefits and promo copy help conversion.",
  };
}

function evaluateServiceArea(c: BrandConfig): SectionResult {
  const area = c.serviceArea || "";
  const fields = [{ label: "Service Area", value: area || "(empty)" }];
  const isVague = (v: string) => /^(all|everywhere|usa|nationwide)$/i.test(v.trim());

  let status: Status = "good";
  if (!area.trim()) status = "missing";
  else if (area.trim().length < 5 || isVague(area)) status = "needs-improvement";

  return { name: "Service Area", status, icon: MapPin, fields, hint: "Specific cities/regions work best. Vague entries reduce trust." };
}

function evaluateCTA(c: BrandConfig): SectionResult {
  const bookingUrl = c.bookingWidgetUrl || "";
  const calendarUrl = c.calendarUrl || "";
  const widgetId = c.bookingWidgetId || "";
  const fields = [
    { label: "Booking Widget URL", value: bookingUrl || "(empty)" },
    { label: "Calendar URL", value: calendarUrl || "(empty)" },
    { label: "Widget ID", value: widgetId || "(empty)" },
  ];
  const hasBooking = !!bookingUrl.trim() || !!calendarUrl.trim();
  const hasWidget = !!widgetId.trim();

  let status: Status = "good";
  if (!hasBooking) status = "missing";
  else if (!hasWidget) status = "needs-improvement";

  return { name: "CTA / Booking", status, icon: MousePointerClick, fields, hint: "Strong direct CTA works best. Both booking URL and widget ID needed for embed." };
}

function evaluateAll(c: BrandConfig): SectionResult[] {
  return [
    evaluateCompany(c),
    evaluateLogo(c),
    evaluateTrustBar(c),
    evaluateHero(c),
    evaluatePricing(c),
    evaluateServiceArea(c),
    evaluateCTA(c),
  ];
}

// ── Status badge ──────────────────────────────────────────────
const STATUS_CONFIG = {
  good: { label: "Good", color: "bg-emerald-100 text-emerald-800", Icon: CheckCircle2 },
  "needs-improvement": { label: "Needs Improvement", color: "bg-amber-100 text-amber-800", Icon: AlertTriangle },
  missing: { label: "Missing", color: "bg-red-100 text-red-800", Icon: XCircle },
} as const;

function StatusBadge({ status }: { status: Status }) {
  const { label, color, Icon } = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

// ── Company selector ──────────────────────────────────────────
function CompanySelector({ onSelect }: { onSelect: (slug: string) => void }) {
  const { data: companies, isLoading } = trpc.companies.list.useQuery();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-500">Loading companies...</span>
      </div>
    );
  }

  if (!companies?.length) {
    return (
      <div className="text-center py-20 text-gray-500">
        No onboarded companies found. Use <strong>Onboard Company</strong> to add one first.
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto">
      <h2 className="text-lg font-semibold text-gray-700 mb-4">Select a company to audit</h2>
      <div className="space-y-2">
        {companies.map((co) => (
          <button
            key={co.slug}
            onClick={() => onSelect(co.slug)}
            className="w-full flex items-center justify-between px-4 py-3 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all text-left"
          >
            <div>
              <p className="font-medium text-gray-800">{co.companyName}</p>
              <p className="text-xs text-gray-400">{co.slug}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-gray-400" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Section detail card ───────────────────────────────────────
function SectionCard({ section, selected, onClick }: { section: SectionResult; selected: boolean; onClick: () => void }) {
  const Icon = section.icon;
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${
        selected ? "bg-white shadow border border-blue-200" : "hover:bg-white/60"
      }`}
    >
      <Icon className="h-4 w-4 text-gray-500 shrink-0" />
      <span className="flex-1 text-sm font-medium text-gray-700 truncate">{section.name}</span>
      <StatusBadge status={section.status} />
    </button>
  );
}

function SectionDetail({ section }: { section: SectionResult }) {
  const Icon = section.icon;
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
          <Icon className="h-5 w-5 text-gray-600" />
        </div>
        <div className="flex-1">
          <h3 className="text-base font-semibold text-gray-800">{section.name}</h3>
        </div>
        <StatusBadge status={section.status} />
      </div>

      {/* Hint */}
      <div className="mb-4 px-3 py-2 bg-blue-50 rounded-md text-xs text-blue-700">
        {section.hint}
      </div>

      {/* Fields */}
      <div className="space-y-3">
        {section.fields.map((f, i) => (
          <div key={i}>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">{f.label}</label>
            <div className="mt-0.5 text-sm text-gray-800 bg-gray-50 rounded px-3 py-2 break-all">
              {f.value || <span className="text-gray-400 italic">(empty)</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Logo preview */}
      {section.name === "Logo" && section.fields[0]?.value && section.fields[0].value !== "(none)" && (
        <div className="mt-4">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Preview</label>
          <div className="mt-1 p-4 bg-gray-50 rounded-lg flex items-center justify-center">
            <img
              src={section.fields[0].value}
              alt="Company logo"
              className="max-h-24 max-w-full object-contain"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main audit view ───────────────────────────────────────────
function AuditView({ slug }: { slug: string }) {
  const { data: config, isLoading, error } = trpc.companies.bySlug.useQuery({ slug });
  const [selectedIdx, setSelectedIdx] = useState(0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !config) {
    return (
      <div className="text-center py-20 text-red-500">
        Config not found for slug: <strong>{slug}</strong>
      </div>
    );
  }

  const sections = evaluateAll(config);
  const counts = {
    good: sections.filter((s) => s.status === "good").length,
    "needs-improvement": sections.filter((s) => s.status === "needs-improvement").length,
    missing: sections.filter((s) => s.status === "missing").length,
  };

  return (
    <div>
      {/* Top summary */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-800">{config.companyName}</h2>
            <p className="text-sm text-gray-400 mt-0.5">Slug: {slug}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span className="text-sm font-semibold text-emerald-700">{counts.good}</span>
              <span className="text-xs text-gray-500">Good</span>
            </div>
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-semibold text-amber-700">{counts["needs-improvement"]}</span>
              <span className="text-xs text-gray-500">Needs Work</span>
            </div>
            <div className="flex items-center gap-1.5">
              <XCircle className="h-4 w-4 text-red-500" />
              <span className="text-sm font-semibold text-red-700">{counts.missing}</span>
              <span className="text-xs text-gray-500">Missing</span>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4 flex h-2 rounded-full overflow-hidden bg-gray-100">
          {counts.good > 0 && (
            <div className="bg-emerald-500" style={{ width: `${(counts.good / sections.length) * 100}%` }} />
          )}
          {counts["needs-improvement"] > 0 && (
            <div className="bg-amber-400" style={{ width: `${(counts["needs-improvement"] / sections.length) * 100}%` }} />
          )}
          {counts.missing > 0 && (
            <div className="bg-red-400" style={{ width: `${(counts.missing / sections.length) * 100}%` }} />
          )}
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-[280px_1fr] gap-6">
        {/* Left: section list */}
        <div className="space-y-1 bg-gray-50/50 rounded-xl p-3">
          {sections.map((section, i) => (
            <SectionCard
              key={section.name}
              section={section}
              selected={selectedIdx === i}
              onClick={() => setSelectedIdx(i)}
            />
          ))}
        </div>

        {/* Right: detail */}
        <div>
          <SectionDetail section={sections[selectedIdx]} />
        </div>
      </div>
    </div>
  );
}

// ── Page wrapper ──────────────────────────────────────────────
export default function OnboardingAudit() {
  const params = useParams<{ slug?: string }>();
  const slugFromUrl = params.slug;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Onboarding Audit</h1>
      {slugFromUrl ? (
        <AuditView slug={slugFromUrl} />
      ) : (
        <CompanySelector onSelect={(slug) => { window.location.href = `/audit/${slug}`; }} />
      )}
    </div>
  );
}
