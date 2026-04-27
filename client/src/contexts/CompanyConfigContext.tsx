import { createContext, useContext } from "react";
import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";

// Mirror the shape from config/types.ts (client-side)
interface CompanyInfo {
  name: string;
  slug: string;
  phone: string;
  phoneDisplay: string;
  logoUrl: string;
  bookingLink: string;
  websiteUrl: string;
  supportEmail: string;
  serviceArea: string;
  bathroomSinkPrice: number;
  kitchenSinkPrice: number;
  epoxyMaintenancePlanPrice: number;
  epoxyUvClearCoatPrice: number;
  defaultPrices: Record<string, number>;
}

interface PackageFeature {
  title: string;
  desc: string;
}

interface Callout {
  heading: string;
  items: string[];
}

interface Benefit {
  label: string;
  sub: string;
}

interface Testimonial {
  quote: string;
  author: string;
}

interface ColorOption {
  value: string;
  label: string;
}

interface EstimatePageConfig {
  headerBadge: string;
  headerTitle: string;
  trustStrip: string[];
  heroSubtitle: string;
  greenCallout: Callout;
  standardPackage: {
    name: string;
    title: string;
    warrantyLabel: string;
    features: PackageFeature[];
  };
  goldPackage: {
    name: string;
    title: string;
    subtitle: string;
    badge: string;
    features: PackageFeature[];
  };
  benefits: Benefit[];
  testimonials: Testimonial[];
  ctaHeading: string;
  ctaSubtext: string;
  termsText: string;
  footerPromo: string;
}

interface EpoxyPageConfig {
  heroSubtitle: string;
  greenCallout: Callout;
  redCallout: Callout;
  warrantyLabel: string;
  baseColors: ColorOption[];
  flakeColors: ColorOption[];
  benefits: Benefit[];
  testimonials: Testimonial[];
  headerBadge: string;
  headerTitle: string;
}

interface CabinetPageConfig {
  heroSubtitle: string;
  greenCallout: Callout;
  redCallout: Callout;
  warrantyLabel: string;
  benefits: Benefit[];
  testimonials: Testimonial[];
  headerBadge: string;
  headerTitle: string;
}

interface MessagingConfig {
  smsTemplate: string;
  emailSubject: string;
  emailBody: string;
}

export interface CompanyConfig {
  company: CompanyInfo;
  estimatePage: EstimatePageConfig;
  epoxyPage: EpoxyPageConfig;
  cabinetPage: CabinetPageConfig;
  messaging: MessagingConfig;
}

const CompanyConfigContext = createContext<CompanyConfig | null>(null);

export function useCompanyConfig(): CompanyConfig {
  const ctx = useContext(CompanyConfigContext);
  if (!ctx) throw new Error("useCompanyConfig must be used within CompanyConfigProvider");
  return ctx;
}

export function CompanyConfigProvider({ children }: { children: React.ReactNode }) {
  const { data: config, isLoading, error } = trpc.config.get.useQuery();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !config) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-center px-4">
        <div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">Configuration Error</h1>
          <p className="text-gray-500 text-sm">Unable to load company configuration.</p>
        </div>
      </div>
    );
  }

  return (
    <CompanyConfigContext.Provider value={config as unknown as CompanyConfig}>
      {children}
    </CompanyConfigContext.Provider>
  );
}
