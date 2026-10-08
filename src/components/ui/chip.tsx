import * as React from "react";
import { cn } from "@/lib/utils";

type ChipProps = React.ComponentProps<"button"> & { pressed?: boolean };

/** Pastille à bascule (option sélectionnée / non sélectionnée). */
export function Chip({ className, pressed = false, type = "button", ...props }: ChipProps) {
  return (
    <button
      type={type}
      aria-pressed={pressed}
      className={cn(
        "min-h-10 cursor-pointer rounded-full border px-4 text-sm transition-colors disabled:pointer-events-none disabled:opacity-50",
        pressed ? "border-foreground bg-foreground text-background" : "border-border bg-background text-foreground hover:bg-surface",
        className,
      )}
      {...props}
    />
  );
}
