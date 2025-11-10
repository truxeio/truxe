import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning";
}

export function Badge({
  className,
  variant = "default",
  ...props
}: BadgeProps) {
  const variantClass =
    {
      default: "bg-primary-light text-primary",
      success: "bg-success/15 text-success",
      warning: "bg-warning/15 text-warning",
    }[variant] ?? "bg-primary-light text-primary";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium",
        variantClass,
        className,
      )}
      {...props}
    />
  );
}
