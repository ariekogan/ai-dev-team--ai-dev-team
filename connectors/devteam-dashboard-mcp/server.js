import { createInterface } from "readline";
import { readFileSync, readdirSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import Database from "better-sqlite3";

const DATA_DIR = process.env.DATA_DIR || "./data";

// Compute sibling connector data paths
const CONNECTOR_DATA_ROOT = join(DATA_DIR, "..");
const TASKS_DB_PATH = join(CONNECTOR_DATA_ROOT, "task-board-mcp", "tasks.db");
const DOCS_DIR = join(CONNECTOR_DATA_ROOT, "project-knowledge-mcp", "docs");

// Ensure own data dir exists
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

// ── Helpers ──────────────────────────────────────────────────────────────────

function send(msg) { process.stdout.write(JSON.stringify(msg) + "\n"); }
function result(id, data) { send({ jsonrpc: "2.0", id, result: data }); }
function errorResult(id, msg) { send({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify({ error: msg }) }], isError: true } }); }
function textResult(id, data) { result(id, { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] }); }

function loadTasks() {
  if (!existsSync(TASKS_DB_PATH)) {
    // Fallback: try legacy JSON file
    const jsonFile = join(CONNECTOR_DATA_ROOT, "task-board-mcp", "tasks.json");
    if (existsSync(jsonFile)) {
      try { return JSON.parse(readFileSync(jsonFile, "utf8")); }
      catch { return []; }
    }
    return [];
  }
  try {
    const db = new Database(TASKS_DB_PATH, { readonly: true, fileMustExist: true });
    const tasks = db.prepare("SELECT * FROM tasks ORDER BY updated_at DESC").all();
    const comments = db.prepare("SELECT * FROM comments ORDER BY created_at").all();
    db.close();

    // Group comments by task_id
    const commentsByTask = {};
    for (const c of comments) {
      if (!commentsByTask[c.task_id]) commentsByTask[c.task_id] = [];
      commentsByTask[c.task_id].push({ author: c.author, text: c.text, created_at: c.created_at });
    }

    return tasks.map(t => ({
      id: t.id,
      title: t.title,
      description: t.description,
      status: t.status,
      assignee: t.assignee,
      priority: t.priority,
      tags: JSON.parse(t.tags || "[]"),
      comments: commentsByTask[t.id] || [],
      created_at: t.created_at,
      updated_at: t.updated_at,
      completed_at: t.completed_at,
    }));
  } catch (err) {
    process.stderr.write(`loadTasks error: ${err.message}\n`);
    return [];
  }
}

function loadAllDocs() {
  if (!existsSync(DOCS_DIR)) return [];
  try {
    return readdirSync(DOCS_DIR)
      .filter(f => f.endsWith(".json"))
      .map(f => JSON.parse(readFileSync(join(DOCS_DIR, f), "utf8")));
  } catch { return []; }
}

function loadDoc(id) {
  const file = join(DOCS_DIR, `${id}.json`);
  if (!existsSync(file)) return null;
  try { return JSON.parse(readFileSync(file, "utf8")); }
  catch { return null; }
}

// ── Plugin Manifest ──────────────────────────────────────────────────────────

const PLUGIN_ID = "devteam-dashboard";
const PLUGIN_VERSION = "1.0.0";
const CONNECTOR_ID = "devteam-dashboard-mcp";

const PLUGIN_MANIFEST = {
  id: `mcp:${CONNECTOR_ID}:${PLUGIN_ID}`,
  name: "Dev Team Dashboard",
  version: PLUGIN_VERSION,
  description: "Kanban task board, knowledge base browser, and activity feed for the AI Dev Team.",
  type: "ui",
  render: {
    mode: "adaptive",
    iframe: {
      iframeUrl: `/ui/${PLUGIN_ID}/${PLUGIN_VERSION}/index.html`,
    },
    reactNative: {
      component: "devteam-dashboard",
    },
  },
  capabilities: {
    haptics: true,
  },
  channels: ["command"],
  commands: [],
};

// ── Tools ────────────────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "ui.listPlugins",
    description: "List available UI plugins provided by this connector.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "ui.getPlugin",
    description: "Get the manifest for a specific UI plugin.",
    inputSchema: {
      type: "object",
      properties: { plugin_id: { type: "string", description: "Plugin ID" } },
      required: ["plugin_id"],
    },
  },
  {
    name: "dashboard.overview",
    description: "Get dashboard overview: task counts by status and doc count.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "dashboard.tasks",
    description: "Get all tasks for the kanban board.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "dashboard.docs",
    description: "Get all knowledge base document summaries.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "dashboard.doc",
    description: "Get a single knowledge base document with full content.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", description: "Document ID" } },
      required: ["id"],
    },
  },
];

// ── Tool Handlers ────────────────────────────────────────────────────────────

async function handleCall(name, args) {
  switch (name) {
    case "ui.listPlugins":
      return { plugins: [{ id: PLUGIN_ID, name: PLUGIN_MANIFEST.name, version: PLUGIN_VERSION }] };

    case "ui.getPlugin": {
      const pluginId = args?.plugin_id;
      if (pluginId && pluginId !== PLUGIN_ID) {
        throw new Error(`Unknown plugin: ${pluginId}`);
      }
      return PLUGIN_MANIFEST;
    }

    case "dashboard.overview": {
      const tasks = loadTasks();
      const docs = loadAllDocs();
      const statusCounts = {};
      for (const t of tasks) {
        statusCounts[t.status] = (statusCounts[t.status] || 0) + 1;
      }
      return {
        tasks: { total: tasks.length, by_status: statusCounts },
        docs: { total: docs.length, categories: [...new Set(docs.map(d => d.category))] },
      };
    }

    case "dashboard.tasks": {
      const tasks = loadTasks();
      return { tasks, count: tasks.length };
    }

    case "dashboard.docs": {
      const docs = loadAllDocs();
      const summaries = docs.map(d => ({
        id: d.id, title: d.title, category: d.category,
        tags: d.tags || [], updated_at: d.updated_at,
      }));
      return { docs: summaries, count: summaries.length };
    }

    case "dashboard.doc": {
      const doc = loadDoc(args.id);
      if (!doc) throw new Error(`Document not found: ${args.id}`);
      return doc;
    }

    default:
      throw new Error("Unknown tool: " + name);
  }
}

// ── JSON-RPC Handler ─────────────────────────────────────────────────────────

const rl = createInterface({ input: process.stdin });

rl.on("line", async (line) => {
  let req;
  try { req = JSON.parse(line); } catch { return; }

  try {
    switch (req.method) {
      case "initialize":
        return result(req.id, {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "devteam-dashboard-mcp", version: "1.1.0" },
        });
      case "notifications/initialized": return;
      case "tools/list": return result(req.id, { tools: TOOLS });
      case "tools/call": {
        const res = await handleCall(req.params.name, req.params.arguments || {});
        return textResult(req.id, res);
      }
      case "ping": return result(req.id, {});
      default:
        send({ jsonrpc: "2.0", id: req.id, error: { code: -32601, message: `Method not found: ${req.method}` } });
    }
  } catch (err) {
    if (req.id !== undefined) errorResult(req.id, err.message);
  }
});

process.stderr.write(`devteam-dashboard-mcp v1.1.0 started (SQLite). TASKS_DB=${TASKS_DB_PATH}, DOCS=${DOCS_DIR}\n`);
