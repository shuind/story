import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import matter from "gray-matter"
import { NextResponse } from "next/server"
import type { ElementDoc, PluginDef } from "@/lib/types"

export const dynamic = "force-dynamic"

const libraryRoot = path.join(process.cwd(), "library")

function fallbackSummary(content: string) {
  const line = content
    .split(/\r?\n/)
    .map((item) => item.trim())
    .find((item) => item && !item.startsWith("#") && !item.startsWith("-"))
  return line?.slice(0, 100) ?? ""
}

async function readPlugin(directory: string): Promise<PluginDef> {
  const pluginRoot = path.join(libraryRoot, directory)
  const entries = await readdir(pluginRoot, { withFileTypes: true })
  const metadataEntry = entries.find((entry) => entry.isFile() && entry.name === "_plugin.md")
  const metadata = metadataEntry ? matter(await readFile(path.join(pluginRoot, metadataEntry.name), "utf8")) : undefined
  const metadataData = (metadata?.data ?? {}) as Record<string, unknown>
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md") && entry.name !== "_plugin.md")
    .sort((a, b) => a.name.localeCompare(b.name, "zh-CN"))

  const elements = await Promise.all(
    files.map(async (entry): Promise<ElementDoc> => {
      const relativePath = path.posix.join("library", directory, entry.name)
      const parsed = matter(await readFile(path.join(pluginRoot, entry.name), "utf8"))
      const title = typeof parsed.data.title === "string" ? parsed.data.title : entry.name.replace(/\.md$/, "")
      const content = parsed.content.trim()
      return {
        id: `${directory}/${title}`,
        pluginId: directory,
        title,
        path: relativePath,
        content,
        excerpt:
          typeof parsed.data.summary === "string" ? parsed.data.summary : fallbackSummary(content),
      }
    }),
  )

  return {
    id: directory,
    name: typeof metadataData.name === "string" ? metadataData.name : directory,
    description: typeof metadataData.description === "string" ? metadataData.description : "",
    elements,
  }
}

export async function GET() {
  try {
    const entries = await readdir(libraryRoot, { withFileTypes: true })
    const directories = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b, "zh-CN"))
    const library = await Promise.all(directories.map(readPlugin))
    return NextResponse.json(library)
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : undefined
    if (code === "ENOENT") return NextResponse.json([])
    console.error("Failed to read story library", error)
    return NextResponse.json({ error: "无法读取素材库" }, { status: 500 })
  }
}
