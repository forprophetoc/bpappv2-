import { useState, useEffect } from "react";
import { X } from "lucide-react";

// TODO: import from UpsellMatrix once UpsellMatrix exports UPSELL_META as a named export.
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

const QUESTIONS = [
  {
    key: "q1" as const,
    text: "How long do you plan to be in the home?",
    options: [
      { label: "Selling within 2 years", value: "selling" as const },
      { label: "Staying 2–10 years", value: "midterm" as const },
      { label: "This is our long-term home", value: "longterm" as const },
    ],
  },
  {
    key: "q2" as const,
    text: "Who uses this bathroom?",
    options: [
      { label: "Daily, family use", value: "family" as const },
      { label: "Mostly guests", value: "guests" as const },
      { label: "Rental tenants", value: "rental" as const },
    ],
  },
  {
    key: "q3" as const,
    text: "Where's the home?",
    options: [
      { label: "Coastal", value: "coastal" as const },
      { label: "Inland Florida", value: "inland" as const },
      { label: "Other", value: "other" as const },
    ],
  },
];

const GOLD_WEIGHTS = {
  q1: { selling: -2, midterm: 1, longterm: 2 },
  q2: { family: 2, guests: -1, rental: 1 },
  q3: { coastal: 2, inland: 0, other: 0 },
};

const UPSELL_WEIGHTS = {
  q1: { selling: 0, midterm: 1, longterm: 2 },
  q2: { family: 2, guests: 0, rental: 0 },
  q3: { coastal: 1, inland: 0, other: 0 },
};

const ANSWER_PHRASES: Record<string, string> = {
  selling: "Selling within two years",
  midterm: "Staying mid-term",
  longterm: "Long-term home",
  family: "daily family use",
  guests: "mostly guest use",
  rental: "rental use",
  coastal: "and coastal",
  inland: "and inland Florida",
  other: "and your location",
};

type Answers = {
  q1: "selling" | "midterm" | "longterm" | null;
  q2: "family" | "guests" | "rental" | null;
  q3: "coastal" | "inland" | "other" | null;
};

interface PlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (rec: { package: "standard" | "gold"; recommendedUpsells: string[] }) => void;
  onChooseForMyself: (rec: { package: "standard" | "gold"; recommendedUpsells: string[] }) => void;
  availableUpsellIds: string[];
  silverPrice: number;
  goldPrice: number | null;
}

function buildReasoning(
  answers: { q1: string; q2: string; q3: string },
  recommendation: "standard" | "gold"
): string {
  const q1Phrase = ANSWER_PHRASES[answers.q1] || "";
  const q2Phrase = ANSWER_PHRASES[answers.q2] || "";
  const q3Phrase = ANSWER_PHRASES[answers.q3] || "";

  const situation = `${q1Phrase}, ${q2Phrase}, ${q3Phrase}`;

  if (recommendation === "gold") {
    return `${situation} — the lifetime warranty and salt-air-grade coating are designed for exactly this.`;
  }
  return `${situation} — Silver's 3-year warranty covers what you need without paying for protection you won't use.`;
}

export default function PlanModal({
  isOpen,
  onClose,
  onConfirm,
  onChooseForMyself,
  availableUpsellIds,
  silverPrice,
  goldPrice,
}: PlanModalProps) {
  const [step, setStep] = useState<"questions" | "result">("questions");
  const [answers, setAnswers] = useState<Answers>({ q1: null, q2: null, q3: null });

  // Reset state every time the modal opens so the questionnaire restarts fresh
  useEffect(() => {
    if (isOpen) {
      setStep("questions");
      setAnswers({ q1: null, q2: null, q3: null });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const allAnswered = answers.q1 !== null && answers.q2 !== null && answers.q3 !== null;

  const computeRecommendation = () => {
    const a = answers as { q1: string; q2: string; q3: string };
    const goldScore =
      GOLD_WEIGHTS.q1[a.q1 as keyof typeof GOLD_WEIGHTS.q1] +
      GOLD_WEIGHTS.q2[a.q2 as keyof typeof GOLD_WEIGHTS.q2] +
      GOLD_WEIGHTS.q3[a.q3 as keyof typeof GOLD_WEIGHTS.q3];

    const upsellScore =
      UPSELL_WEIGHTS.q1[a.q1 as keyof typeof UPSELL_WEIGHTS.q1] +
      UPSELL_WEIGHTS.q2[a.q2 as keyof typeof UPSELL_WEIGHTS.q2] +
      UPSELL_WEIGHTS.q3[a.q3 as keyof typeof UPSELL_WEIGHTS.q3];

    const pkg: "standard" | "gold" = goldScore >= 1 ? "gold" : "standard";

    let recommendedUpsells: string[] = [];
    if (upsellScore >= 3) {
      recommendedUpsells = [...availableUpsellIds];
    } else if (upsellScore >= 1) {
      recommendedUpsells = availableUpsellIds.length > 0 ? [availableUpsellIds[0]] : [];
    }

    const reasoning = buildReasoning(a, pkg);

    return { pkg, recommendedUpsells, reasoning };
  };

  const handleSeeRecommendation = () => {
    if (allAnswered) setStep("result");
  };

  const rec = allAnswered ? computeRecommendation() : null;

  const handleConfirm = () => {
    if (!rec) return;
    onConfirm({ package: rec.pkg, recommendedUpsells: rec.recommendedUpsells });
    onClose();
  };

  const handleChooseForMyself = () => {
    if (!rec) return;
    onChooseForMyself({ package: rec.pkg, recommendedUpsells: rec.recommendedUpsells });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop — visible on md+ only */}
      <div
        className="hidden md:block fixed inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal panel */}
      <div className="fixed inset-0 bg-white overflow-y-auto md:relative md:z-10 md:bg-transparent md:flex md:items-center md:justify-center md:min-h-screen md:p-4">
        <div className="min-h-full md:min-h-0 md:bg-white md:rounded-xl md:shadow-xl md:max-w-2xl md:w-full md:max-h-[90vh] md:overflow-y-auto">
          {/* Close button */}
          <div className="flex justify-end p-4">
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              style={{ minWidth: 44, minHeight: 44 }}
            >
              <X className="h-6 w-6 text-gray-500" />
            </button>
          </div>

          <div className="px-5 pb-8">
            {step === "questions" && (
              <>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-900">
                    Help me choose my plan
                  </h2>
                  <button
                    type="button"
                    onClick={onClose}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium whitespace-nowrap ml-4"
                  >
                    Skip — just show me both options
                  </button>
                </div>

                <div className="space-y-8">
                  {QUESTIONS.map((q) => (
                    <div key={q.key}>
                      <p className="text-sm font-semibold text-gray-800 mb-3">
                        {q.text}
                      </p>
                      <div className="space-y-2">
                        {q.options.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() =>
                              setAnswers((prev) => ({ ...prev, [q.key]: opt.value }))
                            }
                            className={`w-full text-left px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all ${
                              answers[q.key] === opt.value
                                ? "border-blue-600 bg-blue-50 text-blue-700"
                                : "border-gray-200 text-gray-700 hover:border-gray-300"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  disabled={!allAnswered}
                  onClick={handleSeeRecommendation}
                  className={`w-full mt-8 py-3.5 rounded-full text-base font-bold transition-colors ${
                    allAnswered
                      ? "bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                      : "bg-gray-200 text-gray-400 cursor-not-allowed"
                  }`}
                >
                  See my recommendation
                </button>
              </>
            )}

            {step === "result" && rec && (
              <>
                <h2 className="text-xl font-bold text-gray-900 mb-2">
                  Based on what you told us — we recommend the{" "}
                  {rec.pkg === "gold" ? "Gold" : "Silver"} Package.
                </h2>
                <p className="text-sm text-gray-600 leading-relaxed mb-6">
                  {rec.reasoning}
                </p>

                {/* Package preview cards */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                  {/* Silver preview */}
                  <div
                    className={`rounded-xl border-2 p-4 text-center transition-all ${
                      rec.pkg === "standard"
                        ? "border-gray-900 ring-2 ring-gray-900/10 scale-105"
                        : "border-gray-200 opacity-60"
                    }`}
                  >
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                      Silver
                    </p>
                    <p className="text-2xl font-extrabold text-gray-900">
                      ${silverPrice.toLocaleString()}
                    </p>
                  </div>

                  {/* Gold preview */}
                  <div
                    className={`rounded-xl border-2 p-4 text-center transition-all ${
                      rec.pkg === "gold"
                        ? "border-blue-600 ring-2 ring-blue-600/20 bg-blue-50/30 scale-105"
                        : "border-gray-200 opacity-60"
                    }`}
                  >
                    <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">
                      Gold
                    </p>
                    {goldPrice != null ? (
                      <p className="text-2xl font-extrabold text-blue-600">
                        ${goldPrice.toLocaleString()}
                      </p>
                    ) : (
                      <p className="text-sm font-semibold text-gray-400">
                        Contact us for pricing
                      </p>
                    )}
                  </div>
                </div>

                {/* Upsell suggestions */}
                {rec.recommendedUpsells.length > 0 && (
                  <div className="mb-6">
                    <p className="text-sm font-semibold text-gray-800 mb-2">
                      While we're already there, we also suggest:
                    </p>
                    <ul className="space-y-1.5">
                      {rec.recommendedUpsells.map((id) => {
                        const meta = UPSELL_META[id];
                        if (!meta) return null;
                        return (
                          <li key={id} className="text-sm text-gray-700">
                            <span className="font-medium">{meta.label}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                {/* Action buttons */}
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={handleConfirm}
                    className="w-full py-3.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-base font-bold transition-colors"
                  >
                    Confirm Recommendation
                  </button>
                  <button
                    type="button"
                    onClick={handleChooseForMyself}
                    className="w-full py-3.5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 text-base font-semibold transition-colors"
                  >
                    Choose for Myself
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
