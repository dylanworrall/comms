import { NextResponse } from "next/server";
import {
  getAllAgents,
  getAgentById,
  createAgent,
  updateAgent,
  deleteAgent,
  applyTemplateToAgent,
  getTemplatePresets,
  GEMINI_VOICES,
  OPENAI_VOICES,
} from "@/lib/stores/voice-agent-store";

export async function GET() {
  const agents = getAllAgents();
  const templates = getTemplatePresets();
  return NextResponse.json({
    agents,
    templates,
    geminiVoices: GEMINI_VOICES,
    openaiVoices: OPENAI_VOICES,
  });
}

export async function POST(req: Request) {
  const body = await req.json();

  // Create new agent
  if (body.action === "create") {
    const agent = createAgent(body.templateKey);
    return NextResponse.json({ success: true, agent });
  }

  // Apply template to existing agent
  if (body.action === "applyTemplate" && body.agentId && body.templateKey) {
    const agent = applyTemplateToAgent(body.agentId, body.templateKey);
    if (!agent) return NextResponse.json({ error: "Agent or template not found" }, { status: 404 });
    return NextResponse.json({ success: true, agent });
  }

  // Delete agent
  if (body.action === "delete" && body.agentId) {
    deleteAgent(body.agentId);
    return NextResponse.json({ success: true });
  }

  // Update agent
  if (body.agentId) {
    const { agentId, action, ...updates } = body;
    const agent = updateAgent(agentId, updates);
    if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    return NextResponse.json({ success: true, agent });
  }

  return NextResponse.json({ error: "Missing agentId or action" }, { status: 400 });
}
