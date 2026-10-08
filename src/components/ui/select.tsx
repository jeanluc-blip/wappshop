import * as React from "react";
import { cn } from "@/lib/utils";

/** Liste déroulante native : le meilleur rendu sur iOS et Android. */
export const Select = React.forwardRef<HTMLSelectElement, React.ComponentProps<"select">>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select
        ref={ref}
        className={cn(
          "min-h-11 w-full rounded-xl border border-border bg-background px-3 py-2 text-base text-foreground disabled:opacity-50 aria-[invalid=true]:border-danger",
          className,
        )}
        {...props}
      >
        {children}
      </select>
    );
  },
);
