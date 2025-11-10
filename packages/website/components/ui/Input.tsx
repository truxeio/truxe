import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, hasError = false, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "w-full rounded-xl border bg-white/80 px-4 py-3 text-base text-foreground shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        hasError && "border-error focus-visible:ring-error",
        className,
      )}
      {...props}
    />
  ),
);

Input.displayName = "Input";
