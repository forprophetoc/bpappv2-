import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Copy, Check, Link2, ArrowLeft, Loader2 } from "lucide-react";

function nameToSlugPreview(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s]+/g, "-")
    .replace(/-{2,}/g, "-");
}

function OptionalBadge() {
  return (
    <span className="ml-1.5 text-xs font-normal text-gray-400 tracking-normal">
      optional
    </span>
  );
}

export default function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();

  // Form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [service, setService] = useState("Refinishing");
  const [price, setPrice] = useState("");
  const [beforeUrl, setBeforeUrl] = useState("");
  const [companyLogoUrl, setCompanyLogoUrl] = useState("");
  const [ghlContactId, setGhlContactId] = useState("");

  // Result state
  const [generatedSlug, setGeneratedSlug] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const createEstimate = trpc.estimates.create.useMutation({
    onSuccess: (data) => {
      setGeneratedSlug(data.slug);
      toast.success("Estimate link created!");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to create estimate");
    },
  });

  const estimateUrl = generatedSlug
    ? `${window.location.origin}/estimate/${generatedSlug}`
    : null;

  const slugPreview = name ? nameToSlugPreview(name) : "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const priceNum = parseInt(price, 10);
    if (!name || !service || isNaN(priceNum) || !beforeUrl) {
      toast.error("Please fill in all required fields");
      return;
    }
    createEstimate.mutate({
      name,
      service,
      price: priceNum,
      beforeUrl,
      ...(email.trim() ? { email: email.trim() } : {}),
      ...(companyLogoUrl.trim() ? { companyLogoUrl: companyLogoUrl.trim() } : {}),
      ...(ghlContactId.trim() ? { ghlContactId: ghlContactId.trim() } : {}),
      bookingLink: "https://api.leadconnectorhq.com/widget/booking/Pbt4MIKvOcDf1sLjqaMS",
    });
  }

  async function handleCopy() {
    if (!estimateUrl) return;
    await navigator.clipboard.writeText(estimateUrl);
    setCopied(true);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate("/")}
          className="text-gray-400 hover:text-gray-700 transition-colors"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 text-white font-bold text-xs px-1.5 py-0.5 rounded">BP</div>
          <span className="font-semibold text-gray-800 text-sm">Bathtub Pros</span>
        </div>
        {id && <span className="ml-auto text-xs text-gray-400 font-mono">Job #{id}</span>}
      </header>

      <div className="max-w-xl mx-auto px-4 py-8 space-y-5">

        {/* Page title */}
        <div>
          <h1 className="text-xl font-bold text-gray-900">Generate Estimate Link</h1>
          <p className="text-sm text-gray-500 mt-1">
            Fill in the job details to create a shareable estimate URL for your customer.
          </p>
        </div>

        {/* Generated URL — shown prominently once created */}
        {estimateUrl && (
          <Card className="border-2 border-green-500 bg-green-50 shadow-sm">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-green-800 flex items-center gap-2 text-sm font-semibold">
                <Link2 className="h-4 w-4 shrink-0" />
                Customer Estimate Link Ready
              </CardTitle>
              <CardDescription className="text-green-700 text-xs">
                Share this link directly with your customer.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={estimateUrl}
                  className="font-mono text-xs bg-white border-green-300 text-green-900 flex-1"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <Button
                  onClick={handleCopy}
                  size="sm"
                  className={`shrink-0 transition-all ${copied ? "bg-green-600 hover:bg-green-600" : "bg-blue-600 hover:bg-blue-700"}`}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  <span className="ml-1.5">{copied ? "Copied!" : "Copy"}</span>
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={() => window.open(estimateUrl, "_blank")}
              >
                Preview Estimate Page →
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Form */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3 pt-5 px-5">
            <CardTitle className="text-base font-semibold">Estimate Details</CardTitle>
            <CardDescription className="text-xs text-gray-500">
              The customer name generates the URL slug — e.g.{" "}
              <span className="font-mono text-blue-600">/estimate/sand-springs-dylan</span>
            </CardDescription>
          </CardHeader>

          <CardContent className="px-5 pb-5">
            <form onSubmit={handleSubmit} className="space-y-5">

              {/* ── Customer ── */}
              <fieldset className="space-y-4">
                <legend className="text-xs font-semibold text-gray-400 uppercase tracking-wider pb-1 border-b border-gray-100 w-full">
                  Customer
                </legend>

                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-sm font-medium">
                    Customer Name
                  </Label>
                  <Input
                    id="name"
                    placeholder="e.g. Sand Springs Development, Dylan"
                    value={name}
                    onChange={(e) => { setName(e.target.value); setGeneratedSlug(null); }}
                    required
                  />
                  {slugPreview && (
                    <p className="text-xs text-gray-400 font-mono pl-0.5">
                      → /estimate/<span className="text-blue-600 font-semibold">{slugPreview}</span>
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-sm font-medium">
                    Customer Email <OptionalBadge />
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="customer@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </fieldset>

              {/* ── Job Details ── */}
              <fieldset className="space-y-4">
                <legend className="text-xs font-semibold text-gray-400 uppercase tracking-wider pb-1 border-b border-gray-100 w-full">
                  Job Details
                </legend>

                <div className="space-y-1.5">
                  <Label htmlFor="service" className="text-sm font-medium">
                    Service Type
                  </Label>
                  <select
                    id="service"
                    value={service}
                    onChange={(e) => setService(e.target.value)}
                    className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                    required
                  >
                    <option value="Tub">Tub</option>
                    <option value="Shower">Shower</option>
                    <option value="Tub & Tile">Tub &amp; Tile</option>
                    <option value="Sink">Sink</option>
                    <option value="Soaking Tub/Jacuzzi">Soaking Tub/Jacuzzi</option>
                    <option value="Repair">Repair</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="price" className="text-sm font-medium">
                    Price ($)
                  </Label>
                  <Input
                    id="price"
                    type="number"
                    placeholder="e.g. 875"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    min={1}
                    required
                  />
                </div>
              </fieldset>

              {/* ── Media ── */}
              <fieldset className="space-y-4">
                <legend className="text-xs font-semibold text-gray-400 uppercase tracking-wider pb-1 border-b border-gray-100 w-full">
                  Media
                </legend>

                <div className="space-y-1.5">
                  <Label htmlFor="beforeUrl" className="text-sm font-medium">
                    Before Photo URL
                  </Label>
                  <Input
                    id="beforeUrl"
                    type="url"
                    placeholder="https://..."
                    value={beforeUrl}
                    onChange={(e) => setBeforeUrl(e.target.value)}
                    required
                  />
                  <p className="text-xs text-gray-400">
                    A publicly accessible image URL. This is used to generate the after photo.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="companyLogoUrl" className="text-sm font-medium">
                    Company Logo URL <OptionalBadge />
                  </Label>
                  <Input
                    id="companyLogoUrl"
                    type="url"
                    placeholder="https://..."
                    value={companyLogoUrl}
                    onChange={(e) => setCompanyLogoUrl(e.target.value)}
                  />
                </div>
              </fieldset>

              {/* ── Integrations ── */}
              <fieldset className="space-y-4">
                <legend className="text-xs font-semibold text-gray-400 uppercase tracking-wider pb-1 border-b border-gray-100 w-full">
                  Integrations
                </legend>

                <div className="space-y-1.5">
                  <Label htmlFor="ghlContactId" className="text-sm font-medium">
                    GHL Contact ID <OptionalBadge />
                  </Label>
                  <Input
                    id="ghlContactId"
                    placeholder="e.g. abc123xyz"
                    value={ghlContactId}
                    onChange={(e) => setGhlContactId(e.target.value)}
                  />
                  <p className="text-xs text-gray-400">
                    When provided, before/after photos and the estimate URL are written back to the contact.
                  </p>
                </div>
              </fieldset>

              {/* Submit */}
              <Button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold h-11 text-sm rounded-lg shadow-sm transition-colors"
                disabled={createEstimate.isPending}
              >
                {createEstimate.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" />Generating…</>
                ) : (
                  <><Link2 className="h-4 w-4 mr-2" />{generatedSlug ? "Regenerate Link" : "Generate Estimate Link"}</>
                )}
              </Button>

            </form>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
