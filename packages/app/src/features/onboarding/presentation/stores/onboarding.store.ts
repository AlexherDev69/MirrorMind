import { create } from "zustand";
import type { PhoneBrand } from "@mirror-mind/shared";
import type { OnboardingStep } from "../../domain/onboarding.types";

interface OnboardingStore {
  readonly currentStep: OnboardingStep;
  readonly selectedBrand: PhoneBrand | null;
  readonly detectedBrand: PhoneBrand | null;
  readonly isCompleted: boolean;

  selectBrand: (brand: PhoneBrand) => void;
  setDetectedBrand: (brand: PhoneBrand) => void;
  goToStep: (step: OnboardingStep) => void;
  completeOnboarding: () => void;
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingStore>((set) => ({
  currentStep: "welcome",
  selectedBrand: null,
  detectedBrand: null,
  isCompleted: false,

  selectBrand: (brand) =>
    set({ selectedBrand: brand, currentStep: "enable-debugging" }),

  setDetectedBrand: (brand) => set({ detectedBrand: brand }),

  goToStep: (step) => set({ currentStep: step }),

  completeOnboarding: () => set({ isCompleted: true }),

  reset: () =>
    set({
      currentStep: "welcome",
      selectedBrand: null,
      detectedBrand: null,
      isCompleted: false,
    }),
}));
