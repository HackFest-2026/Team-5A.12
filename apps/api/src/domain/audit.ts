import { query } from "../db.js";
import type { Actor } from "./types.js";

export async function audit(actor: Actor, action: string, entityType: string, entityId: string, detail: string, tenantId = actor.tenantId) {
  await query(
    `INSERT INTO audit_logs (tenant_id, actor_name, actor_role, action, entity_type, entity_id, detail)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [tenantId, actor.name, actor.role, action, entityType, entityId, detail],
  );
}
