import * as React from "react";
import { cn } from "@/lib/utils";

// text-base (16 px) : évite le zoom automatique d'iOS Safari à la saisie.
export const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  function Input({ className, type, ...props }, ref) {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          "min-h-11 w-full rounded-xl border border-border bg-background px-3 py-2 text-base text-foreground placeholder:text-muted/70 disabled:opacity-50 aria-[invalid=true]:border-danger",
          className,
        )}
        {...props}
      />
    );
  },
);
