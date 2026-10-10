import { Activity, Filter } from "lucide-react";
import { useApi } from "@/hooks/use-api";
import { shortDate } from "@/lib/utils";
import { PageHeading } from "@/components/page-heading";
import { ErrorState, LoadingState } from "@/components/data-state";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Item={id:number;actor_name:string;actor_role:string;action:string;entity_type:string;entity_id:string;detail:string;created_at:string};
export function AuditPage(){const{data,error,loading,reload}=useApi<Item[]>("/api/audit");if(loading)return<LoadingState/>;if(error||!data)return<ErrorState message={error} retry={reload}/>;return <><PageHeading eyebrow="Governance" title="Audit log" detail="Immutable operational history for human and future agent actions." action={<Button variant="outline"><Filter size={15}/>Filter events</Button>}/><Card className="overflow-hidden"><div className="divide-y divide-line">{data.map(i=><div key={i.id} className="grid gap-3 px-5 py-4 md:grid-cols-[40px_1fr_150px_150px] md:items-center"><div className="grid h-9 w-9 place-items-center rounded-full bg-canvas text-muted"><Activity size={15}/></div><div><p className="text-sm"><strong>{i.actor_name}</strong> <span className="text-muted">{i.action}</span></p><p className="mt-1 text-xs text-muted">{i.detail}</p></div><div><Badge>{i.actor_role}</Badge><p className="mt-1 text-[10px] text-muted">{i.entity_type} · {i.entity_id}</p></div><time className="tabular text-xs text-muted md:text-right">{shortDate(i.created_at)}<span className="block">{new Date(i.created_at).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}</span></time></div>)}</div></Card></>}
