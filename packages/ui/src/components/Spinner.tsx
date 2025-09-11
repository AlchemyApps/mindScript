import React from "react";
import { cn } from "../utils/cn";

export interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg";
  color?: "primary" | "white" | "gray";
}

export const Spinner: React.FC<SpinnerProps> = ({
  className,
  size = "md",
  color = "primary",
  ...props
}) => {
  return (
    <div
      className={cn(
        "inline-block animate-spin rounded-full border-2 border-current border-t-transparent",
        // Sizes
        {
          "h-4 w-4": size === "sm",
          "h-6 w-6": size === "md",
          "h-8 w-8": size === "lg",
        },
        // Colors
        {
          "text-primary": color === "primary",
          "text-white": color === "white",
          "text-gray-400": color === "gray",
        },
        className
      )}
      role="status"
      aria-label="Loading"
      {...props}
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
};

export const LoadingOverlay: React.FC<{
  message?: string;
  fullScreen?: boolean;
}> = ({ message = "Loading...", fullScreen = false }) => {
  const containerClass = fullScreen
    ? "fixed inset-0 z-50"
    : "absolute inset-0";

  return (
    <div
      className={cn(
        containerClass,
        "flex items-center justify-center bg-white/80 backdrop-blur-sm"
      )}
    >
      <div className="flex flex-col items-center gap-3">
        <Spinner size="lg" />
        {message && (
          <p className="text-sm text-muted">{message}</p>
        )}
      </div>
    </div>
  );
};