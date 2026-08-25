import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import matter from "gray-matter"
import { NextResponse } from "next/server"
import { commitAndPushFile, getGitErrorMessage } from "@/lib/server-git"

export const runtime = "nodejs"

const libraryRoot = path.resolve(process.cwd(), "library")

function isSafeDirectoryName(value: string) {
  return (
    value.length > 0 &&
    value.length <= 60 &&
    value !== "." &&
    value !== ".." &&
    !/[\\/]/.test(value) &&
    !/[<>:"|?*\u0000-\u001f]/.test(value)
  )
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { name?: unknown; description?: unknown }
    const name = typeof body.name === "string" ? body.name.trim() : ""
    const description = typeof body.description === "string" ? body.description.trim().replace(/\r?\n/g, " ") : ""
    if (!isSafeDirectoryName(name) || description.length > 200) {
      return NextResponse.json({ error: "维度名称或说明无效" }, { status: 400 })
    }

    const pluginRoot = path.join(libraryRoot, name)
    try {
      await mkdir(pluginRoot)
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "EEXIST") {
        return NextResponse.json({ error: "该维度已经存在" }, { status: 409 })
      }
      throw error
    }

    const metadataPath = path.join(pluginRoot, "_plugin.md")
    await writeFile(metadataPath, matter.stringify("", { name, description }), "utf8")
    const git = await commitAndPushFile(path.relative(process.cwd(), metadataPath), `content: create plugin ${name}`)
    return NextResponse.json({ ok: true, plugin: { id: name, name, description, elements: [] }, ...git }, { status: 201 })
  } catch (error) {
    console.error("Failed to create story library plugin", error)
    const detail = getGitErrorMessage(error)
    return NextResponse.json(
      { error: detail ? `维度已创建，但 Git 提交或推送失败：${detail}` : "维度创建失败" },
      { status: 502 },
    )
  }
}
