import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-white hover:bg-primary-dark focus-visible:ring-primary",
  secondary:
    "bg-white text-foreground border border-border hover:bg-primary-light/40 hover:border-primary/30 focus-visible:ring-primary-light",
  ghost:
    "bg-transparent text-foreground hover:bg-primary-light/40 focus-visible:ring-primary-light",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3 py-2 text-sm",
  md: "px-5 py-3 text-base",
  lg: "px-6 py-4 text-lg",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = "primary", size = "md", disabled, ...props },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "active:scale-[0.99]",
          disabled && "cursor-not-allowed opacity-60",
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        disabled={disabled}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";
