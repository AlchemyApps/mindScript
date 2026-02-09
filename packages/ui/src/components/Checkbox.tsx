"use client";

import * as React from "react";
import { cn } from "../utils/cn";

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, id, ...props }, ref) => (
    <div className="flex items-center">
      <input
        type="checkbox"
        ref={ref}
        id={id}
        className={cn(
          "h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary/50 focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
      {label && (
        <label htmlFor={id} className="ml-2 text-sm text-gray-700">
          {label}
        </label>
      )}
    </div>
  )
);
Checkbox.displayName = "Checkbox";

export { Checkbox };
