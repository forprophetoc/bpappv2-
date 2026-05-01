import { CheckCircle, Shield, Crown } from "lucide-react";

interface PackageCardsProps {
  estimate: {
    price: number;
    transformationPrice: number | null;
  };
  silverConfig: {
    name: string;
    title: string;
    warrantyHeadline: string;
    warrantySubline: string;
    features: Array<{ title: string; desc: string }>;
  };
  goldConfig: {
    name: string;
    title: string;
    badge?: string | null;
    warrantyHeadline: string;
    warrantySubline: string;
    features: Array<{ title: string; desc: string }>;
  };
  selectedPackage: "standard" | "gold" | null;
  onSelectPackage: (pkg: "standard" | "gold") => void;
}

export default function PackageCards({
  estimate,
  silverConfig,
  goldConfig,
  selectedPackage,
  onSelectPackage,
}: PackageCardsProps) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {/* Silver Card */}
      <div
        onClick={() => onSelectPackage("standard")}
        className={`rounded-xl border-2 shadow-sm p-5 flex flex-col cursor-pointer transition-all ${
          selectedPackage === "standard"
            ? "border-gray-900 ring-2 ring-gray-900/10"
            : "border-gray-200"
        }`}
      >
        <div className="flex items-center gap-2 mb-1">
          <Shield className="h-5 w-5 text-gray-500" />
          <p className="text-base font-bold text-gray-700 uppercase tracking-wide">
            {silverConfig.name}
          </p>
        </div>
        <h3 className="text-base font-bold text-gray-900 mb-3">
          {silverConfig.title}
        </h3>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelectPackage("standard");
          }}
          className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-colors mb-4 ${
            selectedPackage === "standard"
              ? "bg-gray-900 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          {selectedPackage === "standard" ? "✓ Selected" : "Select"}
        </button>

        <p className="font-bold text-gray-900 text-lg mb-1">
          {silverConfig.warrantyHeadline}
        </p>
        <p className="text-[11px] text-gray-500 mb-4 leading-relaxed">
          {silverConfig.warrantySubline}
        </p>

        <ul className="text-[13px] text-gray-700 space-y-3 flex-1">
          {silverConfig.features.map((f) => (
            <li key={f.title} className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-gray-900 text-[13px]">{f.title}</p>
                <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{f.desc}</p>
              </div>
            </li>
          ))}
        </ul>

        <p className="text-3xl font-extrabold text-gray-900 mt-4">
          ${estimate.price.toLocaleString()}
        </p>
      </div>

      {/* Gold Card */}
      <div
        onClick={() => onSelectPackage("gold")}
        className={`rounded-xl border-2 shadow-sm p-5 flex flex-col cursor-pointer transition-all relative ${
          selectedPackage === "gold"
            ? "border-blue-600 ring-2 ring-blue-600/20 bg-blue-50/30"
            : "border-gray-200"
        }`}
      >
        {goldConfig.badge && (
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[11px] font-bold px-4 py-1 rounded-full whitespace-nowrap shadow-sm">
            {goldConfig.badge}
          </span>
        )}

        <div className="flex items-center gap-2 mb-1 mt-1">
          <Crown className="h-5 w-5 text-amber-500" />
          <p className="text-base font-bold text-amber-500 uppercase tracking-wide">
            {goldConfig.name}
          </p>
        </div>
        <h3 className="text-base font-bold text-gray-900 mb-3">
          {goldConfig.title}
        </h3>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelectPackage("gold");
          }}
          className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-colors mb-4 ${
            selectedPackage === "gold"
              ? "bg-blue-600 text-white"
              : "bg-blue-50 text-blue-700 hover:bg-blue-100"
          }`}
        >
          {selectedPackage === "gold" ? "✓ Selected" : "Select"}
        </button>

        <p className="font-bold text-gray-900 text-lg mb-1">
          {goldConfig.warrantyHeadline}
        </p>
        <p className="text-[11px] text-gray-500 mb-4 leading-relaxed">
          {goldConfig.warrantySubline}
        </p>

        <ul className="text-[13px] text-gray-700 space-y-3 flex-1">
          {goldConfig.features.map((f) => (
            <li key={f.title} className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-gray-900 text-[13px]">{f.title}</p>
                <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{f.desc}</p>
              </div>
            </li>
          ))}
        </ul>

        {estimate.transformationPrice != null ? (
          <p className="text-3xl font-extrabold text-blue-600 mt-4">
            ${estimate.transformationPrice.toLocaleString()}
          </p>
        ) : (
          <p className="text-sm font-semibold text-gray-400 mt-4">
            Contact us for pricing
          </p>
        )}
      </div>
    </div>
  );
}
