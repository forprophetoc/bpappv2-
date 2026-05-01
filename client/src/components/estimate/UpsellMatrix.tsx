const SERVICE_UPSELL_MATRIX: Record<string, string[]> = {
  bathtub: ["bathroomSink", "tileSurround"],
  tub_tile: ["bathroomSink"],
  shower: ["bathroomSink", "otherBathroom"],
  jacuzzi: ["bathroomSink"],
};

const UPSELL_META: Record<string, { label: string; subLabel: string }> = {
  bathroomSink: {
    label: "Bathroom Sink (Perfect Match)",
    subLabel: "Matched to your tub for a clean, consistent finish",
  },
  tileSurround: {
    label: "Tile Surround",
    subLabel: "While the crew is set up — fresh tile to match the new tub",
  },
  otherBathroom: {
    label: "Other Bathroom",
    subLabel: "While we're at the home — same-visit savings on a second bathroom",
  },
};

interface UpsellMatrixProps {
  estimate: {
    bathroomSinkPrice: number | null;
    tileSurroundPrice: number | null;
    otherBathroomPrice: number | null;
  };
  serviceType: string;
  selectedUpsells: Record<string, boolean>;
  onToggleUpsell: (id: string) => void;
  recommendedUpsells: string[];
}

export default function UpsellMatrix({
  estimate,
  serviceType,
  selectedUpsells,
  onToggleUpsell,
  recommendedUpsells,
}: UpsellMatrixProps) {
  const upsellIds = SERVICE_UPSELL_MATRIX[serviceType];
  if (!upsellIds || upsellIds.length === 0) return null;

  const priceMap: Record<string, number | null> = {
    bathroomSink: estimate.bathroomSinkPrice,
    tileSurround: estimate.tileSurroundPrice,
    otherBathroom: estimate.otherBathroomPrice,
  };

  const visibleRows = upsellIds.filter((id) => {
    const price = priceMap[id];
    return price != null && price > 0;
  });

  if (visibleRows.length === 0) return null;

  return (
    <div className="rounded-xl border border-gray-200 shadow-sm p-4">
      <h2 className="text-base font-bold text-gray-900 mb-1">
        Complete the Look
      </h2>
      <p className="text-[13px] text-gray-500 mb-4">
        Most customers add one of these while we're already there.
      </p>

      <div className="space-y-3">
        {visibleRows.map((id) => {
          const meta = UPSELL_META[id];
          const price = priceMap[id]!;
          const checked = !!selectedUpsells[id];
          const isRecommended = recommendedUpsells.includes(id);

          return (
            <label
              key={id}
              className={`flex items-center justify-between gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                checked
                  ? "border-blue-600 bg-blue-50"
                  : "border-gray-200"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggleUpsell(id)}
                  className="h-5 w-5 shrink-0 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">
                    {meta.label}
                    {isRecommended && (
                      <span className="ml-2 inline-block text-[10px] font-bold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full align-middle">
                        Recommended for you
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-gray-500">{meta.subLabel}</p>
                </div>
              </div>
              <span className="text-base font-bold text-gray-900 shrink-0">
                +${price.toLocaleString()}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
