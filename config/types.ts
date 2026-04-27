/**
 * Type definitions for per-company config files.
 * Each company config file must export a default object matching CompanyConfig.
 */

export interface CompanyInfo {
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

export interface PackageFeature {
  title: string;
  desc: string;
}

export interface Callout {
  heading: string;
  items: string[];
}

export interface Benefit {
  label: string;
  sub: string;
}

export interface Testimonial {
  quote: string;
  author: string;
}

export interface ColorOption {
  value: string;
  label: string;
}

export interface EstimatePageConfig {
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

export interface EpoxyPageConfig {
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

export interface CabinetPageConfig {
  heroSubtitle: string;
  greenCallout: Callout;
  redCallout: Callout;
  warrantyLabel: string;
  benefits: Benefit[];
  testimonials: Testimonial[];
  headerBadge: string;
  headerTitle: string;
}

export interface MessagingConfig {
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
