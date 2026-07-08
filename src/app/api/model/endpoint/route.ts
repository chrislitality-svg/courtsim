import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret } from "@/lib/crypto";

export async function GET() {
  const rows = await prisma.modelEndpoint.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      apiBaseUrl: true,
      modelName: true,
      apiFormat: true,
      maxContextTokens: true,
      defaultTemperature: true,
      createdAt: true,
      updatedAt: true,
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
    apiFormat?: string;
    maxContextTokens?: number;
    defaultTemperature?: number;
  };
  if (!body.name || !body.apiBaseUrl || !body.apiKey || !body.modelName) {
    return NextResponse.json({ error: "缺少 name / apiBaseUrl / apiKey / modelName" }, { status: 400 });
  }
  const row = await prisma.modelEndpoint.create({
    data: {
      name: body.name,
      apiBaseUrl: body.apiBaseUrl.replace(/\/+$/, ""),
      apiKeyEncrypted: encryptSecret(body.apiKey),
      modelName: body.modelName,
      apiFormat: body.apiFormat ?? "openai",
      maxContextTokens: body.maxContextTokens ?? null,
      defaultTemperature: body.defaultTemperature ?? null,
    },
    select: {
      id: true,
      name: true,
      apiBaseUrl: true,
      modelName: true,
      apiFormat: true,
      maxContextTokens: true,
      defaultTemperature: true,
      createdAt: true,
    },
  });
  return NextResponse.json(row);
}
