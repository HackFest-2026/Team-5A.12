import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const workspaceDir = "/Users/shivanandhulikatti/Desktop/dev/hackathons/kle-hackfest/cashpilot-agentic";
const buildDir = path.join(workspaceDir, ".codex-pptx", "system-workflows");
const outputDir = path.join(workspaceDir, "output");
const finalPath = path.join(outputDir, "cashpilot-base-and-agent-workflows.pptx");
const skillDir = "/Users/shivanandhulikatti/.codex/plugins/cache/openai-primary-runtime/presentations/26.1009.11318/skills/presentations";
const pythonExecutable = "/Users/shivanandhulikatti/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3";
const FONT = "Arial";
const C = {
  bg: "#F6F4EE",
  ink: "#102A3A",
  muted: "#526472",
  blue: "#E3F1FA",
  blueLine: "#87B7D2",
  teal: "#DFF1EC",
  tealDark: "#176B66",
  violet: "#EEEAF9",
  violetDark: "#514598",
  amber: "#FFF0D0",
  amberDark: "#8B5B00",
  slate: "#E8EFF1",
  slateLine: "#B7C6CC",
  white: "#FFFFFF",
};

async function writeBlob(filePath, blob) {
  await fs.writeFile(filePath, new Uint8Array(await blob.arrayBuffer()));
}

function text(slide, value, position, style = {}) {
  const shape = slide.shapes.add({
    geometry: "textbox",
    position,
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
  });
  shape.text = value;
  shape.text.style = {
    typeface: FONT,
    fontSize: style.fontSize ?? 17,
    bold: style.bold ?? false,
    color: style.color ?? C.ink,
    alignment: style.alignment ?? "left",
    autoFit: style.autoFit ?? "none",
  };
  shape.text.verticalAlignment = style.verticalAlignment ?? "top";
  shape.text.insets = style.insets ?? 0;
  return shape;
}

function box(slide, name, position, fill, line = "#CED8DE", radius = 18) {
  return slide.shapes.add({
    name,
    geometry: "roundRect",
    position,
    fill,
    line: { style: "solid", fill: line, width: 1.5 },
    borderRadius: radius,
  });
}

function node(slide, { x, y, w, h, number, title, body, fill, line, titleColor = C.ink, bodyColor = C.muted }) {
  const outer = box(slide, title, { left: x, top: y, width: w, height: h }, fill, line, 18);
  if (number) {
    slide.shapes.add({
      geometry: "ellipse",
      position: { left: x + 16, top: y + 17, width: 28, height: 28 },
      fill: titleColor,
      line: { style: "solid", fill: titleColor, width: 0 },
    });
    text(slide, String(number), { left: x + 16, top: y + 19, width: 28, height: 20 }, {
      fontSize: 13, bold: true, color: C.white, alignment: "center",
    });
  }
  const titleLeft = x + (number ? 54 : 18);
  text(slide, title, { left: titleLeft, top: y + 15, width: w - (number ? 70 : 36), height: 29 }, {
    fontSize: 18, bold: true, color: titleColor,
  });
  text(slide, body, { left: x + 18, top: y + 55, width: w - 36, height: h - 68 }, {
    fontSize: 14, color: bodyColor,
  });
  return outer;
}

function arrow(slide, from, to, options = {}) {
  return slide.shapes.connect(from, to, {
    kind: options.kind ?? "straight",
    fromSide: options.fromSide ?? "right",
    toSide: options.toSide ?? "left",
    line: { style: options.style ?? "solid", fill: options.color ?? "#4E7D78", width: options.width ?? 2.5 },
    tail: { type: "arrow", width: "med", length: "med" },
  });
}

function titleBlock(slide, titleValue, subtitle, index) {
  text(slide, titleValue, { left: 58, top: 34, width: 830, height: 50 }, {
    fontSize: 35, bold: true, color: C.ink,
  });
  text(slide, subtitle, { left: 60, top: 88, width: 920, height: 28 }, {
    fontSize: 18, color: C.muted,
  });
  text(slide, String(index).padStart(2, "0"), { left: 1135, top: 42, width: 85, height: 32 }, {
    fontSize: 20, bold: true, color: C.tealDark, alignment: "right",
  });
}

function addBaseWorkflow(deck) {
  const slide = deck.slides.add();
  slide.background.fill = C.bg;
  titleBlock(slide, "Base Application Workflow", "Direct user actions through authenticated REST endpoints", 1);

  const react = node(slide, {
    x: 55, y: 225, w: 175, h: 190, number: 1,
    title: "React interface",
    body: "User opens a page, sets filters or submits a form.",
    fill: C.blue, line: C.blueLine, titleColor: "#1C668D", bodyColor: "#31596F",
  });
  const request = node(slide, {
    x: 255, y: 225, w: 175, h: 190, number: 2,
    title: "REST request",
    body: "The browser calls a GET, POST, PATCH or DELETE endpoint.",
    fill: C.white, line: "#CED8DE",
  });
  const auth = node(slide, {
    x: 455, y: 225, w: 175, h: 190, number: 3,
    title: "Authenticate",
    body: "The API verifies the HTTP-only session and loads the actor.",
    fill: C.violet, line: "#C6BDE9", titleColor: C.violetDark, bodyColor: "#665B91",
  });
  const policy = node(slide, {
    x: 655, y: 225, w: 175, h: 190, number: 4,
    title: "Authorize",
    body: "Role, tenant and customer scope restrict the request.",
    fill: C.amber, line: "#E4C675", titleColor: C.amberDark, bodyColor: "#7A6234",
  });
  const endpoint = node(slide, {
    x: 855, y: 225, w: 175, h: 190, number: 5,
    title: "Endpoint logic",
    body: "Validate inputs, apply finance rules and run scoped SQL.",
    fill: C.teal, line: "#9BC9BD", titleColor: C.tealDark, bodyColor: "#3F716C",
  });
  const database = node(slide, {
    x: 1055, y: 225, w: 170, h: 190, number: 6,
    title: "PostgreSQL",
    body: "Read or update business records. Writes also create audit entries.",
    fill: C.slate, line: C.slateLine, titleColor: "#294955", bodyColor: "#586E77",
  });

  arrow(slide, react, request, { color: "#3B7FA0" });
  arrow(slide, request, auth, { color: "#6B6297" });
  arrow(slide, auth, policy, { color: "#947538" });
  arrow(slide, policy, endpoint, { color: "#4E7D78" });
  arrow(slide, endpoint, database, { color: "#4E7D78" });

  const readBand = box(slide, "Read path", { left: 655, top: 455, width: 275, height: 66 }, "#EAF3F7", "#BFD6E0", 15);
  text(slide, "READ PATH", { left: 675, top: 467, width: 95, height: 18 }, { fontSize: 11, bold: true, color: "#257298" });
  text(slide, "Scoped SELECT and JSON response", { left: 675, top: 488, width: 235, height: 22 }, { fontSize: 14, color: "#31596F" });
  const writeBand = box(slide, "Write path", { left: 950, top: 455, width: 275, height: 66 }, "#FFF0D0", "#E4C675", 15);
  text(slide, "WRITE PATH", { left: 970, top: 467, width: 100, height: 18 }, { fontSize: 11, bold: true, color: C.amberDark });
  text(slide, "Zod validation, mutation and audit", { left: 970, top: 488, width: 235, height: 22 }, { fontSize: 14, color: "#7A6234" });
  slide.shapes.connect(endpoint, readBand, {
    kind: "elbow", fromSide: "bottom", toSide: "top",
    line: { style: "solid", fill: "#3B7FA0", width: 2 },
    tail: { type: "arrow", width: "sm", length: "sm" },
  });
  slide.shapes.connect(database, writeBand, {
    kind: "elbow", fromSide: "bottom", toSide: "top",
    line: { style: "solid", fill: "#C38A16", width: 2 },
    tail: { type: "arrow", width: "sm", length: "sm" },
  });

  const returnBand = box(slide, "Return to UI", { left: 210, top: 565, width: 850, height: 58 }, "#102A3A", "#102A3A", 16);
  text(slide, "API RESPONSE", { left: 235, top: 577, width: 120, height: 18 }, { fontSize: 11, bold: true, color: "#74D2C4" });
  text(slide, "The interface renders records, refreshes changed data and shows validation or permission errors", { left: 365, top: 574, width: 670, height: 25 }, {
    fontSize: 15, color: C.white,
  });
  slide.shapes.connect(database, returnBand, {
    kind: "elbow", fromSide: "bottom", toSide: "right",
    line: { style: "solid", fill: "#4E7D78", width: 2 },
    tail: { type: "arrow", width: "sm", length: "sm" },
  });
  slide.shapes.connect(returnBand, react, {
    kind: "elbow", fromSide: "left", toSide: "bottom",
    line: { style: "solid", fill: "#3B7FA0", width: 2 },
    tail: { type: "arrow", width: "sm", length: "sm" },
  });

  text(slide, "The user explicitly selects every page, filter and action. The base application has no model or agent orchestration.", { left: 58, top: 661, width: 1164, height: 24 }, {
    fontSize: 14, color: C.muted, alignment: "center",
  });
  slide.speakerNotes.text = "Source: cashpilot/apps/api/src/server.ts and cashpilot/apps/web/src/lib/api.ts";
}

function addAgentWorkflow(deck) {
  const slide = deck.slides.add();
  slide.background.fill = C.bg;
  titleBlock(slide, "Application Workflow With Agent", "Natural-language intent becomes navigation, evidence-backed analysis or a confirmed financial action", 2);

  const panel = node(slide, {
    x: 45, y: 210, w: 190, h: 250, number: 1,
    title: "Agent panel",
    body: "Sends the user message, current route, filters and recent history. Receives SSE progress and results.",
    fill: C.blue, line: C.blueLine, titleColor: "#1C668D", bodyColor: "#31596F",
  });
  const api = node(slide, {
    x: 270, y: 210, w: 190, h: 250, number: 2,
    title: "Agent API",
    body: "Authenticates the actor, redacts likely secrets and creates a persistent run.",
    fill: C.white, line: "#CED8DE",
  });

  const router = box(slide, "Execution router", { left: 495, top: 155, width: 260, height: 360 }, "#102A3A", "#102A3A", 22);
  text(slide, "3  EXECUTION ROUTER", { left: 517, top: 174, width: 215, height: 24 }, { fontSize: 14, bold: true, color: "#74D2C4" });
  const direct = node(slide, {
    x: 517, y: 213, w: 216, h: 76,
    title: "Direct resolver", body: "Navigation and URL filters", fill: "#1D4559", line: "#477086", titleColor: C.white, bodyColor: "#BDD4DF",
  });
  const local = node(slide, {
    x: 517, y: 306, w: 216, h: 76,
    title: "Local fallback", body: "Live reads without OpenRouter", fill: "#1D4559", line: "#477086", titleColor: C.white, bodyColor: "#BDD4DF",
  });
  const graph = node(slide, {
    x: 517, y: 399, w: 216, h: 92,
    title: "LangGraph + model", body: "OpenRouter planning and bounded tool loop", fill: "#176B66", line: "#4A9990", titleColor: C.white, bodyColor: "#D2F3EC",
  });

  const toolPlane = box(slide, "Tool plane", { left: 790, top: 155, width: 250, height: 360 }, C.white, "#CED8DE", 22);
  text(slide, "4  ROLE-SCOPED TOOLS", { left: 812, top: 174, width: 205, height: 24 }, { fontSize: 14, bold: true, color: C.violetDark });
  const uiTools = node(slide, {
    x: 812, y: 213, w: 206, h: 76,
    title: "UI tools", body: "Open pages and prefill forms", fill: C.violet, line: "#C6BDE9", titleColor: C.violetDark, bodyColor: "#665B91",
  });
  const readTools = node(slide, {
    x: 812, y: 306, w: 206, h: 76,
    title: "Read + analysis", body: "Scoped records and evidence", fill: C.teal, line: "#9BC9BD", titleColor: C.tealDark, bodyColor: "#3F716C",
  });
  const writeTools = node(slide, {
    x: 812, y: 399, w: 206, h: 92,
    title: "Write proposal", body: "Validated, hashed pending action", fill: C.amber, line: "#E4C675", titleColor: C.amberDark, bodyColor: "#7A6234",
  });

  const trusted = box(slide, "Trusted business layer", { left: 1075, top: 210, width: 165, height: 250 }, C.slate, C.slateLine, 22);
  text(slide, "5  TRUSTED LAYER", { left: 1093, top: 229, width: 130, height: 22 }, { fontSize: 12, bold: true, color: "#586E77" });
  text(slide, "Finance services", { left: 1093, top: 268, width: 130, height: 50 }, { fontSize: 20, bold: true, color: "#17323D" });
  text(slide, "Permissions\nBusiness rules\nTransactions\n\nPostgreSQL\nAudit + checkpoints", { left: 1093, top: 335, width: 130, height: 105 }, { fontSize: 14, color: "#586E77" });

  arrow(slide, panel, api, { color: "#3B7FA0" });
  arrow(slide, api, router, { color: "#4E7D78" });
  arrow(slide, router, toolPlane, { color: "#4E7D78" });
  arrow(slide, readTools, trusted, { color: "#4E7D78" });

  const approval = box(slide, "Human confirmation", { left: 775, top: 550, width: 400, height: 60 }, "#F6C453", "#DDA52D", 18);
  text(slide, "HUMAN CONFIRMATION", { left: 798, top: 568, width: 190, height: 22 }, { fontSize: 15, bold: true, color: "#4A3400" });
  text(slide, "Every financial write waits for the user", { left: 972, top: 568, width: 180, height: 22 }, { fontSize: 13, color: "#5E460C", alignment: "right" });
  slide.shapes.connect(writeTools, approval, {
    kind: "elbow", fromSide: "bottom", toSide: "top",
    line: { style: "solid", fill: "#C38A16", width: 2.5 },
    tail: { type: "arrow", width: "med", length: "med" },
  });
  slide.shapes.connect(approval, trusted, {
    kind: "elbow", fromSide: "right", toSide: "bottom",
    line: { style: "solid", fill: "#C38A16", width: 2.5 },
    tail: { type: "arrow", width: "med", length: "med" },
  });

  const resultBand = box(slide, "Agent result", { left: 145, top: 555, width: 555, height: 58 }, "#102A3A", "#102A3A", 16);
  text(slide, "SSE RESULT", { left: 168, top: 572, width: 90, height: 20 }, { fontSize: 11, bold: true, color: "#74D2C4" });
  text(slide, "Answer, evidence, UI command, trace and metrics", { left: 275, top: 569, width: 400, height: 24 }, { fontSize: 15, color: C.white });
  slide.shapes.connect(trusted, resultBand, {
    kind: "elbow", fromSide: "bottom", toSide: "right",
    line: { style: "solid", fill: "#4E7D78", width: 2 },
    tail: { type: "arrow", width: "sm", length: "sm" },
  });
  slide.shapes.connect(resultBand, panel, {
    kind: "elbow", fromSide: "left", toSide: "bottom",
    line: { style: "solid", fill: "#3B7FA0", width: 2 },
    tail: { type: "arrow", width: "sm", length: "sm" },
  });

  text(slide, "Writes also use payload verification, idempotency and an eight-second undo window for reminders and payments.", { left: 58, top: 661, width: 1164, height: 24 }, {
    fontSize: 14, color: C.muted, alignment: "center",
  });
  slide.speakerNotes.text = [
    "Sources:",
    "cashpilot-agentic/apps/api/src/server.ts",
    "cashpilot-agentic/apps/api/src/agent/runtime.ts",
    "cashpilot-agentic/apps/api/src/domain/finance-service.ts",
    "cashpilot-agentic/apps/web/src/components/agent-panel.tsx",
  ].join("\n");
}

async function main() {
  await fs.mkdir(buildDir, { recursive: true });
  await fs.mkdir(outputDir, { recursive: true });
  const deck = Presentation.create({ slideSize: { width: 1280, height: 720 } });
  addBaseWorkflow(deck);
  addAgentWorkflow(deck);

  for (const [index, slide] of deck.slides.items.entries()) {
    await writeBlob(path.join(buildDir, `slide-${index + 1}.png`), await deck.export({ slide, format: "png", scale: 1 }));
  }
  await writeBlob(path.join(buildDir, "montage.webp"), await deck.export({ format: "webp", montage: true }));

  const stagingDir = path.join(buildDir, "finalizer");
  await fs.mkdir(stagingDir, { recursive: true });
  const candidatePath = path.join(stagingDir, "candidate.pptx");
  await (await PresentationFile.exportPptx(deck)).save(candidatePath);
  const { finalizePresentation } = await import(pathToFileURL(path.join(skillDir, "container_tools", "artifact_tool_utils.mjs")).href);
  await finalizePresentation({
    explicitTotalSlideCount: 2,
    requiredNativeTableOwnerSlides: [],
    requiredNativeChartOwnerSlides: [],
    workspaceDir,
    candidatePath,
    finalPath,
    pythonExecutable,
    integrityValidatorPath: path.join(skillDir, "container_tools", "inspect_presentation_package_integrity.py"),
    layoutValidatorPath: path.join(skillDir, "container_tools", "inspect_presentation_layout_geometry.py"),
    layoutArgs: ["--expected-slide-size-emu", "12192000,6858000", "--validate-bullet-geometry", "--validate-heading-fit"],
    fontPolicy: { basis: "design", families: [FONT] },
    verifyArtifactToolImport: true,
    receiptPath: path.join(stagingDir, "cashpilot-base-and-agent-workflows.validation.json"),
  });
  console.log(JSON.stringify({ finalPath }));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
