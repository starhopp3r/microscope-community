import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export function loadParser() {
  try {
    return require("acorn");
  } catch {
    return null;
  }
}

const FORBIDDEN_NAMES_LIST = {
  eval: "eval",
  Function: "code from strings (Function)",
  require: "require (use import)",
  module: "CommonJS module object",
  exports: "CommonJS exports object",
  fetch: "network request (fetch)",
  XMLHttpRequest: "network request (XMLHttpRequest)",
  WebSocket: "network socket (WebSocket)",
  EventSource: "network stream (EventSource)",
  RTCPeerConnection: "peer connection (WebRTC)",
  importScripts: "remote worker scripts",
  Worker: "workers",
  SharedWorker: "workers",
  WebAssembly: "WebAssembly",
  Reflect: "Reflect (indirect access)",
  Proxy: "Proxy (indirect access)",
  Deno: "other runtimes",
  Bun: "other runtimes",
};

const FORBIDDEN_PROPERTIES_LIST = {
  constructor: "reaching a constructor (the route to Function)",
  ["__proto__"]: "prototype tampering",
  __defineGetter__: "prototype tampering",
  __defineSetter__: "prototype tampering",
  __lookupGetter__: "prototype tampering",
  getBuiltinModule: "loading Node modules indirectly",
  createRequire: "require (use import)",
  mainModule: "loading Node modules indirectly",
  binding: "low-level process access",
  _linkedBinding: "low-level process access",
  dlopen: "native code",
  sendBeacon: "network beacon",
  cookie: "cookies",
  opener: "reaching the page around the figure",
  parent: "reaching the page around the figure",
  top: "reaching the page around the figure",
  credentials: "sensitive browser API",
  serviceWorker: "service workers",
  geolocation: "sensitive browser API",
  mediaDevices: "sensitive browser API",
  clipboard: "sensitive browser API",
};

const FORBIDDEN_NAMES = new Map(Object.entries(FORBIDDEN_NAMES_LIST));
const FORBIDDEN_PROPERTIES = new Map(Object.entries(FORBIDDEN_PROPERTIES_LIST));
const GLOBALS = new Set(["globalThis", "window", "self", "global", "frames", "document", "navigator", "location", "process", "Object", "Function", "Reflect", "Atomics"]);
const PROCESS_ALLOWED = new Set(["argv", "exit", "exitCode", "platform", "hrtime", "nextTick"]);
const LOCATION_READ = new Set(["hash", "search", "pathname", "href", "protocol", "origin", "host", "hostname"]);

function walk(node, visit, parent = null, key = null) {
  if (!node || typeof node.type !== "string") return;
  visit(node, parent, key);
  for (const [k, value] of Object.entries(node)) {
    if (k === "type" || k === "start" || k === "end" || k === "loc" || k === "range") continue;
    if (Array.isArray(value)) value.forEach((child) => child && typeof child.type === "string" && walk(child, visit, node, k));
    else if (value && typeof value.type === "string") walk(value, visit, node, k);
  }
}

function scopeNames(ast) {
  const declared = new Set();
  walk(ast, (node) => {
    if (node.type === "VariableDeclarator" || node.type === "FunctionDeclaration" || node.type === "ClassDeclaration") collectPattern(node.id, declared);
    if (node.type === "ImportSpecifier" || node.type === "ImportDefaultSpecifier" || node.type === "ImportNamespaceSpecifier") declared.add(node.local.name);
    if (node.type === "FunctionDeclaration" || node.type === "FunctionExpression" || node.type === "ArrowFunctionExpression") node.params.forEach((p) => collectPattern(p, declared));
    if (node.type === "CatchClause" && node.param) collectPattern(node.param, declared);
  });
  return declared;
}

function collectPattern(pattern, out) {
  if (!pattern) return;
  if (pattern.type === "Identifier") out.add(pattern.name);
  else if (pattern.type === "ObjectPattern") pattern.properties.forEach((p) => collectPattern(p.type === "RestElement" ? p.argument : p.value, out));
  else if (pattern.type === "ArrayPattern") pattern.elements.forEach((p) => collectPattern(p, out));
  else if (pattern.type === "RestElement") collectPattern(pattern.argument, out);
  else if (pattern.type === "AssignmentPattern") collectPattern(pattern.left, out);
}

const isReference = (node, parent, key) => {
  if (!parent) return true;
  if ((parent.type === "MemberExpression" && key === "property" && !parent.computed)) return false;
  if ((parent.type === "Property" || parent.type === "PropertyDefinition" || parent.type === "MethodDefinition") && key === "key" && !parent.computed) return false;
  if (parent.type === "VariableDeclarator" && key === "id") return false;
  if ((parent.type === "FunctionDeclaration" || parent.type === "FunctionExpression" || parent.type === "ClassDeclaration" || parent.type === "ClassExpression") && key === "id") return false;
  if (parent.type === "LabeledStatement" || parent.type === "BreakStatement" || parent.type === "ContinueStatement") return false;
  if (parent.type.startsWith("Import") || parent.type.startsWith("Export")) return false;
  return true;
};

export function analyzeSource(path, text, acorn, { kind = "node" } = {}) {
  const findings = [];
  const flag = (node, what) => findings.push(`${path}:${node.loc?.start.line ?? "?"}: ${what}`);
  let ast;
  try {
    ast = acorn.parse(text, { ecmaVersion: "latest", sourceType: "module", locations: true, allowHashBang: true, allowAwaitOutsideFunction: true });
  } catch (moduleError) {
    try {
      ast = acorn.parse(text, { ecmaVersion: "latest", sourceType: "script", locations: true, allowHashBang: true });
    } catch (error) {
      return [`${path}: does not parse as JavaScript (${error.message})`];
    }
  }
  const declared = scopeNames(ast);
  walk(ast, (node, parent, key) => {
    if (node.type === "Identifier" && isReference(node, parent, key) && !declared.has(node.name)) {
      if (FORBIDDEN_NAMES.get(node.name)) flag(node, FORBIDDEN_NAMES.get(node.name));
      if (node.name === "process" && !(parent?.type === "MemberExpression" && parent.object === node && !parent.computed && PROCESS_ALLOWED.has(parent.property.name))) flag(node, "process beyond process.argv, process.exit and process.exitCode");
    }
    if (node.type === "MemberExpression") {
      const name = !node.computed ? node.property.name : node.property.type === "Literal" ? String(node.property.value) : null;
      const onFrameGlobal = node.object.type === "Identifier" && ["window", "self", "globalThis", "frames"].includes(node.object.name);
      const onDocument = node.object.type === "Identifier" && node.object.name === "document";
      const onNavigator = node.object.type === "Identifier" && node.object.name === "navigator";
      if (name && FORBIDDEN_PROPERTIES.get(name)) {
        if (["parent", "top", "opener"].includes(name)) { if (onFrameGlobal) flag(node, FORBIDDEN_PROPERTIES.get(name)); }
        else if (name === "cookie") { if (onDocument) flag(node, FORBIDDEN_PROPERTIES.get(name)); }
        else if (["credentials", "serviceWorker", "geolocation", "mediaDevices", "clipboard", "sendBeacon"].includes(name)) { if (onNavigator) flag(node, FORBIDDEN_PROPERTIES.get(name)); }
        else flag(node, FORBIDDEN_PROPERTIES.get(name));
      }
      if (name && FORBIDDEN_NAMES.get(name) && node.object.type === "Identifier" && GLOBALS.has(node.object.name)) flag(node, FORBIDDEN_NAMES.get(name));
      if (node.computed && node.property.type !== "Literal" && node.object.type === "Identifier" && GLOBALS.has(node.object.name) && !declared.has(node.object.name)) flag(node, `computed access on ${node.object.name} (indirect access to globals)`);
      if (node.object.type === "Identifier" && node.object.name === "location" && !declared.has("location") && name && !LOCATION_READ.has(name)) flag(node, "navigating the page");
      if (name === "env" && node.object.type === "Identifier" && node.object.name === "process") flag(node, "reading environment variables");
    }
    if (node.type === "AssignmentExpression" && node.left.type === "MemberExpression") {
      const target = node.left;
      const root = target.object.type === "Identifier" ? target.object.name : null;
      if ((root === "location" && !declared.has("location")) || (target.object.type === "MemberExpression" && target.object.property?.name === "location") || (root && ["window", "document", "self", "globalThis"].includes(root) && target.property?.name === "location")) flag(node, "navigating the page");
    }
    if (node.type === "ImportExpression" && node.source.type !== "Literal") flag(node, "dynamic import of a computed path");
    if (node.type === "CallExpression" && node.callee.type === "Identifier" && ["setTimeout", "setInterval"].includes(node.callee.name) && node.arguments[0] && (node.arguments[0].type === "Literal" || node.arguments[0].type === "TemplateLiteral")) flag(node, "timer with code in a string");
    if (node.type === "NewExpression" && node.callee.type === "Identifier" && node.callee.name === "Function") flag(node, "code from strings (new Function)");
  });
  return [...new Set(findings)];
}
