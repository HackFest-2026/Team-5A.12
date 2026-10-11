import type { ReactNode } from "react";
import { AlertCircle, LoaderCircle } from "lucide-react";
import { Button } from "./ui/button";

export function LoadingState() {
  return <div className="flex min-h-[50vh] items-center justify-center text-muted"><LoaderCircle className="mr-2 animate-spin" size={18} /> Loading workspace…</div>;
}
export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return <div className="mx-auto mt-20 max-w-md rounded-panel border border-coral/20 bg-coral-soft p-6 text-center">
    <AlertCircle className="mx-auto mb-3 text-coral" /><p className="font-semibold text-ink">Unable to load this view</p>
    <p className="mt-1 text-sm text-muted">{message}</p>{retry && <Button className="mt-4" size="sm" onClick={retry}>Try again</Button>}
  </div>;
}
export function Stat({ label, value, note, icon }: { label: string; value: ReactNode; note: ReactNode; icon?: ReactNode }) {
  return <div className="rounded-panel border border-line bg-white/65 px-5 py-4">
    <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-[.11em] text-muted"><span>{label}</span><span className="text-brand">{icon}</span></div>
    <div className="tabular mt-4 font-display text-[31px] leading-none tracking-[-.035em] text-ink">{value}</div>
    <div className="mt-3 text-xs text-muted">{note}</div>
  </div>;
}
