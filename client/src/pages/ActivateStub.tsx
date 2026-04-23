import { useParams, useLocation } from "wouter";
import { ArrowLeft, Rocket } from "lucide-react";

export default function ActivateStub() {
  const { slug } = useParams<{ slug: string }>();
  const [, navigate] = useLocation();

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center">
        <Rocket className="h-12 w-12 text-amber-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Activation Coming Soon
        </h1>
        <p className="text-gray-600 mb-2">
          Payment and go-live activation for{" "}
          <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono text-sm">
            {slug}
          </code>{" "}
          will be available here.
        </p>
        <p className="text-sm text-gray-500 mb-6">
          This step is not yet built. You'll be able to activate your estimate
          page and go live once payment is connected.
        </p>
        <button
          onClick={() => navigate(`/preview/${slug}`)}
          className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Preview
        </button>
      </div>
    </div>
  );
}
