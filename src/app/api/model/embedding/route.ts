import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret } from "@/lib/crypto";

export async function GET() {
  const rows = await prisma.embeddingEndpoint.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      apiBaseUrl: true,
      modelName: true,
      dimensions: true,
      createdAt: true,
    },
  });
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    name: string;
    apiBaseUrl: string;
    apiKey: string;
    modelName: string;
    dimensions?: number | null;
  };
  if (!body.name || !body.apiBaseUrl || !body.apiKey || !body.modelName) {
    return NextResponse.json(
      { error: "缺少 name / apiBaseUrl / apiKey / modelName" },
      { status: 400 },
    );
  }
  const row = await prisma.embeddingEndpoint.create({
    data: {
      name: body.name,
      apiBaseUrl: body.apiBaseUrl.replace(/\/+$/, ""),
      apiKeyEncrypted: encryptSecret(body.apiKey),
      modelName: body.modelName,
      dimensions: body.dimensions ?? null,
    },
    select: {
      id: true,
      name: true,
      apiBaseUrl: true,
      modelName: true,
      dimensions: true,
      createdAt: true,
    },
  });
  return NextResponse.json(row);
}
