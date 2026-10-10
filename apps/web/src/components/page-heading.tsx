import type { ReactNode } from "react";

export function PageHeading({ eyebrow, title, detail, action }: { eyebrow?: string; title: string; detail: string; action?: ReactNode }) {
  return <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
    <div>
      {eyebrow && <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[.16em] text-brand">{eyebrow}</p>}
      <h1 className="text-[28px] font-bold tracking-[-.035em] text-ink md:text-[32px]">{title}</h1>
      <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">{detail}</p>
    </div>
    {action}
  </div>;
}
