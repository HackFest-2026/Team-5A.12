import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const tones = {
  neutral: "bg-ink/6 text-muted",
  green: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-soft text-amber",
  red: "bg-coral-soft text-coral",
  blue: "bg-blue-50 text-blue-700",
};
export function Badge({ className, tone = "neutral", ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof tones }) {
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold capitalize leading-none", tones[tone], className)} {...props} />;
}
