import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const variants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 disabled:pointer-events-none disabled:opacity-45 active:translate-y-px",
  { variants: {
    variant: {
      default: "bg-ink text-white hover:bg-ink/90 shadow-sm",
      brand: "bg-brand text-white hover:bg-brand-dark shadow-sm",
      outline: "border border-line bg-white text-ink hover:border-ink/20 hover:bg-canvas",
      ghost: "text-muted hover:bg-ink/5 hover:text-ink",
      danger: "bg-coral text-white hover:bg-coral/90",
    },
    size: { default: "h-10 px-4", sm: "h-8 px-3 text-xs", icon: "h-10 w-10" },
  }, defaultVariants: { variant: "default", size: "default" } },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof variants> {}
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, ...props }, ref) =>
  <button ref={ref} className={cn(variants({ variant, size }), className)} {...props} />);
Button.displayName = "Button";
