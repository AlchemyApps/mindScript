import React from "react";
import { cn } from "../utils/cn";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "primary" | "success" | "warning" | "error" | "info";
  size?: "sm" | "md";
  children: React.ReactNode;
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = "default", size = "md", children, ...props }, ref) => {
    return (
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-full font-medium",
          // Variants
          {
            "bg-gray-100 text-gray-700": variant === "default",
            "bg-primary/10 text-primary": variant === "primary",
            "bg-success/10 text-success": variant === "success",
            "bg-warning/10 text-warning": variant === "warning",
            "bg-error/10 text-error": variant === "error",
            "bg-accent/10 text-accent": variant === "info",
          },
          // Sizes
          {
            "px-2 py-0.5 text-xs": size === "sm",
            "px-3 py-1 text-sm": size === "md",
          },
          className
        )}
        ref={ref}
        {...props}
      >
        {children}
      </span>
    );
  }
);

Badge.displayName = "Badge";

// Special badges for audio features
export const AudioFeatureBadge: React.FC<{
  type: "voice" | "background" | "solfeggio" | "binaural" | "stereo" | "headphones";
  label?: string;
}> = ({ type, label }) => {
  const icons = {
    voice: "🎙️",
    background: "🎵",
    solfeggio: "✨",
    binaural: "🎧",
    stereo: "🔊",
    headphones: "🎧",
  };

  const labels = {
    voice: "Voice",
    background: "Background",
    solfeggio: "Solfeggio",
    binaural: "Binaural",
    stereo: "Stereo",
    headphones: "Headphones Required",
  };

  return (
    <Badge variant="info" size="sm">
      <span className="mr-1">{icons[type]}</span>
      {label || labels[type]}
    </Badge>
  );
};