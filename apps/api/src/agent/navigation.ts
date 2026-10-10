import {
  agentCatalog,
  catalogForRole,
  type AgentPage,
  type AgentRole,
  type AgentUiAction,
} from "./catalog.js";

export type AgentPageContext = {
  pageId?: string | null;
  route: string;
  search?: string;
  locale?: string;
  timezone?: string;
  uiStateVersion: number;
};

export type NavigationResolution =
  | {
      kind: "navigate";
      answer: string;
      command: {
        type: "navigate";
        pageId: string;
        route: string;
        uiStateVersion: number;
      };
    }
  | { kind: "answer" | "clarify" | "denied"; answer: string; command: null };

const navigationIntent =
  /\b(open|show|take me|go|navigate|view|see|display|filter|find|where|list)\b/i;

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[-_]/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(a|an|the)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreAliases(message: string, aliases: string[]) {
  return aliases.reduce((score, alias) => {
    const normalizedAlias = normalize(alias);
    if (message === normalizedAlias)
      return Math.max(score, 100 + normalizedAlias.length);
    if (message.includes(normalizedAlias))
      return Math.max(
        score,
        10 +
          normalizedAlias.split(" ").length * 4 +
          normalizedAlias.length / 100,
      );
    return score;
  }, 0);
}

function scorePage(message: string, page: AgentPage) {
  return scoreAliases(message, page.aliases);
}

function scoreAction(message: string, action: AgentUiAction) {
  return scoreAliases(message, action.aliases);
}

export function isDirectAgentUiIntent(messageInput: string) {
  const message = normalize(messageInput);
  const hasExplicitAction = agentCatalog.uiActions.some(
    (action) => scoreAction(message, action) >= 10,
  );
  const hasLikelyFormData =
    /(?:\bINV-\d+\b|\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b|₹|\b(?:amount|due|reference|ref|via|email|company|customer|contact|terms|credit|score)\s+(?:is|of|:)?\s*[^\s]+)/i.test(
      messageInput,
    );
  const hasPage = agentCatalog.pages.some(
    (page) => scorePage(message, page) > 0,
  );
  return (
    (hasExplicitAction && !hasLikelyFormData) ||
    (navigationIntent.test(messageInput) && hasPage && !hasLikelyFormData)
  );
}

function invoiceRoute(message: string, route: string) {
  const statuses = [
    "partially paid",
    "overdue",
    "disputed",
    "draft",
    "sent",
    "paid",
  ];
  const status = statuses.find((value) => message.includes(value));
  if (!status) return route;
  const params = new URLSearchParams({ status: status.replace(" ", "_") });
  return `${route}?${params.toString()}`;
}

export function resolveNavigation(
  messageInput: string,
  role: AgentRole,
  context: AgentPageContext,
): NavigationResolution {
  const message = normalize(messageInput);
  const action = agentCatalog.uiActions
    .map((candidate) => ({
      action: candidate,
      score: scoreAction(message, candidate),
    }))
    .filter((entry) => entry.score >= 10)
    .sort((left, right) => right.score - left.score)[0]?.action;

  if (action) {
    if (!action.roles.includes(role))
      return {
        kind: "denied",
        answer: `${action.label} is outside your current role and data scope.`,
        command: null,
      };
    const route = action.route;
    if (`${context.route}${context.search ?? ""}` === route)
      return {
        kind: "answer",
        answer: `${action.label} is already open.`,
        command: null,
      };
    const page =
      agentCatalog.pages.find(
        (candidate) =>
          route.startsWith(candidate.route) && candidate.route !== "/",
      ) ?? agentCatalog.pages.find((candidate) => candidate.route === "/");
    return {
      kind: "navigate",
      answer: `Opened ${action.label.toLowerCase()}. Complete the required fields, then review and submit it.`,
      command: {
        type: "navigate",
        pageId: page?.id ?? "page.overview",
        route,
        uiStateVersion: context.uiStateVersion + 1,
      },
    };
  }
  const ranked = agentCatalog.pages
    .map((page) => ({ page, score: scorePage(message, page) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);

  const requested = ranked[0]?.page;
  if (requested && !requested.roles.includes(role)) {
    return {
      kind: "denied",
      answer: `${requested.label} is outside your current role and data scope.`,
      command: null,
    };
  }

  if (!requested) {
    const available = catalogForRole(role)
      .map((page) => page.label)
      .join(", ");
    return {
      kind: navigationIntent.test(messageInput) ? "clarify" : "answer",
      answer: navigationIntent.test(messageInput)
        ? `I couldn't identify the destination. You can ask me to open: ${available}.`
        : "I couldn't resolve that as a direct UI command.",
      command: null,
    };
  }

  const route =
    requested.id === "page.invoices"
      ? invoiceRoute(message, requested.route)
      : requested.route;
  const currentLocation = `${context.route}${context.search ?? ""}`;
  if (currentLocation === route) {
    return {
      kind: "answer",
      answer: `You're already on ${requested.label}.`,
      command: null,
    };
  }

  const status = new URL(route, "http://cashpilot.local").searchParams.get(
    "status",
  );
  return {
    kind: "navigate",
    answer: status
      ? `Opened ${requested.label} and applied the ${status.replace("_", " ")} filter.`
      : `Opened ${requested.label}.`,
    command: {
      type: "navigate",
      pageId: requested.id,
      route,
      uiStateVersion: context.uiStateVersion + 1,
    },
  };
}
