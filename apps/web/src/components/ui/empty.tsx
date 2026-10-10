import { CircleSlash2 } from "lucide-react";

export function Empty({ title, detail }: { title: string; detail: string }) {
  return <div className="flex min-h-56 flex-col items-center justify-center px-6 text-center">
    <div className="mb-3 rounded-full bg-canvas p-3 text-muted"><CircleSlash2 size={20} /></div>
    <p className="font-semibold text-ink">{title}</p><p className="mt-1 max-w-sm text-sm text-muted">{detail}</p>
  </div>;
}
