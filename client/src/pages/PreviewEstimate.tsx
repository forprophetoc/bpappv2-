import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Loader2, Pencil, Rocket, Phone, Globe, MapPin, ExternalLink } from "lucide-react";

export default function PreviewEstimate() {
  const { slug } = useParams<{ slug: string }>();
  const [, navigate] = useLocation();

  const { data: config, isLoading, error } = trpc.companies.bySlug.useQuery(
    { slug: slug! },
    { enabled: !!slug }
  );

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !config) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <h2 className="text-lg font-bold text-red-800 mb-2">Config Not Found</h2>
          <p className="text-sm text-red-600 mb-4">
            No config found for slug: <code className="font-mono">{slug}</code>
          </p>
          <button
            onClick={() => navigate("/onboard")}
            className="text-sm text-blue-600 hover:underline"
          >
            Start new onboarding
          </button>
        </div>
      </div>
    );
  }

  const trustLines = [config.trustStat, config.trustTagline, config.warrantyLabel].filter(Boolean);

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">
      {/* Top message */}
      <div className="mb-6 bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
        <p className="text-sm text-blue-800">
          Here's how your estimate will look to customers.
        </p>
      </div>

      {/* Preview card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Header / Hero */}
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 text-white p-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              {config.companyLogoUrl && (
                <img
                  src={config.companyLogoUrl}
                  alt={`${config.companyName} logo`}
                  className="h-12 object-contain mb-4"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              )}
              <h1 className="text-2xl font-bold mb-1">{config.companyName}</h1>
              {(config as any).heroTitle && (
                <h2 className="text-xl text-gray-300 mb-2">
                  {(config as any).heroTitle}
                </h2>
              )}
              {config.heroSubtext && (
                <p className="text-gray-400 text-sm max-w-lg">
                  {config.heroSubtext}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Trust bar */}
        {trustLines.length > 0 && (
          <div className="bg-blue-600 text-white px-8 py-3 flex items-center gap-6 flex-wrap">
            {trustLines.map((line, i) => (
              <span key={i} className="text-sm font-medium">
                {line}
              </span>
            ))}
          </div>
        )}

        {/* Content sections */}
        <div className="p-8 space-y-6">
          {/* Company details */}
          <Section title="Company Details">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <DetailRow icon={<Phone className="h-4 w-4" />} label="Phone" value={config.phone} />
              {(config as any).email && (
                <DetailRow icon={<Globe className="h-4 w-4" />} label="Email" value={(config as any).email} />
              )}
              {(config as any).website && (
                <DetailRow icon={<ExternalLink className="h-4 w-4" />} label="Website" value={(config as any).website} />
              )}
              {config.serviceArea && (
                <DetailRow icon={<MapPin className="h-4 w-4" />} label="Service Area" value={config.serviceArea} />
              )}
            </div>
          </Section>

          {/* Pricing */}
          {(config as any).basePrice && (
            <Section title="Pricing">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-gray-900">
                  ${(config as any).basePrice}
                </span>
                {(config as any).planName && (
                  <span className="text-gray-500 text-sm">
                    — {(config as any).planName}
                  </span>
                )}
              </div>
            </Section>
          )}

          {/* CTA */}
          <Section title="Call to Action">
            <div className="flex items-center gap-4 flex-wrap">
              {config.bookingWidgetUrl ? (
                <a
                  href={config.bookingWidgetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg text-sm transition-colors"
                >
                  {(config as any).ctaText || "Book Now"}
                  <ExternalLink className="h-4 w-4" />
                </a>
              ) : (
                <span className="inline-flex items-center gap-2 bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg text-sm opacity-80 cursor-default">
                  {(config as any).ctaText || "Request Your Estimate"}
                </span>
              )}
            </div>
          </Section>
        </div>
      </div>

      {/* Action buttons */}
      <div className="mt-8 flex items-center justify-between gap-4 flex-wrap">
        <button
          onClick={() => navigate(`/onboard?edit=${slug}`)}
          className="flex items-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold py-3 px-6 rounded-lg text-sm transition-colors"
        >
          <Pencil className="h-4 w-4" />
          Edit Setup
        </button>
        <button
          onClick={() => navigate(`/activate/${slug}`)}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg text-sm transition-colors shadow-sm"
        >
          <Rocket className="h-4 w-4" />
          Activate & Go Live
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
        {title}
      </h3>
      {children}
    </div>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-gray-400">{icon}</span>
      <span className="text-gray-500">{label}:</span>
      <span className="text-gray-900 font-medium">{value}</span>
    </div>
  );
}
