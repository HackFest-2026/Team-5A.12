import { Check, Clock3, ShieldAlert, X } from "lucide-react";
import { useRole } from "@/context/role-context";
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { money, relativeDate } from "@/lib/utils";
import { PageHeading } from "@/components/page-heading";
import { ErrorState, LoadingState } from "@/components/data-state";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState } from "react";

type Approval={id:string;title:string;description:string;action_type:string;amount:number|null;risk:string;status:string;requested_by:string;created_at:string;decided_by:string|null};
export function ApprovalsPage(){const{role}=useRole();const{data,error,loading,reload}=useApi<Approval[]>("/api/approvals");const[busy,setBusy]=useState("");const decide=async(id:string,decision:"approved"|"rejected")=>{setBusy(id);try{await api.post(`/api/approvals/${id}/decision`,role,{decision});await reload();}finally{setBusy("")}};if(loading)return<LoadingState/>;if(error||!data)return<ErrorState message={error} retry={reload}/>;return <><PageHeading eyebrow="Controlled actions" title="Approval queue" detail="High-impact financial decisions remain human-controlled, explainable and auditable."/>
  <div className="grid gap-4 xl:grid-cols-2">{data.map(a=><Card key={a.id} className={a.status==="pending"?"":"opacity-70"}><CardContent><div className="flex items-start justify-between gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-soft text-amber"><ShieldAlert size={18}/></div><div className="flex gap-2"><Badge tone={a.risk==="high"?"red":"amber"}>{a.risk} risk</Badge><Badge tone={a.status==="approved"?"green":a.status==="rejected"?"red":"neutral"}>{a.status}</Badge></div></div><h2 className="mt-4 font-bold">{a.title}</h2><p className="mt-1.5 text-sm leading-6 text-muted">{a.description}</p><div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-y border-line py-3 text-xs"><span><span className="text-muted">Requested by</span> <strong>{a.requested_by}</strong></span>{a.amount&&<span><span className="text-muted">Exposure</span> <strong className="tabular">{money(a.amount)}</strong></span>}<span className="inline-flex items-center gap-1 text-muted"><Clock3 size={12}/>{relativeDate(a.created_at)}</span></div>{a.status==="pending"&&(role==="cfo"?<div className="mt-4 flex justify-end gap-2"><Button size="sm" variant="outline" disabled={busy===a.id} onClick={()=>void decide(a.id,"rejected")}><X size={14}/>Reject</Button><Button size="sm" variant="brand" disabled={busy===a.id} onClick={()=>void decide(a.id,"approved")}><Check size={14}/>{busy===a.id?"Saving…":"Approve"}</Button></div>:<p className="mt-4 text-right text-xs font-semibold text-muted">Awaiting CFO approval</p>)}</CardContent></Card>)}</div></>}
