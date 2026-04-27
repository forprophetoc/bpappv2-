import { useState } from "react";
import { Copy, Check, ChevronDown, ChevronUp, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

export default function CustomerSetup() {
  // ── Company Info ──
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [bookingLink, setBookingLink] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [serviceArea, setServiceArea] = useState("");

  // ── Standard Package ──
  const [stdName, setStdName] = useState("Standard");
  const [stdTitle, setStdTitle] = useState("Standard Package");
  const [stdWarranty, setStdWarranty] = useState("");
  const [stdPrice, setStdPrice] = useState("");
  const [stdFeature1Title, setStdFeature1Title] = useState("Professional Bathtub Refinishing");
  const [stdFeature1Desc, setStdFeature1Desc] = useState("Complete refinishing with deep cleaning and surface prep.");
  const [stdFeature2Title, setStdFeature2Title] = useState("Affordable Alternative to Replacement");
  const [stdFeature2Desc, setStdFeature2Desc] = useState("Save thousands compared to a full tub replacement.");
  const [stdFeature3Title, setStdFeature3Title] = useState("One-Day Transformation");
  const [stdFeature3Desc, setStdFeature3Desc] = useState("Done in a single visit — no multi-day projects.");
  const [stdFeature4Title, setStdFeature4Title] = useState("");
  const [stdFeature4Desc, setStdFeature4Desc] = useState("");
  const [stdFeature5Title, setStdFeature5Title] = useState("");
  const [stdFeature5Desc, setStdFeature5Desc] = useState("");

  // ── Gold Package ──
  const [goldName, setGoldName] = useState("Gold");
  const [goldTitle, setGoldTitle] = useState("Gold Package");
  const [goldBadge, setGoldBadge] = useState("Recommended");
  const [goldSubtitle, setGoldSubtitle] = useState("");
  const [goldPrice, setGoldPrice] = useState("");
  const [goldFeature1Title, setGoldFeature1Title] = useState("Everything in Standard Package");
  const [goldFeature1Desc, setGoldFeature1Desc] = useState("All the same professional refinishing, prep, and glossy finish.");
  const [goldFeature2Title, setGoldFeature2Title] = useState("Premium Coating System");
  const [goldFeature2Desc, setGoldFeature2Desc] = useState("Enhanced durability for a longer-lasting finish.");
  const [goldFeature3Title, setGoldFeature3Title] = useState("Extended Finish Life");
  const [goldFeature3Desc, setGoldFeature3Desc] = useState("Built to last longer, especially in high-use environments.");
  const [goldFeature4Title, setGoldFeature4Title] = useState("Chip Repair Included");
  const [goldFeature4Desc, setGoldFeature4Desc] = useState("We repair chips and imperfections — no extra charge.");
  const [goldFeature5Title, setGoldFeature5Title] = useState("");
  const [goldFeature5Desc, setGoldFeature5Desc] = useState("");

  // ── Sink Upsells ──
  const [bathroomSinkEnabled, setBathroomSinkEnabled] = useState(true);
  const [bathroomSinkTitle, setBathroomSinkTitle] = useState("Bathroom Sink (Perfect Match)");
  const [bathroomSinkDesc, setBathroomSinkDesc] = useState("Matched to your tub for a clean, consistent finish");
  const [bathroomSinkPrice, setBathroomSinkPrice] = useState("199");
  const [kitchenSinkEnabled, setKitchenSinkEnabled] = useState(true);
  const [kitchenSinkTitle, setKitchenSinkTitle] = useState("Kitchen Sink (High-Use Upgrade)");
  const [kitchenSinkDesc, setKitchenSinkDesc] = useState("Restore a clean, durable finish where it matters most");
  const [kitchenSinkPrice, setKitchenSinkPrice] = useState("249");

  // ── Callouts ──
  const [greenHeading, setGreenHeading] = useState("What You Get With Us");
  const [greenPoint1, setGreenPoint1] = useState("");
  const [greenPoint2, setGreenPoint2] = useState("");
  const [greenPoint3, setGreenPoint3] = useState("");
  const [greenPoint4, setGreenPoint4] = useState("");
  const [redHeading, setRedHeading] = useState("Most Other Companies...");
  const [redPoint1, setRedPoint1] = useState("");
  const [redPoint2, setRedPoint2] = useState("");
  const [redPoint3, setRedPoint3] = useState("");
  const [redPoint4, setRedPoint4] = useState("");

  // ── Trust Strip ──
  const [trust1, setTrust1] = useState("");
  const [trust2, setTrust2] = useState("");
  const [trust3, setTrust3] = useState("");

  // ── Testimonials ──
  const [test1Quote, setTest1Quote] = useState("");
  const [test1Author, setTest1Author] = useState("");
  const [test2Quote, setTest2Quote] = useState("");
  const [test2Author, setTest2Author] = useState("");
  const [test3Quote, setTest3Quote] = useState("");
  const [test3Author, setTest3Author] = useState("");

  // ── Cabinet Section (collapsible) ──
  const [showCabinets, setShowCabinets] = useState(false);
  const [cabHeaderTitle, setCabHeaderTitle] = useState("");
  const [cabHeroSubtitle, setCabHeroSubtitle] = useState("");
  const [cabGreenHeading, setCabGreenHeading] = useState("What You Get With Us");
  const [cabGreenPoint1, setCabGreenPoint1] = useState("");
  const [cabGreenPoint2, setCabGreenPoint2] = useState("");
  const [cabGreenPoint3, setCabGreenPoint3] = useState("");
  const [cabGreenPoint4, setCabGreenPoint4] = useState("");

  // ── Test Account Fields ──
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [onboarding, setOnboarding] = useState(false);

  // ── UI State ──
  const [showPreview, setShowPreview] = useState(false);
  const [copied, setCopied] = useState(false);

  // ── Build Config JSON ──
  function buildConfig() {
    const slug = slugify(companyName);
    const badge = companyName.split(" ").map(w => w[0]).join("").slice(0, 3).toUpperCase();

    const stdFeatures = [
      { title: stdFeature1Title, desc: stdFeature1Desc },
      { title: stdFeature2Title, desc: stdFeature2Desc },
      { title: stdFeature3Title, desc: stdFeature3Desc },
      { title: stdFeature4Title, desc: stdFeature4Desc },
      { title: stdFeature5Title, desc: stdFeature5Desc },
    ].filter(f => f.title.trim());

    const goldFeatures = [
      { title: goldFeature1Title, desc: goldFeature1Desc },
      { title: goldFeature2Title, desc: goldFeature2Desc },
      { title: goldFeature3Title, desc: goldFeature3Desc },
      { title: goldFeature4Title, desc: goldFeature4Desc },
      { title: goldFeature5Title, desc: goldFeature5Desc },
    ].filter(f => f.title.trim());

    const greenItems = [greenPoint1, greenPoint2, greenPoint3, greenPoint4].filter(Boolean);
    const redItems = [redPoint1, redPoint2, redPoint3, redPoint4].filter(Boolean);
    const trustStrip = [trust1, trust2, trust3].filter(Boolean);

    const testimonials = [
      { quote: test1Quote, author: test1Author },
      { quote: test2Quote, author: test2Author },
      { quote: test3Quote, author: test3Author },
    ].filter(t => t.quote.trim() && t.author.trim());

    const config: any = {
      company: {
        name: companyName,
        slug,
        phone,
        phoneDisplay: phone,
        logoUrl,
        bookingLink,
        websiteUrl,
        supportEmail,
        serviceArea,
        bathroomSinkPrice: bathroomSinkEnabled ? parseInt(bathroomSinkPrice) || 199 : 0,
        kitchenSinkPrice: kitchenSinkEnabled ? parseInt(kitchenSinkPrice) || 249 : 0,
        epoxyMaintenancePlanPrice: 199,
        epoxyUvClearCoatPrice: 349,
        defaultPrices: {
          Tub: parseInt(stdPrice) || 299,
          Shower: parseInt(stdPrice) || 299,
          "Soaking Tub/Jacuzzi": 699,
          "Tub & Tile": 499,
          "Epoxy Flooring": 1499,
          "Cabinet Refinishing": 2999,
        },
      },
      estimatePage: {
        headerBadge: badge,
        headerTitle: companyName,
        trustStrip: trustStrip.length ? trustStrip : ["5-Star Rated", `Serving ${serviceArea}`, "Owner On-Site Every Job"],
        heroSubtitle: "Based on your bathroom, here's the transformation you can expect — no demo, no mess, done in one day.",
        greenCallout: {
          heading: greenHeading,
          items: greenItems.length ? greenItems : ["Professional results every time"],
        },
        standardPackage: {
          name: stdName,
          title: stdTitle,
          warrantyLabel: stdWarranty || "Warranty Included",
          features: stdFeatures.length ? stdFeatures : [{ title: "Professional Refinishing", desc: "Complete refinishing with surface prep." }],
        },
        goldPackage: {
          name: goldName,
          title: goldTitle,
          subtitle: goldSubtitle || "Our most complete package — built for the best long-term result.",
          badge: goldBadge,
          features: goldFeatures.length ? goldFeatures : [{ title: "Everything in Standard", desc: "Plus enhanced durability." }],
        },
        benefits: [
          { label: "Warranty Included", sub: "Every job covered" },
          { label: "Same-Day Done", sub: "In & out in one visit" },
          { label: "Save Thousands", sub: "vs. full replacement" },
          { label: "Local Experts", sub: serviceArea || "Your area" },
        ],
        testimonials: testimonials.length ? testimonials : [{ quote: "Great service!", author: "Customer" }],
        ctaHeading: "Ready to Book?",
        ctaSubtext: "Book online or give us a call — we're ready when you are.",
        termsText: "Images are stored for 90 days and may expire after this period, and this estimate is valid for 6 months from the date issued.",
        footerPromo: "No mess, no demo - Same-day completion",
      },
      epoxyPage: {
        heroSubtitle: "Based on your space, here's the epoxy flooring transformation you can expect.",
        greenCallout: { heading: "What You Get With Us", items: ["Professional-grade coating system", "Clean, even finish"] },
        redCallout: { heading: redHeading, items: redItems.length ? redItems : ["Rush the install", "Use lower-grade coatings"] },
        warrantyLabel: "Limited Warranty",
        baseColors: [
          { value: "light-gray", label: "Light Gray" },
          { value: "dark-gray", label: "Dark Gray" },
          { value: "tan", label: "Tan" },
          { value: "earth-tone", label: "Earth Tone" },
          { value: "custom", label: "Custom" },
        ],
        flakeColors: [
          { value: "domino", label: "Domino" },
          { value: "nightfall", label: "Nightfall" },
          { value: "creekbed", label: "Creekbed" },
          { value: "shoreline", label: "Shoreline" },
          { value: "wombat", label: "Wombat" },
        ],
        benefits: [
          { label: "Limited Warranty", sub: "Every job covered" },
          { label: "Professional Install", sub: "Done right the first time" },
          { label: "Save Thousands", sub: "vs. full replacement" },
          { label: "Local Experts", sub: serviceArea || "Your area" },
        ],
        testimonials: [{ quote: "Incredible transformation.", author: "Customer" }],
        headerBadge: badge,
        headerTitle: `${companyName} Epoxy`,
      },
      cabinetPage: {
        heroSubtitle: cabHeroSubtitle || "Based on your kitchen, here's the cabinet transformation you can expect.",
        greenCallout: {
          heading: cabGreenHeading,
          items: [cabGreenPoint1, cabGreenPoint2, cabGreenPoint3, cabGreenPoint4].filter(Boolean).length
            ? [cabGreenPoint1, cabGreenPoint2, cabGreenPoint3, cabGreenPoint4].filter(Boolean)
            : ["Smooth, factory-like finish", "Durable coating built for daily use"],
        },
        redCallout: { heading: redHeading, items: redItems.length ? redItems : ["Cut corners on prep"] },
        warrantyLabel: "Limited Warranty",
        benefits: [
          { label: "Limited Warranty", sub: "Every job covered" },
          { label: "Professional Spray", sub: "Factory-like finish" },
          { label: "Save Thousands", sub: "vs. full replacement" },
          { label: "Local Experts", sub: serviceArea || "Your area" },
        ],
        testimonials: [{ quote: "They look brand new.", author: "Customer" }],
        headerBadge: badge,
        headerTitle: cabHeaderTitle || `${companyName} Cabinet Refinishing`,
      },
      messaging: {
        smsTemplate: `Hi {{firstName}}, here is your estimate from {{companyName}}: {{estimateUrl}}`,
        emailSubject: "Your {{companyName}} Estimate",
        emailBody: "Hi {{firstName}},\n\nHere is your personalized estimate from {{companyName}}:\n{{estimateUrl}}\n\nThank you!",
      },
    };

    return config;
  }

  const configJson = JSON.stringify(buildConfig(), null, 2);

  async function handleCopy() {
    await navigator.clipboard.writeText(configJson);
    setCopied(true);
    toast.success("Config JSON copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownload() {
    const slug = slugify(companyName) || "new-company";
    const blob = new Blob([configJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Config downloaded!");
  }

  async function handleCreateTestAccount() {
    if (!companyName.trim()) {
      toast.error("Company name is required");
      return;
    }
    if (!adminEmail.trim() || !adminPassword.trim()) {
      toast.error("Admin email and password are required");
      return;
    }
    if (adminPassword.length < 4) {
      toast.error("Password must be at least 4 characters");
      return;
    }

    setOnboarding(true);
    try {
      const config = buildConfig();
      const res = await fetch("/api/dev/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config, adminEmail: adminEmail.trim(), adminPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to create test account");
        return;
      }
      toast.success(`Test account created! Login with ${data.loginEmail} at the login page.`);
    } catch (err: any) {
      toast.error(err.message || "Network error");
    } finally {
      setOnboarding(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-gray-900 text-white py-4 px-4 sticky top-0 z-50">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <h1 className="text-lg font-bold">Customer Setup</h1>
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="flex items-center gap-1.5 text-sm bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded-lg transition-colors"
          >
            {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {showPreview ? "Hide" : "Preview"}
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

        {/* ── SECTION: Company Info ── */}
        <Section title="Company Info">
          <Field label="Company Name" required>
            <input
              type="text"
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              placeholder="e.g. Bathtub Pros"
              className="form-input"
            />
          </Field>
          <Field label="Phone">
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="(555) 123-4567"
              className="form-input"
            />
          </Field>
          <Field label="Logo URL" hint="Direct link to your logo image. Right-click your logo on your website and copy the image address.">
            <input
              type="url"
              value={logoUrl}
              onChange={e => setLogoUrl(e.target.value)}
              placeholder="https://..."
              className="form-input"
            />
          </Field>
          <Field label="Booking Link" hint="The link customers click to schedule an appointment. Usually from your calendar tool (Calendly, GHL, etc).">
            <input
              type="url"
              value={bookingLink}
              onChange={e => setBookingLink(e.target.value)}
              placeholder="https://..."
              className="form-input"
            />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Website" hint="Your main business website that customers visit.">
              <input
                type="url"
                value={websiteUrl}
                onChange={e => setWebsiteUrl(e.target.value)}
                placeholder="https://..."
                className="form-input"
              />
            </Field>
            <Field label="Support Email" hint="The email address customers should use to reach you.">
              <input
                type="email"
                value={supportEmail}
                onChange={e => setSupportEmail(e.target.value)}
                placeholder="info@company.com"
                className="form-input"
              />
            </Field>
          </div>
          <Field label="Service Area" hint="The cities or region you serve. Shown to customers on the estimate page.">
            <input
              type="text"
              value={serviceArea}
              onChange={e => setServiceArea(e.target.value)}
              placeholder="e.g. Southwest Florida"
              className="form-input"
            />
          </Field>
        </Section>

        {/* ── SECTION: Trust Strip ── */}
        <Section title="Trust Strip (3 short proof points)">
          <div className="space-y-2">
            <input type="text" value={trust1} onChange={e => setTrust1(e.target.value)} placeholder="e.g. 5-Star Rated" className="form-input" />
            <input type="text" value={trust2} onChange={e => setTrust2(e.target.value)} placeholder="e.g. Serving Southwest Florida" className="form-input" />
            <input type="text" value={trust3} onChange={e => setTrust3(e.target.value)} placeholder="e.g. Owner On-Site Every Job" className="form-input" />
          </div>
        </Section>

        {/* ── SECTION: Standard Package ── */}
        <Section title="Standard Package">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Package Name">
              <input type="text" value={stdName} onChange={e => setStdName(e.target.value)} className="form-input" />
            </Field>
            <Field label="Price ($)">
              <input type="number" value={stdPrice} onChange={e => setStdPrice(e.target.value)} placeholder="299" className="form-input" />
            </Field>
          </div>
          <Field label="Warranty Label">
            <input type="text" value={stdWarranty} onChange={e => setStdWarranty(e.target.value)} placeholder="e.g. Three Year No Peel Warranty" className="form-input" />
          </Field>
          <p className="text-xs text-gray-500 mt-3 mb-1 font-medium">Features (title + description):</p>
          <FeatureRow n={1} title={stdFeature1Title} desc={stdFeature1Desc} setTitle={setStdFeature1Title} setDesc={setStdFeature1Desc} />
          <FeatureRow n={2} title={stdFeature2Title} desc={stdFeature2Desc} setTitle={setStdFeature2Title} setDesc={setStdFeature2Desc} />
          <FeatureRow n={3} title={stdFeature3Title} desc={stdFeature3Desc} setTitle={setStdFeature3Title} setDesc={setStdFeature3Desc} />
          <FeatureRow n={4} title={stdFeature4Title} desc={stdFeature4Desc} setTitle={setStdFeature4Title} setDesc={setStdFeature4Desc} />
          <FeatureRow n={5} title={stdFeature5Title} desc={stdFeature5Desc} setTitle={setStdFeature5Title} setDesc={setStdFeature5Desc} />
        </Section>

        {/* ── SECTION: Gold Package ── */}
        <Section title="Gold Package">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Package Name">
              <input type="text" value={goldName} onChange={e => setGoldName(e.target.value)} className="form-input" />
            </Field>
            <Field label="Badge Text">
              <input type="text" value={goldBadge} onChange={e => setGoldBadge(e.target.value)} placeholder="Recommended" className="form-input" />
            </Field>
            <Field label="Price ($)">
              <input type="number" value={goldPrice} onChange={e => setGoldPrice(e.target.value)} placeholder="499" className="form-input" />
            </Field>
          </div>
          <Field label="Subtitle">
            <input type="text" value={goldSubtitle} onChange={e => setGoldSubtitle(e.target.value)} placeholder="Our most complete package..." className="form-input" />
          </Field>
          <p className="text-xs text-gray-500 mt-3 mb-1 font-medium">Features (title + description):</p>
          <FeatureRow n={1} title={goldFeature1Title} desc={goldFeature1Desc} setTitle={setGoldFeature1Title} setDesc={setGoldFeature1Desc} />
          <FeatureRow n={2} title={goldFeature2Title} desc={goldFeature2Desc} setTitle={setGoldFeature2Title} setDesc={setGoldFeature2Desc} />
          <FeatureRow n={3} title={goldFeature3Title} desc={goldFeature3Desc} setTitle={setGoldFeature3Title} setDesc={setGoldFeature3Desc} />
          <FeatureRow n={4} title={goldFeature4Title} desc={goldFeature4Desc} setTitle={setGoldFeature4Title} setDesc={setGoldFeature4Desc} />
          <FeatureRow n={5} title={goldFeature5Title} desc={goldFeature5Desc} setTitle={setGoldFeature5Title} setDesc={setGoldFeature5Desc} />
        </Section>

        {/* ── SECTION: Sink Upsells ── */}
        <Section title="Sink Upsells">
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <label className="flex items-center gap-2 mb-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={bathroomSinkEnabled}
                  onChange={e => setBathroomSinkEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600"
                />
                <span className="text-sm font-semibold text-gray-900">Bathroom Sink</span>
              </label>
              {bathroomSinkEnabled && (
                <div className="space-y-2 ml-6">
                  <input type="text" value={bathroomSinkTitle} onChange={e => setBathroomSinkTitle(e.target.value)} placeholder="Title" className="form-input text-sm" />
                  <input type="text" value={bathroomSinkDesc} onChange={e => setBathroomSinkDesc(e.target.value)} placeholder="Description" className="form-input text-sm" />
                  <input type="number" value={bathroomSinkPrice} onChange={e => setBathroomSinkPrice(e.target.value)} placeholder="199" className="form-input text-sm w-32" />
                </div>
              )}
            </div>

            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <label className="flex items-center gap-2 mb-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={kitchenSinkEnabled}
                  onChange={e => setKitchenSinkEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600"
                />
                <span className="text-sm font-semibold text-gray-900">Kitchen Sink</span>
              </label>
              {kitchenSinkEnabled && (
                <div className="space-y-2 ml-6">
                  <input type="text" value={kitchenSinkTitle} onChange={e => setKitchenSinkTitle(e.target.value)} placeholder="Title" className="form-input text-sm" />
                  <input type="text" value={kitchenSinkDesc} onChange={e => setKitchenSinkDesc(e.target.value)} placeholder="Description" className="form-input text-sm" />
                  <input type="number" value={kitchenSinkPrice} onChange={e => setKitchenSinkPrice(e.target.value)} placeholder="249" className="form-input text-sm w-32" />
                </div>
              )}
            </div>
          </div>
        </Section>

        {/* ── SECTION: Callouts ── */}
        <Section title="Callout Sections">
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-green-700 uppercase tracking-wider mb-2">Green Callout (Your Strengths)</p>
              <Field label="Heading">
                <input type="text" value={greenHeading} onChange={e => setGreenHeading(e.target.value)} className="form-input" />
              </Field>
              <div className="space-y-2 mt-2">
                <input type="text" value={greenPoint1} onChange={e => setGreenPoint1(e.target.value)} placeholder="Point 1" className="form-input text-sm" />
                <input type="text" value={greenPoint2} onChange={e => setGreenPoint2(e.target.value)} placeholder="Point 2" className="form-input text-sm" />
                <input type="text" value={greenPoint3} onChange={e => setGreenPoint3(e.target.value)} placeholder="Point 3" className="form-input text-sm" />
                <input type="text" value={greenPoint4} onChange={e => setGreenPoint4(e.target.value)} placeholder="Point 4" className="form-input text-sm" />
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-red-700 uppercase tracking-wider mb-2">Red Callout (Competitors' Weaknesses)</p>
              <Field label="Heading">
                <input type="text" value={redHeading} onChange={e => setRedHeading(e.target.value)} className="form-input" />
              </Field>
              <div className="space-y-2 mt-2">
                <input type="text" value={redPoint1} onChange={e => setRedPoint1(e.target.value)} placeholder="Point 1" className="form-input text-sm" />
                <input type="text" value={redPoint2} onChange={e => setRedPoint2(e.target.value)} placeholder="Point 2" className="form-input text-sm" />
                <input type="text" value={redPoint3} onChange={e => setRedPoint3(e.target.value)} placeholder="Point 3" className="form-input text-sm" />
                <input type="text" value={redPoint4} onChange={e => setRedPoint4(e.target.value)} placeholder="Point 4" className="form-input text-sm" />
              </div>
            </div>
          </div>
        </Section>

        {/* ── SECTION: Testimonials ── */}
        <Section title="Testimonials">
          <div className="space-y-4">
            <TestimonialRow n={1} quote={test1Quote} author={test1Author} setQuote={setTest1Quote} setAuthor={setTest1Author} />
            <TestimonialRow n={2} quote={test2Quote} author={test2Author} setQuote={setTest2Quote} setAuthor={setTest2Author} />
            <TestimonialRow n={3} quote={test3Quote} author={test3Author} setQuote={setTest3Quote} setAuthor={setTest3Author} />
          </div>
        </Section>

        {/* ── SECTION: Cabinets (Collapsible) ── */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={() => setShowCabinets(!showCabinets)}
            className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
          >
            <span className="font-bold text-gray-900 text-sm">Cabinet Refinishing (Optional)</span>
            {showCabinets ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
          </button>
          {showCabinets && (
            <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
              <Field label="Header Title">
                <input type="text" value={cabHeaderTitle} onChange={e => setCabHeaderTitle(e.target.value)} placeholder="e.g. Company Name Cabinet Refinishing" className="form-input" />
              </Field>
              <Field label="Hero Subtitle">
                <input type="text" value={cabHeroSubtitle} onChange={e => setCabHeroSubtitle(e.target.value)} placeholder="Based on your kitchen..." className="form-input" />
              </Field>
              <p className="text-xs font-semibold text-green-700 uppercase tracking-wider mt-3 mb-1">Green Callout Points</p>
              <input type="text" value={cabGreenPoint1} onChange={e => setCabGreenPoint1(e.target.value)} placeholder="Point 1" className="form-input text-sm" />
              <input type="text" value={cabGreenPoint2} onChange={e => setCabGreenPoint2(e.target.value)} placeholder="Point 2" className="form-input text-sm" />
              <input type="text" value={cabGreenPoint3} onChange={e => setCabGreenPoint3(e.target.value)} placeholder="Point 3" className="form-input text-sm" />
              <input type="text" value={cabGreenPoint4} onChange={e => setCabGreenPoint4(e.target.value)} placeholder="Point 4" className="form-input text-sm" />
            </div>
          )}
        </div>

        {/* ── JSON Preview ── */}
        {showPreview && (
          <div className="bg-gray-900 rounded-xl p-4 overflow-x-auto">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-400 font-mono">Generated Config JSON</p>
              <div className="flex gap-2">
                <button onClick={handleDownload} className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 px-2.5 py-1 rounded transition-colors">
                  Download
                </button>
              </div>
            </div>
            <pre className="text-[11px] leading-relaxed text-green-400 font-mono whitespace-pre-wrap break-words">
              {configJson}
            </pre>
          </div>
        )}

        {/* ── DEV: Create Test Account ── */}
        <Section title="Create Test Account (Dev Only)">
          <p className="text-xs text-gray-500 mb-3">Submit the form to create a test customer account. This writes the config file and creates the admin login so you can access the dashboard immediately.</p>
          <Field label="Admin Email" required>
            <input
              type="email"
              value={adminEmail}
              onChange={e => setAdminEmail(e.target.value)}
              placeholder="admin@test.com"
              className="form-input"
            />
          </Field>
          <Field label="Admin Password" required>
            <input
              type="password"
              value={adminPassword}
              onChange={e => setAdminPassword(e.target.value)}
              placeholder="test1234"
              className="form-input"
            />
          </Field>
          <button
            onClick={handleCreateTestAccount}
            disabled={onboarding || !companyName.trim()}
            className="w-full mt-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-semibold py-3 rounded-lg transition-colors"
          >
            {onboarding ? "Creating..." : "Create Test Account & Config"}
          </button>
        </Section>

        {/* ── Actions ── */}
        <div className="sticky bottom-4 bg-white border border-gray-200 shadow-lg rounded-xl p-4 flex gap-3">
          <button
            onClick={handleCopy}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied!" : "Copy Config JSON"}
          </button>
          <button
            onClick={handleDownload}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 px-4 rounded-lg transition-colors"
          >
            Export
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Helper Components ──

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
      <h2 className="font-bold text-gray-900 text-sm mb-4">{title}</h2>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-0.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {hint && <p className="text-[11px] text-gray-400 mb-1">{hint}</p>}
      {children}
    </div>
  );
}

function FeatureRow({ n, title, desc, setTitle, setDesc }: { n: number; title: string; desc: string; setTitle: (v: string) => void; setDesc: (v: string) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
      <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder={`Feature ${n} title`} className="form-input text-sm" />
      <input type="text" value={desc} onChange={e => setDesc(e.target.value)} placeholder={`Feature ${n} description`} className="form-input text-sm" />
    </div>
  );
}

function TestimonialRow({ n, quote, author, setQuote, setAuthor }: { n: number; quote: string; author: string; setQuote: (v: string) => void; setAuthor: (v: string) => void }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
      <p className="text-xs font-medium text-gray-500 mb-1.5">Testimonial {n}</p>
      <textarea value={quote} onChange={e => setQuote(e.target.value)} placeholder="Customer quote..." rows={2} className="form-input text-sm resize-none" />
      <input type="text" value={author} onChange={e => setAuthor(e.target.value)} placeholder="Author name (e.g. Sandra M.)" className="form-input text-sm mt-2" />
    </div>
  );
}
