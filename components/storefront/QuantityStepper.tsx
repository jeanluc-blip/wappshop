import { Minus, Plus } from "lucide-react";

type QuantityStepperProps = {
  quantity: number;
  onDecrement: () => void;
  onIncrement: () => void;
  label: string;
  className?: string;
};

/** Sélecteur − quantité + (zones tactiles de 44 px). */
export function QuantityStepper({ quantity, onDecrement, onIncrement, label, className = "" }: QuantityStepperProps) {
  return (
    <div role="group" aria-label={`Quantité : ${label}`} className={`flex h-11 items-center justify-between rounded-xl border border-border ${className}`}>
      <button type="button" onClick={onDecrement} aria-label={`Retirer un ${label}`} className="grid h-full w-11 cursor-pointer place-items-center">
        <Minus size={18} aria-hidden="true" />
      </button>
      <b aria-live="polite" className="min-w-6 text-center">
        {quantity}
      </b>
      <button type="button" onClick={onIncrement} aria-label={`Ajouter un ${label}`} className="grid h-full w-11 cursor-pointer place-items-center">
        <Plus size={18} aria-hidden="true" />
      </button>
    </div>
  );
}
