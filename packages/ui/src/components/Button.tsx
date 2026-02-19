import React from "react";
import { cn } from "../utils/cn";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline" | "default" | "destructive";
  asChild?: boolean;
  size?: "sm" | "md" | "lg" | "icon";
  children: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", asChild, children, ...props }, ref) => {
    return (
      <button
        className={cn(
          // Base styles
          "inline-flex items-center justify-center rounded-xl font-medium transition-all duration-180 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed",
          // Variants
          {
            "bg-primary text-white hover:opacity-90 focus:ring-primary/50": variant === "primary" || variant === "default",
            "bg-surface border border-gray-200 text-text hover:bg-gray-50 focus:ring-primary/50": variant === "secondary" || variant === "outline",
            "bg-transparent text-text hover:bg-gray-100 focus:ring-primary/50": variant === "ghost",
            "bg-error text-white hover:opacity-90 focus:ring-error/50": variant === "danger",
            "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500/50": variant === "destructive",
          },
          // Sizes
          {
            "px-3 py-1.5 text-sm": size === "sm",
            "px-4 py-2 text-base": size === "md",
            "px-6 py-3 text-lg": size === "lg",
            "h-9 w-9 p-0": size === "icon",
          },
          className
        )}
        ref={ref}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";