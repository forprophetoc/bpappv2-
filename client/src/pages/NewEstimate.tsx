import { useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2, ImageIcon, Copy, Check, Link2, Mail, MessageSquare, ExternalLink } from "lucide-react";

const SERVICES = [
  { value: "", label: "Select service..." },
  { value: "Tub", label: "Bathtub Refinishing" },
  { value: "Shower", label: "Shower Refinishing" },
  { value: "Soaking Tub/Jacuzzi", label: "Jacuzzi / Soaking Tub" },
];

const SERVICE_TYPE_MAP: Record<string, string> = {
  Tub: "bathtub",
  Shower: "shower",
  "Soaking Tub/Jacuzzi": "jacuzzi",
};

const DEFAULT_PRICES: Record<string, number> = {
  Tub: 449,
  Shower: 399,
  "Soaking Tub/Jacuzzi": 699,
};

const DURATIONS = ["3 Hours", "4 Hours", "5 Hours", "6 Hours", "Full Day"];

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function NewEstimate() {
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [service, setService] = useState("");
  const [duration, setDuration] = useState("3 Hours");
  const [price, setPrice] = useState("");
  const [transformationPrice, setTransformationPrice] = useState("");
  const [notes, setNotes] = useState("");

  // File-based image state
  const [beforeFile, setBeforeFile] = useState<File | null>(null);
  const [beforePreview, setBeforePreview] = useState<string | null>(null);

  // Pipeline response state
  const [pipelineAfterUrl, setPipelineAfterUrl] = useState<string | null>(null);
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [pipelineError, setPipelineError] = useState<string | null>(null);

  // Estimate completion state
  const [generatedSlug, setGeneratedSlug] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const beforeInputRef = useRef<HTMLInputElement>(null);

  const testImage = trpc.pipeline.testImage.useMutation();
  const uploadBeforeImage = trpc.pipeline.uploadBeforeImage.useMutation();
  const createEstimate = trpc.estimates.create.useMutation({
    onSuccess: (data) => {
      setGeneratedSlug(data.slug);
      toast.success("Estimate link created!");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to create estimate");
    },
  });

  const utils = trpc.useUtils();

  const isSubmitting = pipelineRunning || createEstimate.isPending;

  function handleServiceChange(val: string) {
    setService(val);
    if (DEFAULT_PRICES[val]) {
      setPrice(String(DEFAULT_PRICES[val]));
    }
    setGeneratedSlug(null);
  }

  function handleBeforeFile(file: File | undefined) {
    if (!file) return;
    setPipelineAfterUrl(null);
    setPipelineError(null);
    setGeneratedSlug(null);

    const preview = URL.createObjectURL(file);
    if (beforePreview) URL.revokeObjectURL(beforePreview);
    setBeforePreview(preview);
    setBeforeFile(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const priceNum = parseInt(price, 10);
    if (!customerName || !service || isNaN(priceNum)) {
      toast.error("Please fill in Customer Name, Service, and Price");
      return;
    }
    if (!beforeFile) {
      toast.error("Please upload a Before Photo");
      return;
    }

    setPipelineRunning(true);
    setPipelineError(null);
    setGeneratedSlug(null);

    const PIPELINE_ALLOWED_TYPES = ["bathtub", "shower", "jacuzzi"];
    const currentServiceType = SERVICE_TYPE_MAP[service] || "bathtub";

    try {
      const imageBase64 = await fileToBase64(beforeFile);
      const mimeType = beforeFile.type || "image/png";

      // Step 1: Run pipeline ONLY for approved service types and if after image doesn't already exist
      let afterUrl = pipelineAfterUrl;
      if (!afterUrl && PIPELINE_ALLOWED_TYPES.includes(currentServiceType)) {
        const pipelineResult = await testImage.mutateAsync({ imageBase64, mimeType, serviceType: currentServiceType });

        if (pipelineResult.status === "failed" || !pipelineResult.afterUrl) {
          const errMsg = pipelineResult.error || "Pipeline failed to generate after image";
          setPipelineError(errMsg);
          toast.error(errMsg);
          setPipelineRunning(false);
          return;
        }
        afterUrl = pipelineResult.afterUrl;
        setPipelineAfterUrl(afterUrl);
      }

      // Step 2: Upload before image to S3 for storage (fall back to data URI)
      let beforeUrl: string;
      const uploadResult = await uploadBeforeImage.mutateAsync({ imageBase64, mimeType });
      if (uploadResult.url) {
        beforeUrl = uploadResult.url;
      } else {
        console.warn("[NewEstimate] S3 upload failed, using data URI for before image:", uploadResult.error);
        beforeUrl = `data:${mimeType};base64,${imageBase64}`;
      }

      // Step 3: Create estimate record with both URLs
      const nameParts = customerName.trim().split(/\s+/);
      const firstName = nameParts[0];
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : undefined;

      const transformPriceNum = parseInt(transformationPrice, 10);

      const result = await createEstimate.mutateAsync({
        name: customerName,
        firstName,
        lastName,
        service,
        serviceType: (SERVICE_TYPE_MAP[service] || "bathtub") as "bathtub" | "shower" | "jacuzzi",
        price: priceNum,
        beforeUrl,
        ...(afterUrl ? { afterUrl } : {}),
        ...(email.trim() ? { email: email.trim() } : {}),
        ...(phone.trim() ? { phone: phone.trim() } : {}),
        ...(address.trim() ? { address: address.trim() } : {}),
        duration,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        ...(!isNaN(transformPriceNum) && transformPriceNum > 0 ? { transformationPrice: transformPriceNum } : {}),
        bookingLink: "https://api.leadconnectorhq.com/widget/booking/Pbt4MIKvOcDf1sLjqaMS",
      });

      // Set slug directly from result (don't rely solely on onSuccess callback)
      if (result.slug) {
        setGeneratedSlug(result.slug);
      }

      // Invalidate dashboard/jobs queries so they reflect the new estimate
      utils.estimates.list.invalidate();
    } catch (err: any) {
      const errMsg = err?.message || "Something went wrong";
      setPipelineError(errMsg);
      toast.error(errMsg);
    } finally {
      setPipelineRunning(false);
    }
  }

  const estimateUrl = generatedSlug
    ? `${window.location.origin}/estimate/${generatedSlug}`
    : null;

  async function handleCopy() {
    if (!estimateUrl) return;
    await navigator.clipboard.writeText(estimateUrl);
    setCopied(true);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  }

  function handleSendSMS() {
    if (!estimateUrl || !phone) return;
    const body = encodeURIComponent(
      `Hi ${customerName.split(" ")[0]}, here is your estimate from Bathtub Pros: ${estimateUrl}`
    );
    window.open(`sms:${phone}?body=${body}`, "_blank");
  }

  function handleSendEmail() {
    if (!estimateUrl) return;
    const to = email || "";
    const subject = encodeURIComponent(`Your Bathtub Pros Estimate`);
    const body = encodeURIComponent(
      `Hi ${customerName.split(" ")[0]},\n\nHere is your personalized estimate from Bathtub Pros:\n${estimateUrl}\n\nThank you!`
    );
    window.open(`mailto:${to}?subject=${subject}&body=${body}`, "_blank");
  }

  return (
    <div className="p-8 max-w-2xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">New Estimate</h1>
        <p className="text-sm text-gray-500 mt-1">
          Fill in the details to generate a personalized estimate link.
        </p>
      </div>

      {/* Success banner — estimate actions */}
      {estimateUrl && (
        <div className="mb-6 bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="font-bold text-gray-900 mb-1 flex items-center gap-2">
            <Link2 className="h-4 w-4 shrink-0 text-blue-600" />
            Customer Estimate Link Ready
          </h2>
          <p className="text-sm text-gray-500 mb-5">Share this link directly with your customer.</p>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={estimateUrl}
              className="form-input flex-1 font-mono"
              style={{ background: "#f9fafb", color: "#374151" }}
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <button
              onClick={handleCopy}
              className={`shrink-0 px-3 py-2 rounded-lg text-sm font-semibold text-white transition-colors ${
                copied ? "bg-green-600" : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {copied ? <Check className="h-3.5 w-3.5 inline mr-1" /> : <Copy className="h-3.5 w-3.5 inline mr-1" />}
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 bg-gray-50 rounded-lg p-3">
            <button
              className="flex items-center justify-center gap-1.5 text-sm font-medium border border-gray-200 bg-white rounded-lg py-2.5 text-gray-600 hover:bg-gray-100 hover:border-gray-300 transition-colors shadow-sm"
              onClick={() => window.open(estimateUrl, "_blank")}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Preview
            </button>
            <button
              className="flex items-center justify-center gap-1.5 text-sm font-semibold border border-green-300 bg-green-50 rounded-lg py-2.5 text-green-700 hover:bg-green-100 hover:border-green-400 transition-colors shadow-sm disabled:opacity-40"
              onClick={handleSendSMS}
              disabled={!phone}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Send SMS
            </button>
            <button
              className="flex items-center justify-center gap-1.5 text-sm font-medium border border-gray-200 bg-white rounded-lg py-2.5 text-gray-600 hover:bg-gray-100 hover:border-gray-300 transition-colors shadow-sm"
              onClick={handleSendEmail}
            >
              <Mail className="h-3.5 w-3.5" />
              Send Email
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Customer Info */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="font-bold text-gray-900 mb-5">Customer Info</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Customer Name" required>
              <input
                type="text"
                placeholder="e.g. John Smith"
                value={customerName}
                onChange={(e) => { setCustomerName(e.target.value); setGeneratedSlug(null); }}
                className="form-input"
                required
              />
            </Field>
            <Field label="Phone Number">
              <input
                type="tel"
                placeholder="e.g. 239-555-1234"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="form-input"
              />
            </Field>
            <Field label="Email Address">
              <input
                type="email"
                placeholder="e.g. john@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-input"
              />
            </Field>
            <Field label="Address">
              <input
                type="text"
                placeholder="e.g. 123 Main St. Naples FL"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="form-input"
              />
            </Field>
          </div>
        </div>

        {/* Job Details */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="font-bold text-gray-900 mb-5">Job Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Service" required>
              <select
                value={service}
                onChange={(e) => handleServiceChange(e.target.value)}
                className="form-input"
                required
              >
                {SERVICES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Job Duration">
              <select
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="form-input"
              >
                {DURATIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <Field label="Price" required>
              <input
                type="number"
                placeholder="e.g. $449"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                min={1}
                className="form-input"
                required
              />
            </Field>
            {(SERVICE_TYPE_MAP[service] || "bathtub") === "bathtub" && (
              <Field label="Transformation Price">
                <input
                  type="number"
                  placeholder="e.g. $200"
                  value={transformationPrice}
                  onChange={(e) => setTransformationPrice(e.target.value)}
                  min={1}
                  className="form-input"
                />
              </Field>
            )}
          </div>
          <div className="mt-4">
            <Field label="Notes (internal only)">
              <textarea
                placeholder="e.g. Tub color: white, access code: 1234, customer prefers morning..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="form-input resize-y"
              />
            </Field>
          </div>
        </div>

        {/* Before & After Photos */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="font-bold text-gray-900 mb-1">Before & After Photos</h2>
          <p className="text-sm text-gray-500 mb-5">
            Upload photos from your phone or paste a URL. These appear on the customer's estimate page.
          </p>
          <div className="grid grid-cols-2 gap-6">
            {/* Before Photo */}
            <div className="space-y-2">
              <p className="text-sm font-semibold text-gray-700">Before Photo</p>
              <input
                ref={beforeInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleBeforeFile(e.target.files?.[0])}
              />
              <button
                type="button"
                onClick={() => beforeInputRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-300 rounded-xl py-8 flex flex-col items-center gap-2 text-gray-400 hover:border-green-400 hover:text-green-500 transition-colors cursor-pointer"
              >
                {beforePreview ? (
                  <img src={beforePreview} alt="Before preview" className="h-20 object-cover rounded" />
                ) : (
                  <>
                    <ImageIcon className="h-8 w-8" />
                    <span className="text-sm">Tap to upload or drag photo</span>
                  </>
                )}
              </button>
              {beforeFile && (
                <p className="text-xs text-gray-400 truncate">{beforeFile.name}</p>
              )}
            </div>

            {/* After Photo — pipeline generated */}
            <div className="space-y-2">
              <p className="text-sm font-semibold text-gray-700">After Photo</p>
              <div className="w-full border-2 border-dashed border-gray-200 rounded-xl py-8 flex flex-col items-center gap-2 text-gray-300 bg-gray-50">
                {pipelineAfterUrl ? (
                  <img src={pipelineAfterUrl} alt="After — generated" className="h-20 object-cover rounded" />
                ) : pipelineRunning ? (
                  <>
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                    <span className="text-sm text-blue-500">Pipeline generating...</span>
                  </>
                ) : pipelineError ? (
                  <>
                    <ImageIcon className="h-8 w-8 text-red-300" />
                    <span className="text-sm text-red-500">Generation failed</span>
                  </>
                ) : (
                  <>
                    <ImageIcon className="h-8 w-8" />
                    <span className="text-sm text-gray-400">Generated by pipeline</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 rounded-xl text-base transition-colors shadow-sm disabled:opacity-50"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              {pipelineRunning ? "Running Pipeline..." : "Saving Estimate..."}
            </span>
          ) : (
            "Generate Estimate Link"
          )}
        </button>
      </form>
    </div>
  );
}

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
