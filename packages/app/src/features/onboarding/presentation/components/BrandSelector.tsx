import type { PhoneBrand } from "@phone-stream/shared";
import { BRAND_INSTRUCTIONS, BRAND_ORDER } from "../../domain/brand-instructions";

interface BrandSelectorProps {
  readonly onSelect: (brand: PhoneBrand) => void;
  readonly onBack: () => void;
}

export function BrandSelector({ onSelect, onBack }: BrandSelectorProps) {
  return (
    <div className="flex flex-col gap-5 px-6">
      <div className="text-center space-y-1">
        <h2 className="text-lg font-semibold text-zinc-100">
          What phone do you have?
        </h2>
        <p className="text-xs text-zinc-500">
          We'll show you the exact steps for your brand
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {BRAND_ORDER.map((brandId) => {
          const brand = BRAND_INSTRUCTIONS[brandId];
          return (
            <button
              key={brandId}
              onClick={() => onSelect(brandId)}
              className="flex items-center gap-2.5 px-3 py-3 rounded-lg bg-zinc-800/50 hover:bg-zinc-700/50 border border-zinc-800 hover:border-zinc-600 transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-300 shrink-0">
                {brand.displayName.charAt(0)}
              </div>
              <span className="text-sm text-zinc-300 font-medium">
                {brand.displayName}
              </span>
            </button>
          );
        })}
      </div>

      <button
        onClick={onBack}
        className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
      >
        Back
      </button>
    </div>
  );
}
