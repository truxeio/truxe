import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {}

export function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "card bg-white/70 backdrop-blur-sm shadow-soft",
        className,
      )}
      {...props}
    />
  );
}
