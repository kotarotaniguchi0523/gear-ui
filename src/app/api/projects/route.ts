import { NextRequest, NextResponse } from "next/server";
import { listProjects, createProject } from "@/lib/repo/projects";
import { projectCreateSchema } from "@/lib/schemas";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ projects: listProjects() });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const parsed = projectCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const project = createProject(parsed.data);
  return NextResponse.json(project, { status: 201 });
}
