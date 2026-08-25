import { access, writeFile } from "node:fs/promises"
import path from "node:path"
import matter from "gray-matter"
import { NextResponse } from "next/server"
import { commitAndPushFile, getGitErrorMessage } from "@/lib/server-git"

export const runtime = "nodejs"

const libraryRoot = path.resolve(process.cwd(), "library")

function isSafeSegment(value: string) {
  return (
    value.length > 0 &&
    value.length <= 100 &&
    value !== "." &&
    value !== ".." &&
    !/[\\/]/.test(value) &&
    !/[<>:"|?*\u0000-\u001f]/.test(value)
  )
}

function resolvePluginRoot(pluginId: string) {
  const pluginRoot = path.resolve(libraryRoot, pluginId)
  const relativeToLibrary = path.relative(libraryRoot, pluginRoot)
  if (
    !relativeToLibrary ||
    relativeToLibrary === ".." ||
    relativeToLibrary.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativeToLibrary)
  ) {
    return undefined
  }
  return pluginRoot
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      pluginId?: unknown
      title?: unknown
      summary?: unknown
      tags?: unknown
      content?: unknown
    }
    const pluginId = typeof body.pluginId === "string" ? body.pluginId.trim() : ""
    const title = typeof body.title === "string" ? body.title.trim().replace(/\.md$/i, "") : ""
    const summary = typeof body.summary === "string" ? body.summary.trim().replace(/\r?\n/g, " ") : ""
    const tags = (Array.isArray(body.tags) ? body.tags : typeof body.tags === "string" ? body.tags.split(",") : [])
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean)
      .filter((item, index, all) => all.indexOf(item) === index)
      .slice(0, 20)
    const content = typeof body.content === "string" && body.content.trim() ? body.content.trim() : `# ${title}`

    if (!isSafeSegment(pluginId) || !isSafeSegment(title) || summary.length > 200) {
      return NextResponse.json({ error: "元素名称或摘要无效" }, { status: 400 })
    }

    const pluginRoot = resolvePluginRoot(pluginId)
    if (!pluginRoot) return NextResponse.json({ error: "维度路径无效" }, { status: 400 })

    try {
      await access(pluginRoot)
    } catch {
      return NextResponse.json({ error: "维度不存在" }, { status: 404 })
    }

    const target = path.join(pluginRoot, `${title}.md`)
    try {
      await writeFile(target, matter.stringify(`${content}\n`, { title, summary, tags }), { encoding: "utf8", flag: "wx" })
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "EEXIST") {
        return NextResponse.json({ error: "该元素已经存在" }, { status: 409 })
      }
      throw error
    }

    const relativePath = path.relative(process.cwd(), target)
    const git = await commitAndPushFile(relativePath, `content: create element ${title}`)
    return NextResponse.json(
      {
        ok: true,
        element: {
          id: `${pluginId}/${title}`,
          pluginId,
          title,
          path: relativePath.split(path.sep).join("/"),
          content,
          excerpt: summary,
          tags,
        },
        ...git,
      },
      { status: 201 },
    )
  } catch (error) {
    console.error("Failed to create story library element", error)
    const detail = getGitErrorMessage(error)
    return NextResponse.json(
      { error: detail ? `元素已创建，但 Git 提交或推送失败：${detail}` : "元素创建失败" },
      { status: 502 },
    )
  }
}
