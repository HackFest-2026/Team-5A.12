import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

export function Modal({
  title,
  detail,
  children,
  close,
  wide = false,
}: {
  title: string;
  detail?: string;
  children: ReactNode;
  close: () => void;
  wide?: boolean;
}) {
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", key);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = previous;
    };
  }, [close]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-y-0 left-0 right-0 z-[70] flex items-center justify-center overflow-hidden bg-ink/30 p-3 backdrop-blur-[2px] sm:p-6 2xl:right-[390px] min-[1800px]:right-[420px]"
      onMouseDown={close}
    >
      <section
        className={cn(
          "flex max-h-[calc(100dvh-1.5rem)] w-full flex-col overflow-hidden rounded-[14px] border border-line bg-white shadow-lift animate-[enter_180ms_ease-out] sm:max-h-[calc(100dvh-3rem)]",
          wide ? "max-w-3xl" : "max-w-xl",
        )}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-start justify-between border-b border-line bg-white/95 p-5 backdrop-blur-xl sm:px-6">
          <div>
            <h2 className="font-display text-2xl tracking-[-.035em]">
              {title}
            </h2>
            {detail && <p className="mt-1 text-sm text-muted">{detail}</p>}
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close"
            onClick={close}
          >
            <X size={18} />
          </Button>
        </header>
        <div className="min-h-0 flex-1 overscroll-contain overflow-y-auto p-5 sm:p-6">
          {children}
        </div>
      </section>
    </div>,
    document.body,
  );
}
