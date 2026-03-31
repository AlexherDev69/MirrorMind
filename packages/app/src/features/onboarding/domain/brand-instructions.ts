import type { PhoneBrand } from "@phone-stream/shared";
import type { BrandInstruction } from "./onboarding.types";

export const BRAND_INSTRUCTIONS: Record<PhoneBrand, BrandInstruction> = {
  samsung: {
    id: "samsung",
    displayName: "Samsung",
    steps: [
      {
        title: "Open Settings",
        description: "Go to Settings > About phone > Software information",
      },
      {
        title: "Enable Developer mode",
        description: "Tap 'Build number' 7 times until you see 'Developer mode has been enabled'",
      },
      {
        title: "Enable USB Debugging",
        description: "Go back to Settings > Developer options > Toggle 'USB debugging' ON",
      },
      {
        title: "Plug your phone",
        description: "Connect your phone to your PC with a USB cable",
      },
    ],
  },
  xiaomi: {
    id: "xiaomi",
    displayName: "Xiaomi",
    steps: [
      {
        title: "Open Settings",
        description: "Go to Settings > About phone",
      },
      {
        title: "Enable Developer mode",
        description: "Tap 'MIUI version' 7 times until you see 'Developer options enabled'",
      },
      {
        title: "Enable USB Debugging",
        description: "Go to Settings > Additional settings > Developer options > Toggle 'USB debugging' ON",
      },
      {
        title: "Plug your phone",
        description: "Connect your phone to your PC with a USB cable",
      },
    ],
  },
  google: {
    id: "google",
    displayName: "Google Pixel",
    steps: [
      {
        title: "Open Settings",
        description: "Go to Settings > About phone",
      },
      {
        title: "Enable Developer mode",
        description: "Tap 'Build number' 7 times until you see 'You are now a developer!'",
      },
      {
        title: "Enable USB Debugging",
        description: "Go to Settings > System > Developer options > Toggle 'USB debugging' ON",
      },
      {
        title: "Plug your phone",
        description: "Connect your phone to your PC with a USB cable",
      },
    ],
  },
  oneplus: {
    id: "oneplus",
    displayName: "OnePlus",
    steps: [
      {
        title: "Open Settings",
        description: "Go to Settings > About device",
      },
      {
        title: "Enable Developer mode",
        description: "Tap 'Build number' 7 times until you see 'Developer mode enabled'",
      },
      {
        title: "Enable USB Debugging",
        description: "Go to Settings > Additional Settings > Developer options > Toggle 'USB debugging' ON",
      },
      {
        title: "Plug your phone",
        description: "Connect your phone to your PC with a USB cable",
      },
    ],
  },
  huawei: {
    id: "huawei",
    displayName: "Huawei",
    steps: [
      {
        title: "Open Settings",
        description: "Go to Settings > About phone",
      },
      {
        title: "Enable Developer mode",
        description: "Tap 'Build number' 7 times and confirm with your PIN if asked",
      },
      {
        title: "Enable USB Debugging",
        description: "Go to Settings > System & updates > Developer options > Toggle 'USB debugging' ON",
      },
      {
        title: "Plug your phone",
        description: "Connect your phone to your PC with a USB cable",
      },
    ],
  },
  oppo: {
    id: "oppo",
    displayName: "Oppo",
    steps: [
      {
        title: "Open Settings",
        description: "Go to Settings > About phone",
      },
      {
        title: "Enable Developer mode",
        description: "Tap 'Build number' or 'Version' 7 times and confirm if prompted",
      },
      {
        title: "Enable USB Debugging",
        description: "Go to Settings > Additional Settings > Developer options > Toggle 'USB debugging' ON",
      },
      {
        title: "Plug your phone",
        description: "Connect your phone to your PC with a USB cable",
      },
    ],
  },
  realme: {
    id: "realme",
    displayName: "Realme",
    steps: [
      {
        title: "Open Settings",
        description: "Go to Settings > About phone > Version",
      },
      {
        title: "Enable Developer mode",
        description: "Tap 'Build number' 7 times until you see 'Developer options enabled'",
      },
      {
        title: "Enable USB Debugging",
        description: "Go to Settings > Additional settings > Developer options > Toggle 'USB debugging' ON",
      },
      {
        title: "Plug your phone",
        description: "Connect your phone to your PC with a USB cable",
      },
    ],
  },
  generic: {
    id: "generic",
    displayName: "Other",
    steps: [
      {
        title: "Open Settings",
        description: "Go to Settings > About phone",
      },
      {
        title: "Enable Developer mode",
        description: "Tap 'Build number' 7 times until you see a confirmation message",
      },
      {
        title: "Enable USB Debugging",
        description: "Go back to Settings > Developer options (or System > Developer options) > Toggle 'USB debugging' ON",
      },
      {
        title: "Plug your phone",
        description: "Connect your phone to your PC with a USB cable",
      },
    ],
  },
};

export const BRAND_ORDER: readonly PhoneBrand[] = [
  "samsung",
  "xiaomi",
  "google",
  "oneplus",
  "huawei",
  "oppo",
  "realme",
  "generic",
] as const;
