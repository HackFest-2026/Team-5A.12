import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

export function Modal({title,detail,children,close,wide=false}:{title:string;detail?:string;children:ReactNode;close:()=>void;wide?:boolean}){
  useEffect(()=>{const key=(event:KeyboardEvent)=>{if(event.key==="Escape")close()};document.addEventListener("keydown",key);const previous=document.body.style.overflow;document.body.style.overflow="hidden";return()=>{document.removeEventListener("keydown",key);document.body.style.overflow=previous}},[close]);
  return <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-50 flex justify-end bg-ink/35 backdrop-blur-sm" onMouseDown={close}>
    <section className={cn("h-full w-full overflow-y-auto bg-white shadow-lift animate-[enter_180ms_ease-out]",wide?"max-w-3xl":"max-w-xl")} onMouseDown={event=>event.stopPropagation()}>
      <header className="sticky top-0 z-10 flex items-start justify-between border-b border-line bg-white/95 p-5 backdrop-blur-xl"><div><h2 className="text-xl font-extrabold tracking-[-.035em]">{title}</h2>{detail&&<p className="mt-1 text-sm text-muted">{detail}</p>}</div><Button variant="ghost" size="icon" aria-label="Close" onClick={close}><X size={18}/></Button></header>
      <div className="p-5">{children}</div>
    </section>
  </div>;
}
