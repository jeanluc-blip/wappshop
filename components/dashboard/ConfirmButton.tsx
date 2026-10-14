"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type ConfirmButtonProps = {
  label: string;
  /** Question affichée avant la confirmation. */
  message: string;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
  disabled?: boolean;
  size?: "default" | "sm" | "full";
};

/** Suppression en deux temps (sans boîte de dialogue du navigateur, plus fiable sur mobile). */
export function ConfirmButton({ label, message, confirmLabel, onConfirm, disabled, size = "default" }: ConfirmButtonProps) {
  const [armed, setArmed] = useState(false);

  if (!armed) {
    return (
      <Button type="button" variant="destructive" size={size} disabled={disabled} onClick={() => setArmed(true)}>
        {label}
      </Button>
    );
  }

  return (
    <div role="group" aria-label={message} className="rounded-xl border border-border bg-surface p-3">
      <p className="mb-2 text-sm">{message}</p>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => setArmed(false)}>
          Annuler
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={disabled}
          onClick={async () => {
            await onConfirm();
            setArmed(false);
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </div>
  );
}
