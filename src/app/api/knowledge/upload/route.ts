import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const ALLOWED = /\.(txt|md)$/i;
const MAX_BYTES = 4 * 1024 * 1024;

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  const title = String(form.get("title") ?? "").trim();
  const type = String(form.get("type") ?? "其他").trim() || "其他";
  const author = form.get("author") ? String(form.get("author")).trim() : null;
  const dynasty = form.get("dynasty") ? String(form.get("dynasty")).trim() : null;
  const collectionIdRaw = form.get("collectionId");
  const collectionId =
    typeof collectionIdRaw === "string" && collectionIdRaw.trim()
      ? collectionIdRaw.trim()
      : null;
  if (collectionId) {
    const col = await prisma.knowledgeCollection.findUnique({
      where: { id: collectionId },
    });
    if (!col) {
      return NextResponse.json({ error: "分组不存在" }, { status: 400 });
    }
  }

  const tagsRaw = form.get("tags");
  let tags = "[]";
  if (typeof tagsRaw === "string" && tagsRaw.trim()) {
    try {
      JSON.parse(tagsRaw);
      tags = tagsRaw;
    } catch {
      tags = JSON.stringify(tagsRaw.split(",").map((t) => t.trim()).filter(Boolean));
    }
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "缺少 file" }, { status: 400 });
  }
  if (!title) {
    return NextResponse.json({ error: "缺少 title" }, { status: 400 });
  }
  if (!ALLOWED.test(file.name)) {
    return NextResponse.json({ error: "仅支持 .txt / .md" }, { status: 400 });
  }
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length > MAX_BYTES) {
    return NextResponse.json({ error: "文件超过 4MB" }, { status: 400 });
  }

  const src = await prisma.knowledgeSource.create({
    data: {
      title,
      author,
      type,
      dynasty,
      era: null,
      tags,
      fileName: file.name,
      mimeType: file.type || "text/plain",
      totalChunks: 0,
      collectionId,
    },
  });

  const dir = path.join(process.cwd(), "data", "uploads");
  await mkdir(dir, { recursive: true });
  const rel = path.join("data", "uploads", `${src.id}.txt`);
  const abs = path.join(process.cwd(), rel);
  await writeFile(abs, buf);

  await prisma.knowledgeSource.update({
    where: { id: src.id },
    data: { storagePath: rel.replace(/\\/g, "/") },
  });

  return NextResponse.json({
    id: src.id,
    title: src.title,
    fileName: src.fileName,
    message: "已上传，请在史料库中「处理（分块+向量化）」",
  });
}
