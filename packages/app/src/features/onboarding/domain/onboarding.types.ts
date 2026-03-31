import type { PhoneBrand } from "@phone-stream/shared";

export type OnboardingStep =
  | "welcome"
  | "select-brand"
  | "enable-debugging"
  | "authorize"
  | "success";

export interface BrandStep {
  readonly title: string;
  readonly description: string;
}

export interface BrandInstruction {
  readonly id: PhoneBrand;
  readonly displayName: string;
  readonly steps: readonly BrandStep[];
}
