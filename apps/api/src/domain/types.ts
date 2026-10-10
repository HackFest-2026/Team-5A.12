export type Role = "cfo" | "manager" | "customer" | "platform_admin";

export type Actor = {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: Role;
  tenantId: string | null;
  tenantName: string | null;
  customerId: string | null;
};
