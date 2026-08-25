import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import matter from "gray-matter"
import { NextResponse } from "next/server"
import { commitAndPushFile, getGitErrorMessage } from "@/lib/server-git"

export const runtime = "nodejs"

const libraryRoot = path.resolve(process.cwd(), "library")

function resolveLibraryFile(relativePath: unknown) {
  if (typeof relativePath !== "string" || !relativePath.startsWith("library/") || !relativePath.endsWith(".md")) {
    return undefined
  }

  const absolutePath = path.resolve(libraryRoot, relativePath.slice("library/".length))
  const relativeToLibrary = path.relative(libraryRoot, absolutePath)
  if (
    !relativeToLibrary ||
    relativeToLibrary === ".." ||
    relativeToLibrary.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativeToLibrary) ||
    path.basename(relativeToLibrary).startsWith("_")
  ) {
    return undefined
  }
  return absolutePath
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { path?: unknown; content?: unknown }
    const target = resolveLibraryFile(body.path)
    if (!target || typeof body.content !== "string") {
      return NextResponse.json({ error: "请求参数无效" }, { status: 400 })
    }

    const existing = matter(await readFile(target, "utf8"))
    const content = body.content.trim()
    await writeFile(target, matter.stringify(`${content}\n`, existing.data), "utf8")

    const title = path.basename(target, ".md").replace(/\s+/g, " ").trim().slice(0, 60)
    const git = await commitAndPushFile(path.relative(process.cwd(), target), `content: update ${title}`)
    return NextResponse.json({ ok: true, content, ...git })
  } catch (error) {
    console.error("Failed to save story library element", error)
    const detail = getGitErrorMessage(error)
    return NextResponse.json(
      { error: detail ? `素材已写入本地，但 Git 提交或推送失败：${detail}` : "素材保存失败" },
      { status: 502 },
    )
  }
}
