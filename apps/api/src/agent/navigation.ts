import { agentCatalog, catalogForRole, type AgentPage, type AgentRole } from "./catalog.js";

export type AgentPageContext = {
  pageId?: string | null;
  route: string;
  search?: string;
  locale?: string;
  timezone?: string;
  uiStateVersion: number;
};

export type NavigationResolution =
  | { kind: "navigate"; answer: string; command: { type: "navigate"; pageId: string; route: string; uiStateVersion: number } }
  | { kind: "answer" | "clarify" | "denied"; answer: string; command: null };

const navigationIntent = /\b(open|show|take me|go|navigate|view|see|display|filter|find|where|list)\b/i;

function normalize(value: string) {
  return value.toLowerCase().replace(/[-_]/g, " ").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function scorePage(message: string, page: AgentPage) {
  return page.aliases.reduce((score, alias) => {
    const normalizedAlias = normalize(alias);
    if (message === normalizedAlias) return Math.max(score, 100 + normalizedAlias.length);
    if (message.includes(normalizedAlias)) return Math.max(score, 10 + normalizedAlias.split(" ").length * 4 + normalizedAlias.length / 100);
    return score;
  }, 0);
}

function invoiceRoute(message: string, route: string) {
  const statuses = ["partially paid", "overdue", "disputed", "draft", "sent", "paid"];
  const status = statuses.find((value) => message.includes(value));
  if (!status) return route;
  const params = new URLSearchParams({ status: status.replace(" ", "_") });
  return `${route}?${params.toString()}`;
}

export function resolveNavigation(messageInput: string, role: AgentRole, context: AgentPageContext): NavigationResolution {
  const message = normalize(messageInput);
  const ranked = agentCatalog.pages
    .map((page) => ({ page, score: scorePage(message, page) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);

  const requested = ranked[0]?.page;
  if (requested && !requested.roles.includes(role)) {
    return { kind: "denied", answer: `${requested.label} is outside your current role and data scope.`, command: null };
  }

  if (!requested) {
    const available = catalogForRole(role).map((page) => page.label).join(", ");
    return {
      kind: navigationIntent.test(messageInput) ? "clarify" : "answer",
      answer: navigationIntent.test(messageInput)
        ? `I couldn't identify the destination. You can ask me to open: ${available}.`
        : `Navigation is connected. Ask me to open a page or filter invoices. Data questions and actions are the next implementation step.`,
      command: null,
    };
  }

  const route = requested.id === "page.invoices" ? invoiceRoute(message, requested.route) : requested.route;
  const currentLocation = `${context.route}${context.search ?? ""}`;
  if (currentLocation === route) {
    return { kind: "answer", answer: `You're already on ${requested.label}.`, command: null };
  }

  const status = new URL(route, "http://cashpilot.local").searchParams.get("status");
  return {
    kind: "navigate",
    answer: status
      ? `Opened ${requested.label} and applied the ${status.replace("_", " ")} filter.`
      : `Opened ${requested.label}.`,
    command: { type: "navigate", pageId: requested.id, route, uiStateVersion: context.uiStateVersion + 1 },
  };
}
