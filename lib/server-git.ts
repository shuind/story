import { execFile as execFileCallback } from "node:child_process"
import path from "node:path"
import { promisify } from "node:util"

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

export async function commitAndPushFile(relativePath: string, message: string) {
  if (path.isAbsolute(relativePath)) throw new Error("Git 文件路径必须是相对路径")
  const normalizedPath = relativePath.split(path.sep).join("/")
  if (!normalizedPath || normalizedPath === ".." || normalizedPath.startsWith("../")) {
    throw new Error("Git 文件路径无效")
  }
  const changed = (await runGit(["status", "--porcelain", "--", normalizedPath])).stdout.trim().length > 0
  if (!changed) return { committed: false, pushed: false }

  await runGit(["add", "--", normalizedPath])
  await runGit(["commit", "--only", "-m", message, "--", normalizedPath])
  const branch = (await runGit(["branch", "--show-current"])).stdout.trim()
  if (!branch) throw new Error("无法确定当前 Git 分支")
  await runGit(["push", gitRemote, branch])
  return { committed: true, pushed: true }
}

export function getGitErrorMessage(error: unknown) {
  if (error && typeof error === "object" && "stderr" in error && typeof error.stderr === "string") {
    return error.stderr.trim().split(/\r?\n/).slice(-1)[0]
  }
  return undefined
}
