import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const workspaceDir = "/Users/shivanandhulikatti/Desktop/dev/hackathons/kle-hackfest/cashpilot-agentic";
const buildDir = path.join(workspaceDir, ".codex-pptx", "agent-architecture");
const outputDir = path.join(workspaceDir, "output");
const finalPath = path.join(outputDir, "cashpilot-agent-architecture.pptx");
const skillDir = "/Users/shivanandhulikatti/.codex/plugins/cache/openai-primary-runtime/presentations/26.1009.11318/skills/presentations";
const pythonExecutable = "/Users/shivanandhulikatti/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3";
const FONT = "Arial";

async function writeBlob(filePath, blob) {
  await fs.writeFile(filePath, new Uint8Array(await blob.arrayBuffer()));
}

function addText(slide, text, position, style = {}) {
  const shape = slide.shapes.add({
    geometry: "textbox",
    position,
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
  });
  shape.text = text;
  shape.text.style = {
    typeface: FONT,
    fontSize: style.fontSize ?? 18,
    bold: style.bold ?? false,
    color: style.color ?? "#14283A",
    alignment: style.alignment ?? "left",
  };
  shape.text.verticalAlignment = style.verticalAlignment ?? "top";
  shape.text.insets = style.insets ?? 0;
  return shape;
}

function addBox(slide, name, position, fill, line = "#D7DEE5", radius = 18) {
  return slide.shapes.add({
    name,
    geometry: "roundRect",
    position,
    fill,
    line: { style: "solid", fill: line, width: 1.5 },
    borderRadius: radius,
  });
}

function addInnerNode(slide, { x, y, w, h, title, body, fill, titleColor = "#14283A", bodyColor = "#526472" }) {
  const box = addBox(slide, title, { left: x, top: y, width: w, height: h }, fill, "#FFFFFF33", 12);
  addText(slide, title, { left: x + 14, top: y + 11, width: w - 28, height: 24 }, {
    fontSize: 17,
    bold: true,
    color: titleColor,
  });
  addText(slide, body, { left: x + 14, top: y + 39, width: w - 28, height: h - 49 }, {
    fontSize: 13.5,
    color: bodyColor,
  });
  return box;
}

async function main() {
  await fs.mkdir(buildDir, { recursive: true });
  await fs.mkdir(outputDir, { recursive: true });

  const deck = Presentation.create({ slideSize: { width: 1280, height: 720 } });
  const slide = deck.slides.add();
  slide.background.fill = "#F6F4EE";

  addText(slide, "CashPilot Agent Architecture", { left: 58, top: 34, width: 770, height: 52 }, {
    fontSize: 36,
    bold: true,
    color: "#102A3A",
  });
  addText(slide, "One embedded agent with three execution paths and a hard approval boundary for writes", { left: 60, top: 88, width: 900, height: 30 }, {
    fontSize: 18,
    color: "#526472",
  });
  addText(slide, "CURRENT IMPLEMENTATION", { left: 1010, top: 48, width: 210, height: 24 }, {
    fontSize: 12,
    bold: true,
    color: "#207C73",
    alignment: "right",
  });

  const ui = addBox(slide, "React agent panel", { left: 58, top: 185, width: 205, height: 300 }, "#E3F1FA", "#87B7D2", 22);
  addText(slide, "USER EXPERIENCE", { left: 78, top: 205, width: 165, height: 20 }, {
    fontSize: 11,
    bold: true,
    color: "#257298",
  });
  addText(slide, "React agent panel", { left: 78, top: 238, width: 165, height: 54 }, {
    fontSize: 24,
    bold: true,
    color: "#12364B",
  });
  addText(slide, "Sends\n• user message\n• current page + filters\n• last 6 messages\n\nReceives\n• answer + evidence\n• UI command + trace", { left: 78, top: 305, width: 165, height: 155 }, {
    fontSize: 15,
    color: "#31596F",
  });

  const runtime = addBox(slide, "Agent runtime", { left: 305, top: 145, width: 300, height: 380 }, "#102A3A", "#102A3A", 22);
  addText(slide, "ORCHESTRATION", { left: 327, top: 164, width: 150, height: 20 }, {
    fontSize: 11,
    bold: true,
    color: "#74D2C4",
  });
  addText(slide, "Express agent runtime", { left: 327, top: 191, width: 250, height: 35 }, {
    fontSize: 22,
    bold: true,
    color: "#FFFFFF",
  });
  const direct = addInnerNode(slide, {
    x: 327, y: 241, w: 256, h: 75,
    title: "1  Direct resolver",
    body: "Navigation and URL filters. No model call.",
    fill: "#1D4559", titleColor: "#FFFFFF", bodyColor: "#BDD4DF",
  });
  const fallback = addInnerNode(slide, {
    x: 327, y: 329, w: 256, h: 75,
    title: "2  Local fallback",
    body: "Live reads when OpenRouter is unavailable.",
    fill: "#1D4559", titleColor: "#FFFFFF", bodyColor: "#BDD4DF",
  });
  const graph = addInnerNode(slide, {
    x: 327, y: 417, w: 256, h: 84,
    title: "3  LangGraph workflow",
    body: "OpenRouter planning and bounded tool loop. Maximum 5 turns.",
    fill: "#176B66", titleColor: "#FFFFFF", bodyColor: "#D2F3EC",
  });

  const tools = addBox(slide, "Typed capabilities", { left: 650, top: 145, width: 300, height: 380 }, "#FFFFFF", "#CED8DE", 22);
  addText(slide, "TYPED CAPABILITIES", { left: 672, top: 164, width: 180, height: 20 }, {
    fontSize: 11,
    bold: true,
    color: "#5B4DA4",
  });
  addText(slide, "Role-scoped tools", { left: 672, top: 191, width: 250, height: 35 }, {
    fontSize: 22,
    bold: true,
    color: "#1F2740",
  });
  const uiTools = addInnerNode(slide, {
    x: 672, y: 241, w: 256, h: 75,
    title: "UI tools",
    body: "open_ui and prefill_ui",
    fill: "#EEEAF9", titleColor: "#463B86", bodyColor: "#665B91",
  });
  const readTools = addInnerNode(slide, {
    x: 672, y: 329, w: 256, h: 75,
    title: "Read + analysis tools",
    body: "Scoped SQL, deterministic calculations and evidence.",
    fill: "#E5F4EF", titleColor: "#176B66", bodyColor: "#3F716C",
  });
  const writeTools = addInnerNode(slide, {
    x: 672, y: 417, w: 256, h: 84,
    title: "Write tools",
    body: "Validate input and create a pending action. Never execute directly.",
    fill: "#FFF2D9", titleColor: "#8B5B00", bodyColor: "#7A6234",
  });

  const systems = addBox(slide, "Trusted business layer", { left: 995, top: 185, width: 227, height: 300 }, "#EAF0F2", "#B7C6CC", 22);
  addText(slide, "TRUSTED BUSINESS LAYER", { left: 1017, top: 205, width: 182, height: 20 }, {
    fontSize: 10.5,
    bold: true,
    color: "#586E77",
  });
  addText(slide, "Finance services", { left: 1017, top: 238, width: 182, height: 34 }, {
    fontSize: 22,
    bold: true,
    color: "#17323D",
  });
  addInnerNode(slide, {
    x: 1017, y: 286, w: 182, h: 78,
    title: "Domain rules",
    body: "Tenant scope, permissions and transactions",
    fill: "#FFFFFF", titleColor: "#17323D", bodyColor: "#586E77",
  });
  addInnerNode(slide, {
    x: 1017, y: 378, w: 182, h: 80,
    title: "PostgreSQL",
    body: "Business data, runs, evidence, audit and graph checkpoints",
    fill: "#DDE8EB", titleColor: "#17323D", bodyColor: "#586E77",
  });

  const approval = addBox(slide, "Human confirmation", { left: 735, top: 555, width: 395, height: 55 }, "#F6C453", "#DDA52D", 18);
  addText(slide, "HUMAN CONFIRMATION", { left: 757, top: 566, width: 200, height: 20 }, {
    fontSize: 15,
    bold: true,
    color: "#4A3400",
  });
  addText(slide, "Approve or reject every financial write", { left: 928, top: 567, width: 180, height: 22 }, {
    fontSize: 13.5,
    color: "#5E460C",
    alignment: "right",
  });

  slide.shapes.connect(ui, runtime, {
    kind: "straight", fromSide: "right", toSide: "left",
    line: { style: "solid", fill: "#3B7FA0", width: 2.5 },
    tail: { type: "arrow", width: "med", length: "med" },
  });
  slide.shapes.connect(runtime, tools, {
    kind: "straight", fromSide: "right", toSide: "left",
    line: { style: "solid", fill: "#4E7D78", width: 2.5 },
    tail: { type: "arrow", width: "med", length: "med" },
  });
  slide.shapes.connect(readTools, systems, {
    kind: "straight", fromSide: "right", toSide: "left",
    line: { style: "solid", fill: "#4E7D78", width: 2.5 },
    tail: { type: "arrow", width: "med", length: "med" },
  });
  slide.shapes.connect(writeTools, approval, {
    kind: "elbow", fromSide: "bottom", toSide: "top",
    line: { style: "solid", fill: "#C38A16", width: 2.5 },
    tail: { type: "arrow", width: "med", length: "med" },
  });
  slide.shapes.connect(approval, systems, {
    kind: "elbow", fromSide: "right", toSide: "bottom",
    line: { style: "solid", fill: "#C38A16", width: 2.5 },
    tail: { type: "arrow", width: "med", length: "med" },
  });

  slide.shapes.add({
    geometry: "line",
    position: { left: 58, top: 642, width: 1164, height: 0 },
    fill: "none",
    line: { style: "solid", fill: "#CED6D8", width: 1 },
  });
  addText(slide, "GUARDRAILS", { left: 58, top: 658, width: 105, height: 18 }, {
    fontSize: 11,
    bold: true,
    color: "#64757D",
  });
  const guards = [
    ["Authenticated actor + tenant", 180],
    ["Role-scoped tool list", 445],
    ["Zod validation + payload hash", 690],
    ["Idempotency + 8-second undo", 970],
  ];
  for (const [label, left] of guards) {
    slide.shapes.add({
      geometry: "ellipse",
      position: { left, top: 660, width: 9, height: 9 },
      fill: "#207C73",
      line: { style: "solid", fill: "#207C73", width: 0 },
    });
    addText(slide, label, { left: left + 15, top: 654, width: 235, height: 24 }, {
      fontSize: 13.5,
      color: "#40545E",
    });
  }

  slide.speakerNotes.text = [
    "Current implementation source:",
    "apps/api/src/agent/runtime.ts",
    "apps/api/src/agent/catalog.ts",
    "apps/api/src/domain/finance-service.ts",
    "apps/web/src/components/agent-panel.tsx",
    "db/migrations/001_agent_runtime.sql",
  ].join("\n");

  const previewPath = path.join(buildDir, "cashpilot-agent-architecture.png");
  await writeBlob(previewPath, await deck.export({ slide, format: "png", scale: 1 }));

  const { finalizePresentation } = await import(pathToFileURL(
    path.join(skillDir, "container_tools", "artifact_tool_utils.mjs"),
  ).href);
  const stagingDir = path.join(buildDir, "finalizer");
  await fs.mkdir(stagingDir, { recursive: true });
  const candidatePath = path.join(stagingDir, "candidate.pptx");
  await (await PresentationFile.exportPptx(deck)).save(candidatePath);

  await finalizePresentation({
    explicitTotalSlideCount: 1,
    requiredNativeTableOwnerSlides: [],
    requiredNativeChartOwnerSlides: [],
    workspaceDir,
    candidatePath,
    finalPath,
    pythonExecutable,
    integrityValidatorPath: path.join(skillDir, "container_tools", "inspect_presentation_package_integrity.py"),
    layoutValidatorPath: path.join(skillDir, "container_tools", "inspect_presentation_layout_geometry.py"),
    layoutArgs: [
      "--expected-slide-size-emu", "12192000,6858000",
      "--validate-bullet-geometry",
      "--validate-heading-fit",
    ],
    fontPolicy: { basis: "design", families: [FONT] },
    verifyArtifactToolImport: true,
    receiptPath: path.join(stagingDir, "cashpilot-agent-architecture.validation.json"),
  });

  console.log(JSON.stringify({ finalPath, previewPath }));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
