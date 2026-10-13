import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";

export const IMAGE = process.env.MICROSCOPE_SANDBOX_IMAGE ?? "microscope-sandbox:local";

export function dockerReady() {
  const result = spawnSync("docker", ["image", "inspect", IMAGE], { encoding: "utf8" });
  return result.status === 0;
}

const permissionFlag = () => (process.allowedNodeEnvironmentFlags.has("--permission") ? "--permission" : "--experimental-permission");

export function nodePermissions({ read, write }) {
  return [permissionFlag(), ...read.map((path) => `--allow-fs-read=${path}`), ...write.map((path) => `--allow-fs-write=${path}`)];
}

export function runSandboxed({ mode, workspace, skill, out, tools, cwd, args, timeout, locked }) {
  const seconds = Math.ceil((timeout ?? 300000) / 1000);
  if (mode === "docker") {
    const name = `microscope-check-${randomBytes(6).toString("hex")}`;
    const user = process.getuid && process.platform === "linux" ? ["--user", `${process.getuid()}:${process.getgid()}`] : [];
    const docker = ["run", "--rm", "--name", name, "--platform", "linux/amd64", "--network", "none", "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges", "--pids-limit", "512", "--memory", "2g", "--memory-swap", "2g", "--cpus", "2", "--shm-size", "256m", "--tmpfs", "/tmp:rw,size=512m", ...user,
      "-v", `${workspace}/figures:/work/figures:rw`, "-v", `${skill}:/work/.skill:ro`, ...(tools ? ["-v", `${tools}:/work/.tools:ro`] : []), ...(out ? ["-v", `${out}:/out:rw`] : []), "-w", `/work/${cwd}`, IMAGE];
    const inner = locked ? ["node", ...nodePermissions({ read: ["/work", "/proc/.reset"], write: locked.map((path) => `/work/${path}`) }), ...args] : ["node", ...args];
    const result = spawnSync("docker", [...docker, ...inner], { encoding: "utf8", timeout: (seconds + 30) * 1000, maxBuffer: 64 << 20 });
    if (result.error?.code === "ETIMEDOUT") spawnSync("docker", ["kill", name]);
    return { code: result.status ?? 1, output: `${result.stdout ?? ""}${result.stderr ?? ""}`, timedOut: result.error?.code === "ETIMEDOUT", sandbox: "docker, no network" };
  }
  const host = (path) => path.replace(/^\/work/, workspace).replace(`${workspace}/.skill`, skill).replace(`${workspace}/.tools`, tools ?? `${workspace}/.tools`).replace(/^\/out/, out ?? "/out");
  const hostArgs = args.map((arg) => (arg.startsWith("/work") || arg.startsWith("/out") ? host(arg) : arg));
  const flags = locked ? nodePermissions({ read: [workspace, skill], write: locked.map((path) => `${workspace}/${path}`) }) : [];
  const result = spawnSync(process.execPath, [...flags, ...hostArgs], { cwd: `${workspace}/${cwd}`, encoding: "utf8", timeout: seconds * 1000, maxBuffer: 64 << 20, env: { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR ?? "/tmp", CHROME_PATH: process.env.CHROME_PATH ?? "", NODE_NO_WARNINGS: "1" } });
  return { code: result.status ?? 1, output: `${result.stdout ?? ""}${result.stderr ?? ""}`, timedOut: result.error?.code === "ETIMEDOUT", sandbox: "local, NOT network-isolated" };
}
