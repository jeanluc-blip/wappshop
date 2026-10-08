import * as React from "react";
import { cn } from "@/lib/utils";

// text-base (16 px) : évite le zoom automatique d'iOS Safari à la saisie.
export const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  function Textarea({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(
          "min-h-24 w-full rounded-xl border border-border bg-background px-3 py-2 text-base text-foreground placeholder:text-muted/70 disabled:opacity-50 aria-[invalid=true]:border-danger",
          className,
        )}
        {...props}
      />
    );
  },
);
