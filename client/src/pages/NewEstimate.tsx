import { useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2, ImageIcon, Copy, Check, Link2, Mail, MessageSquare, ExternalLink, Camera } from "lucide-react";

const SERVICES = [
  { value: "", label: "Select service..." },
  { value: "Tub", label: "Bathtub Refinishing" },
  { value: "Shower", label: "Shower Refinishing" },
  { value: "Soaking Tub/Jacuzzi", label: "Jacuzzi / Soaking Tub" },
  { value: "Tub & Tile", label: "Tub & Tile Refinishing" },
];

const SERVICE_TYPE_MAP: Record<string, string> = {
  Tub: "bathtub",
  Shower: "shower",
  "Soaking Tub/Jacuzzi": "jacuzzi",
  "Tub & Tile": "tub_tile",
};

const DEFAULT_PRICES: Record<string, number> = {
  Tub: 299,
  Shower: 299,
  "Soaking Tub/Jacuzzi": 699,
  "Tub & Tile": 299,
};

const DURATIONS = ["3 Hours", "4 Hours", "5 Hours", "6 Hours", "Full Day"];

const COMPANY_NAME = "Bathtub Pros";
const DEFAULT_BATHROOM_SINK_PRICE = 199;
const DEFAULT_TILE_SURROUND_PRICE = DEFAULT_PRICES["Tub"] * 2;
const DEFAULT_OTHER_BATHROOM_PRICE = DEFAULT_PRICES["Tub"];
const DEFAULT_BOOKING_LINK = "https://app.squareup.com/appointments/buyer/widget/3za2737yf8u5y8/L09VQVGB6SQB7";

function compressImage(file: File, maxWidth = 3200, quality = 0.97): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let w = img.width;
      let h = img.height;
      if (w > maxWidth) {
        h = Math.round(h * (maxWidth / w));
        w = maxWidth;
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas not supported")); return; }
      ctx.drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      const base64 = dataUrl.split(",")[1];
      resolve({ base64, mimeType: "image/jpeg" });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Failed to load image")); };
    img.src = url;
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
  const [bathroomSinkPrice, setBathroomSinkPrice] = useState("");
  const [tileSurroundPrice, setTileSurroundPrice] = useState("");
  const [otherBathroomPrice, setOtherBathroomPrice] = useState("");
  const [notes, setNotes] = useState("");

  // File-based image state
  const [beforeFile, setBeforeFile] = useState<File | null>(null);
  const [beforePreview, setBeforePreview] = useState<string | null>(null);

  // Pipeline response state
  const [pipelineAfterUrl, setPipelineAfterUrl] = useState<string | null>(null);
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [savingEstimate, setSavingEstimate] = useState(false);
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
  const notifyGHL = trpc.estimates.notifyGHL.useMutation();

  const utils = trpc.useUtils();

  const isSubmitting = pipelineRunning || savingEstimate || createEstimate.isPending;

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

  async function handleRetryImage() {
    if (!beforeFile) return;
    setPipelineError(null);
    setPipelineAfterUrl(null);
    setPipelineRunning(true);
    try {
      const { base64: imageBase64, mimeType } = await compressImage(beforeFile);
      const currentServiceType = SERVICE_TYPE_MAP[service] || "bathtub";
      const pipelineResult = await testImage.mutateAsync({ imageBase64, mimeType, serviceType: currentServiceType });
      if (pipelineResult.status === "failed" || !pipelineResult.afterUrl) {
        setPipelineError(pipelineResult.error || "Image generation failed");
        toast.error(pipelineResult.error || "Image generation failed");
      } else {
        setPipelineAfterUrl(pipelineResult.afterUrl);
        toast.success("Image generated!");
      }
    } catch (err: any) {
      setPipelineError(err?.message || "Image generation failed");
      toast.error(err?.message || "Image generation failed");
    } finally {
      setPipelineRunning(false);
    }
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

    const PIPELINE_ALLOWED_TYPES = ["bathtub", "shower", "jacuzzi", "tub_tile"];
    const currentServiceType = SERVICE_TYPE_MAP[service] || "bathtub";

    try {
      const { base64: imageBase64, mimeType } = await compressImage(beforeFile);

      // Step 1: Run pipeline for approved service types if after image doesn't exist
      let afterUrl = pipelineAfterUrl;
      if (!afterUrl && PIPELINE_ALLOWED_TYPES.includes(currentServiceType)) {
        const pipelineResult = await testImage.mutateAsync({ imageBase64, mimeType, serviceType: currentServiceType });

        if (pipelineResult.status === "failed" || !pipelineResult.afterUrl) {
          const errMsg = pipelineResult.error || "Image generation failed";
          setPipelineError(errMsg);
          toast.error(errMsg);
          setPipelineRunning(false);
          return;
        }
        afterUrl = pipelineResult.afterUrl;
        setPipelineAfterUrl(afterUrl);
      }

      // Switch to estimate saving phase
      setPipelineRunning(false);
      setSavingEstimate(true);

      // Step 2: Upload before image to S3
      let beforeUrl: string;
      try {
        const uploadResult = await uploadBeforeImage.mutateAsync({ imageBase64, mimeType });
        if (uploadResult.url) {
          beforeUrl = uploadResult.url;
        } else {
          console.warn("[NewEstimate] S3 upload returned no URL, using data URI:", uploadResult.error);
          beforeUrl = `data:${mimeType};base64,${imageBase64}`;
        }
      } catch (uploadErr) {
        console.warn("[NewEstimate] S3 upload failed, using data URI:", uploadErr);
        beforeUrl = `data:${mimeType};base64,${imageBase64}`;
      }

      // Step 3: Create estimate record
      const nameParts = customerName.trim().split(/\s+/);
      const firstName = nameParts[0];
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : undefined;
      const transformPriceNum = parseInt(transformationPrice, 10);

      const result = await createEstimate.mutateAsync({
        name: customerName,
        firstName,
        lastName,
        service,
        serviceType: (SERVICE_TYPE_MAP[service] || "bathtub") as "bathtub" | "shower" | "jacuzzi" | "tub_tile",
        price: priceNum,
        beforeUrl,
        ...(afterUrl ? { afterUrl } : {}),
        ...(email.trim() ? { email: email.trim() } : {}),
        ...(phone.trim() ? { phone: phone.trim() } : {}),
        ...(address.trim() ? { address: address.trim() } : {}),
        duration,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        ...(!isNaN(transformPriceNum) && transformPriceNum > 0 ? { transformationPrice: transformPriceNum } : {}),
        bathroomSinkPrice: bathroomSinkPrice ? parseInt(bathroomSinkPrice, 10) : DEFAULT_BATHROOM_SINK_PRICE,
        tileSurroundPrice: tileSurroundPrice ? parseInt(tileSurroundPrice, 10) : DEFAULT_TILE_SURROUND_PRICE,
        otherBathroomPrice: otherBathroomPrice ? parseInt(otherBathroomPrice, 10) : DEFAULT_OTHER_BATHROOM_PRICE,
        bookingLink: DEFAULT_BOOKING_LINK,
      });

      if (result.slug) {
        setGeneratedSlug(result.slug);
      }

      utils.estimates.list.invalidate();
    } catch (err: any) {
      const errMsg = err?.message || "Something went wrong";
      console.error("[NewEstimate] Error:", errMsg);
      setPipelineError(errMsg);
      toast.error(errMsg);
    }
    setPipelineRunning(false);
    setSavingEstimate(false);
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
    if (!estimateUrl || !phone || !generatedSlug) return;
    // Fire GHL notification (fire-and-forget — don't block native handler)
    notifyGHL.mutate({ slug: generatedSlug });
    const body = encodeURIComponent(
      `Hi ${customerName.split(" ")[0]}, here is your estimate from ${COMPANY_NAME}: ${estimateUrl}`
    );
    window.open(`sms:${phone}?body=${body}`, "_blank");
  }

  function handleSendEmail() {
    if (!estimateUrl || !generatedSlug) return;
    // Fire GHL notification (fire-and-forget — don't block native handler)
    notifyGHL.mutate({ slug: generatedSlug });
    const to = email || "";
    const subject = encodeURIComponent(`Your ${COMPANY_NAME} Estimate`);
    const body = encodeURIComponent(
      `Hi ${customerName.split(" ")[0]},\n\nHere is your personalized estimate from ${COMPANY_NAME}:\n${estimateUrl}\n\nThank you!`
    );
    window.open(`mailto:${to}?subject=${subject}&body=${body}`, "_blank");
  }

  return (
    <div className="p-4 sm:p-8 max-w-2xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">New Estimate</h1>
        <p className="text-sm text-gray-500 mt-1">
          Fill in the details to generate a personalized estimate link.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Customer Info */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6">
          <h2 className="font-bold text-gray-900 mb-5">Customer Info</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6">
          <h2 className="font-bold text-gray-900 mb-5">Job Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label={((SERVICE_TYPE_MAP[service] || "bathtub") === "bathtub") ? "Standard Plan Price" : "Price"} required>
              <input
                type="number"
                placeholder={`e.g. $${DEFAULT_PRICES[service] || 299}`}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                min={1}
                className="form-input"
                required
              />
            </Field>
            {["bathtub", "shower", "jacuzzi", "tub_tile"].includes(SERVICE_TYPE_MAP[service]) && (
              <Field label="Gold Plan Price">
                <input
                  type="number"
                  placeholder={`e.g. $${(DEFAULT_PRICES[service] || 299) + 100}`}
                  value={transformationPrice}
                  onChange={(e) => setTransformationPrice(e.target.value)}
                  min={1}
                  className="form-input"
                />
              </Field>
            )}
          </div>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Bathroom Sink Upsell">
              <input
                type="number"
                placeholder={`e.g. $${DEFAULT_BATHROOM_SINK_PRICE}`}
                value={bathroomSinkPrice}
                onChange={(e) => setBathroomSinkPrice(e.target.value)}
                min={1}
                className="form-input"
              />
            </Field>
            {service === "Tub" && (
              <Field label="Tile Surround Upsell">
                <input
                  type="number"
                  placeholder={`e.g. $${DEFAULT_TILE_SURROUND_PRICE}`}
                  value={tileSurroundPrice}
                  onChange={(e) => setTileSurroundPrice(e.target.value)}
                  min={1}
                  className="form-input"
                />
              </Field>
            )}
            {service === "Shower" && (
              <Field label="Other Bathtub Upsell">
                <input
                  type="number"
                  placeholder={`e.g. $${DEFAULT_OTHER_BATHROOM_PRICE}`}
                  value={otherBathroomPrice}
                  onChange={(e) => setOtherBathroomPrice(e.target.value)}
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
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6">
          <h2 className="font-bold text-gray-900 mb-1">Before & After Photos</h2>
          <p className="text-sm text-gray-500 mb-5">
            Take a photo or upload from your gallery. These appear on the customer's estimate page.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
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
                  <img src={beforePreview} alt="Before preview" className="w-full max-h-60 object-cover rounded" />
                ) : (
                  <>
                    <Camera className="h-8 w-8" />
                    <span className="text-sm">Take Photo or Upload</span>
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
                  <div className="flex flex-col items-center gap-2">
                    <img src={pipelineAfterUrl} alt="After — generated" className="w-full max-h-60 object-cover rounded" />
                    <button
                      type="button"
                      onClick={handleRetryImage}
                      disabled={pipelineRunning}
                      className="px-4 py-1.5 bg-gray-600 hover:bg-gray-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                    >
                      {pipelineRunning ? "Regenerating..." : "Regenerate"}
                    </button>
                  </div>
                ) : pipelineRunning ? (
                  <>
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                    <span className="text-sm text-blue-500">Generating image...</span>
                  </>
                ) : pipelineError ? (
                  <>
                    <ImageIcon className="h-8 w-8 text-red-300" />
                    <span className="text-sm text-red-500">Generation failed</span>
                    <button
                      type="button"
                      onClick={handleRetryImage}
                      className="mt-1 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors"
                    >
                      Retry
                    </button>
                  </>
                ) : (
                  <>
                    <ImageIcon className="h-8 w-8" />
                    <span className="text-sm text-gray-400">Auto-generated after photo</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Submit / Send Estimate */}
        {estimateUrl ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6">
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
                type="button"
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
                type="button"
                className="flex items-center justify-center gap-1.5 text-sm font-medium border border-gray-200 bg-white rounded-lg py-2.5 text-gray-600 hover:bg-gray-100 hover:border-gray-300 transition-colors shadow-sm"
                onClick={() => window.open(estimateUrl, "_blank")}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Preview
              </button>
              <button
                type="button"
                className="flex items-center justify-center gap-1.5 text-sm font-semibold border border-green-300 bg-green-50 rounded-lg py-2.5 text-green-700 hover:bg-green-100 hover:border-green-400 transition-colors shadow-sm disabled:opacity-40"
                onClick={handleSendSMS}
                disabled={!phone}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Send SMS
              </button>
              <button
                type="button"
                className="flex items-center justify-center gap-1.5 text-sm font-medium border border-gray-200 bg-white rounded-lg py-2.5 text-gray-600 hover:bg-gray-100 hover:border-gray-300 transition-colors shadow-sm"
                onClick={handleSendEmail}
              >
                <Mail className="h-3.5 w-3.5" />
                Send Email
              </button>
            </div>
          </div>
        ) : (
          <button
            type="submit"
            className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 rounded-xl text-base transition-colors shadow-sm disabled:opacity-50"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                {pipelineRunning ? "Generating Image..." : savingEstimate ? "Generating Estimate..." : "Generating Estimate..."}
              </span>
            ) : (
              "Generate Estimate Link"
            )}
          </button>
        )}
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
