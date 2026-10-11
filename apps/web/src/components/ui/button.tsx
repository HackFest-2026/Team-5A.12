import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const variants = cva(
  "ui-button inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/25 disabled:pointer-events-none disabled:opacity-45",
  { variants: {
    variant: {
      default: "ui-button-default bg-ink text-white",
      brand: "ui-button-brand bg-brand text-white",
      outline: "ui-button-outline border border-line bg-white text-ink",
      ghost: "ui-button-ghost text-muted",
      danger: "ui-button-danger bg-coral text-white",
    },
    size: { default: "h-10 px-4", sm: "h-8 px-3 text-xs", icon: "h-10 w-10" },
  }, defaultVariants: { variant: "default", size: "default" } },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof variants> {}
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, ...props }, ref) =>
  <button ref={ref} className={cn(variants({ variant, size }), className)} {...props} />);
Button.displayName = "Button";
