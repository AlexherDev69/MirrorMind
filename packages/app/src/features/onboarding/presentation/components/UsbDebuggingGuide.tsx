import type { PhoneBrand } from "@phone-stream/shared";
import { BRAND_INSTRUCTIONS } from "../../domain/brand-instructions";

interface UsbDebuggingGuideProps {
  readonly brand: PhoneBrand;
  readonly onDone: () => void;
  readonly onBack: () => void;
}

export function UsbDebuggingGuide({ brand, onDone, onBack }: UsbDebuggingGuideProps) {
  const instruction = BRAND_INSTRUCTIONS[brand];

  return (
    <div className="flex flex-col gap-5 px-6">
      <div className="text-center space-y-1">
        <h2 className="text-base font-semibold text-zinc-100">
          Enable USB Debugging
        </h2>
        <p className="text-xs text-zinc-500">
          {instruction.displayName} — Follow these steps
        </p>
      </div>

      <div className="space-y-3">
        {instruction.steps.map((step, index) => (
          <div
            key={index}
            className="flex gap-3 p-3 rounded-lg bg-zinc-800/50 border border-zinc-800"
          >
            <div className="w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
              {index + 1}
            </div>
            <div className="space-y-0.5 min-w-0">
              <p className="text-sm font-medium text-zinc-200">{step.title}</p>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {step.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <button
          onClick={onDone}
          className="w-full py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold transition-colors"
        >
          Done — I enabled USB debugging
        </button>
        <button
          onClick={onBack}
          className="w-full text-xs text-zinc-600 hover:text-zinc-400 transition-colors py-1"
        >
          Choose a different brand
        </button>
      </div>

      <p className="text-xs text-zinc-600 text-center">
        After enabling USB debugging, plug your phone via USB. The app will detect it automatically.
      </p>
    </div>
  );
}
