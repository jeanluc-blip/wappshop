import Image from "next/image";
import { cn } from "@/lib/utils";

type LogoProps = {
  size?: number;
  priority?: boolean;
  className?: string;
};

/** Logo WappShop (original, public/logo.svg) : à utiliser sur toutes les interfaces. */
export function Logo({ size = 36, priority = false, className }: LogoProps) {
  return (
    <Image
      src="/logo.svg"
      alt="WappShop"
      width={size}
      height={size}
      priority={priority}
      unoptimized
      className={cn("rounded-lg", className)}
    />
  );
}
