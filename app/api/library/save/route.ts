import { execFile as execFileCallback } from "node:child_process"
import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { promisify } from "node:util"
import matter from "gray-matter"
import { NextResponse } from "next/server"

export const runtime = "nodejs"

const libraryRoot = path.resolve(process.cwd(), "library")
const execFile = promisify(execFileCallback)
const gitRemote = process.env.GIT_REMOTE ?? "git@github.com:shuind/story.git"

async function runGit(args: string[]) {
  const sshPath = process.env.GIT_SSH ?? (process.platform === "win32" ? "C:\\Windows\\System32\\OpenSSH\\ssh.exe" : "ssh")
  return execFile("git", args, {
    cwd: process.cwd(),
    env: { ...process.env, GIT_SSH: sshPath },
    windowsHide: true,
    maxBuffer: 1024 * 1024,
  })
}

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

    const relativePath = path.relative(process.cwd(), target).split(path.sep).join("/")
    const changed = (await runGit(["status", "--porcelain", "--", relativePath])).stdout.trim().length > 0
    if (!changed) return NextResponse.json({ ok: true, content, committed: false, pushed: false })

    await runGit(["add", "--", relativePath])
    const title = path.basename(target, ".md").replace(/\s+/g, " ").trim().slice(0, 60)
    await runGit(["commit", "--only", "-m", `content: update ${title}`, "--", relativePath])
    const branch = (await runGit(["branch", "--show-current"])).stdout.trim()
    if (!branch) throw new Error("无法确定当前 Git 分支")
    await runGit(["push", gitRemote, branch])

    return NextResponse.json({ ok: true, content, committed: true, pushed: true })
  } catch (error) {
    console.error("Failed to save story library element", error)
    const detail = error && typeof error === "object" && "stderr" in error && typeof error.stderr === "string"
      ? error.stderr.trim().split(/\r?\n/).slice(-1)[0]
      : undefined
    return NextResponse.json(
      { error: detail ? `素材已写入本地，但 Git 提交或推送失败：${detail}` : "素材保存失败" },
      { status: 502 },
    )
  }
}
