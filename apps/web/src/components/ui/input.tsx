import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) =>
  <input ref={ref} className={cn("ui-control h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none placeholder:text-muted/65 focus:border-brand/55 focus:ring-2 focus:ring-brand/10", className)} {...props} />);
Input.displayName = "Input";

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn("ui-control h-10 rounded-lg border border-line bg-white px-3 text-sm font-medium text-ink outline-none focus:border-brand/55 focus:ring-2 focus:ring-brand/10", className)} {...props} />;
}
