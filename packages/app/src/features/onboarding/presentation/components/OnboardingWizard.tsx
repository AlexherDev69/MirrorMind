import { useEffect, useCallback } from "react";
import { useOnboardingStore } from "../stores/onboarding.store";
import { fetchDeviceBrand, markDeviceAsOnboarded } from "../../data/onboarding-persistence";
import { BRAND_INSTRUCTIONS } from "../../domain/brand-instructions";
import { WelcomeStep } from "./WelcomeStep";
import { BrandSelector } from "./BrandSelector";
import { UsbDebuggingGuide } from "./UsbDebuggingGuide";
import { AuthorizationStep } from "./AuthorizationStep";
import { SuccessStep } from "./SuccessStep";

interface AdbDevice {
  readonly serial: string;
  readonly state: string;
  readonly model: string;
}

interface OnboardingWizardProps {
  readonly device: AdbDevice | null;
  readonly onComplete: (device: AdbDevice) => void;
}

export function OnboardingWizard({ device, onComplete }: OnboardingWizardProps) {
  const store = useOnboardingStore();

  // Auto-advance: device unauthorized → authorize step
  useEffect(() => {
    if (device?.state === "unauthorized" && store.currentStep !== "authorize") {
      store.goToStep("authorize");
    }
  }, [device?.state, device?.serial, store.currentStep]);

  // Auto-advance: device authorized → success step
  useEffect(() => {
    if (device?.state !== "device") return;
    if (store.currentStep === "success") return;

    const handleAuthorized = async () => {
      const brand = await fetchDeviceBrand(device.serial);
      store.setDetectedBrand(brand);
      store.goToStep("success");
    };

    handleAuthorized();
  }, [device?.state, device?.serial]);

  // Auto-advance: success → complete after delay
  useEffect(() => {
    if (store.currentStep !== "success" || !device || device.state !== "device") return;

    const timer = setTimeout(async () => {
      await markDeviceAsOnboarded(device.serial);
      store.completeOnboarding();
      onComplete(device);
    }, 1500);

    return () => clearTimeout(timer);
  }, [store.currentStep, device, onComplete]);

  const handleNeedHelp = useCallback(() => {
    store.goToStep("select-brand");
  }, []);

  const handleBrandBack = useCallback(() => {
    store.goToStep("welcome");
  }, []);

  const handleGuideBack = useCallback(() => {
    store.goToStep("select-brand");
  }, []);

  const handleGuideDone = useCallback(() => {
    store.goToStep("welcome");
  }, []);

  const activeBrand = store.selectedBrand ?? store.detectedBrand;
  const brandName = activeBrand ? BRAND_INSTRUCTIONS[activeBrand].displayName : null;

  return (
    <div className="flex flex-col items-center justify-center h-full py-8">
      {store.currentStep === "welcome" && (
        <WelcomeStep onNeedHelp={handleNeedHelp} />
      )}

      {store.currentStep === "select-brand" && (
        <BrandSelector
          onSelect={store.selectBrand}
          onBack={handleBrandBack}
        />
      )}

      {store.currentStep === "enable-debugging" && activeBrand && (
        <UsbDebuggingGuide
          brand={activeBrand}
          onDone={handleGuideDone}
          onBack={handleGuideBack}
        />
      )}

      {store.currentStep === "authorize" && <AuthorizationStep />}

      {store.currentStep === "success" && (
        <SuccessStep
          model={device?.model ?? "Unknown device"}
          brand={brandName}
        />
      )}
    </div>
  );
}
