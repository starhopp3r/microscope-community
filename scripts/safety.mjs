import { dirname, extname, posix, relative, resolve, sep } from "node:path";

export const SOURCE_TYPES = [".mjs", ".js", ".css", ".html", ".json", ".md", ".txt", ".svg"];
export const NODE_MODULES = ["node:fs", "node:path", "node:url", "node:crypto", "node:process"];
const NAMESPACES = ["http://www.w3.org/2000/svg", "http://www.w3.org/1999/xlink", "http://www.w3.org/1999/xhtml", "http://www.w3.org/XML/1998/namespace", "http://www.w3.org/2000/xmlns/"];

const EVERYWHERE = [
  [/\bfetch\s*\(/, "network request (fetch)"],
  [/\bXMLHttpRequest\b/, "network request (XMLHttpRequest)"],
  [/\bnew\s+WebSocket\b/, "network socket (WebSocket)"],
  [/\bEventSource\b/, "network stream (EventSource)"],
  [/\bsendBeacon\b/, "network beacon (sendBeacon)"],
  [/\bRTCPeerConnection\b/, "peer connection (WebRTC)"],
  [/\bimportScripts\b/, "remote worker scripts (importScripts)"],
  [/\beval\s*\(/, "eval"],
  [/\bnew\s+Function\s*\(/, "code from strings (new Function)"],
  [/\bdocument\.cookie\b/, "cookies"],
  [/\bwindow\.open\s*\(/, "opening windows"],
  [/\b(?:window|self|globalThis)\.(?:top|parent|opener)\b/, "reaching outside the frame"],
  [/\b(?:top|parent|opener)\.(?:location|document|postMessage)\b/, "reaching outside the frame"],
  [/\b(?:location\.(?:href|assign|replace)\s*[=(]|location\s*=[^=])/, "navigating the page"],
  [/\bnavigator\.(?:credentials|clipboard|geolocation|mediaDevices|serviceWorker)\b/, "sensitive browser API"],
  [/<(?:iframe|object|embed|base|form|portal)(?=[\s/>])/i, "embedding or forms"],
  [/<\s*meta[^>]+http-equiv\s*=\s*["']?refresh/i, "meta refresh"],
];

const NODE_ONLY = [
  [/\bprocess\.env\b/, "reading environment variables"],
  [/\bprocess\.(?:binding|dlopen|kill)\b/, "low-level process access"],
  [/\brequire\s*\(/, "require (use import)"],
  [/\bimport\s*\(\s*(?!["'`][^"'`$]*["'`]\s*\))/, "dynamic import of a computed path"],
];

const lineOf = (text, index) => text.slice(0, index).split("\n").length;

function externalUrls(text) {
  const found = [];
  const pattern = /(?:https?:)?\/\/[A-Za-z0-9.-]+\.[A-Za-z]{2,}[^\s"'`)<>]*/g;
  for (const match of text.matchAll(pattern)) {
    const url = match[0].startsWith("//") ? `https:${match[0]}` : match[0];
    if (NAMESPACES.some((ns) => url === ns || url.startsWith(ns))) continue;
    const before = text.slice(Math.max(0, match.index - 1), match.index);
    if (match[0].startsWith("//") && /[A-Za-z0-9_$:]/.test(before)) continue;
    found.push({ url: match[0], line: lineOf(text, match.index) });
  }
  return found;
}

export function scanText(path, text) {
  const findings = [];
  const isNode = /\.m?js$/.test(path) && !/(^|\/)live\.js$/.test(path);
  for (const [pattern, what] of EVERYWHERE) {
    const match = text.match(pattern);
    if (match) findings.push(`${path}:${lineOf(text, match.index)}: ${what}`);
  }
  if (isNode) for (const [pattern, what] of NODE_ONLY) {
    const match = text.match(pattern);
    if (match) findings.push(`${path}:${lineOf(text, match.index)}: ${what}`);
  }
  for (const { url, line } of externalUrls(text)) findings.push(`${path}:${line}: external address ${url}`);
  return findings;
}

export function importsOf(text) {
  const specs = [];
  const pattern = /\b(?:import|export)\s+(?:[^"'`;]*?\s+from\s+)?["']([^"']+)["']/g;
  for (const match of text.matchAll(pattern)) specs.push({ spec: match[1], line: lineOf(text, match.index) });
  for (const match of text.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g)) specs.push({ spec: match[1], line: lineOf(text, match.index) });
  return specs;
}

export function checkImports(path, text, { folder, skill }) {
  const findings = [];
  if (!/\.m?js$/.test(path)) return findings;
  const file = resolve(folder, path);
  for (const { spec, line } of importsOf(text)) {
    if (spec.startsWith("node:")) {
      if (!NODE_MODULES.includes(spec)) findings.push(`${path}:${line}: Node module ${spec} is not allowed (allowed: ${NODE_MODULES.join(", ")})`);
      continue;
    }
    if (!spec.startsWith(".")) {
      findings.push(`${path}:${line}: import "${spec}" must be a relative path, the skill, or an allowed node: module`);
      continue;
    }
    const target = resolve(dirname(file), spec);
    const inside = (root) => target === root || target.startsWith(root + sep);
    if (!inside(resolve(folder)) && !inside(resolve(skill))) findings.push(`${path}:${line}: import "${spec}" leaves the figure folder`);
  }
  return findings;
}

export const isSourceType = (path) => SOURCE_TYPES.includes(extname(path).toLowerCase());
export const toPosix = (path) => path.split(sep).join(posix.sep);
export const relativeTo = (root, path) => toPosix(relative(root, path));
