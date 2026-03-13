import { createInterface } from "readline";
import { mkdirSync, existsSync } from "fs";
import { join } from "path";
import { createDb } from "./db.js";

const DATA_DIR = process.env.DATA_DIR || "./data";
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

const db = createDb(join(DATA_DIR, "tasks.db"));

// ── Helpers ──────────────────────────────────────────────────────────────────

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + "\n");
}

function result(id, data) {
  send({ jsonrpc: "2.0", id, result: data });
}

function errorResult(id, msg) {
  send({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify({ error: msg }) }], isError: true } });
}

function textResult(id, data) {
  result(id, { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] });
}

// ── Tools ────────────────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "tasks.create",
    description: "Create a new task on the board. Returns the created task with its ID.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Task title" },
        description: { type: "string", description: "Detailed task description" },
        assignee: { type: "string", description: "Who is assigned (skill name or 'user')" },
        priority: { type: "string", enum: ["low", "medium", "high", "critical"], description: "Task priority" },
        tags: { type: "array", items: { type: "string" }, description: "Tags for categorization" }
      },
      required: ["title"]
    }
  },
  {
    name: "tasks.list",
    description: "List tasks on the board. Filter by status, assignee, priority, or tag.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["todo", "in_progress", "review", "testing", "done"], description: "Filter by status" },
        assignee: { type: "string", description: "Filter by assignee" },
        priority: { type: "string", enum: ["low", "medium", "high", "critical"], description: "Filter by priority" },
        tag: { type: "string", description: "Filter by tag" }
      }
    }
  },
  {
    name: "tasks.get",
    description: "Get full task details by ID, including all comments.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Task ID" }
      },
      required: ["id"]
    }
  },
  {
    name: "tasks.update",
    description: "Update a task's fields. Only provided fields are changed.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Task ID" },
        title: { type: "string", description: "New title" },
        description: { type: "string", description: "New description" },
        status: { type: "string", enum: ["todo", "in_progress", "review", "testing", "done"], description: "New status" },
        assignee: { type: "string", description: "New assignee" },
        priority: { type: "string", enum: ["low", "medium", "high", "critical"], description: "New priority" },
        tags: { type: "array", items: { type: "string" }, description: "New tags" }
      },
      required: ["id"]
    }
  },
  {
    name: "tasks.complete",
    description: "Mark a task as done. Adds a completion comment with summary.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Task ID" },
        summary: { type: "string", description: "Completion summary — what was done" }
      },
      required: ["id"]
    }
  },
  {
    name: "tasks.add_comment",
    description: "Add a comment to a task. Used for updates, review notes, test results, etc.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Task ID" },
        author: { type: "string", description: "Who is commenting (skill name or 'user')" },
        text: { type: "string", description: "Comment text" }
      },
      required: ["id", "text"]
    }
  }
];

// ── Tool Handlers ────────────────────────────────────────────────────────────

async function handleCall(name, args) {
  switch (name) {
    case "tasks.create":
      return { ok: true, task: db.createTask(args) };

    case "tasks.list": {
      const tasks = db.listTasks(args);
      return { tasks, count: tasks.length };
    }

    case "tasks.get":
      return db.getTask(args.id);

    case "tasks.update": {
      const { id, ...fields } = args;
      return { ok: true, task: db.updateTask(id, fields) };
    }

    case "tasks.complete":
      return { ok: true, task: db.completeTask(args.id, args.summary) };

    case "tasks.add_comment":
      return { ok: true, task_id: args.id, comment: db.addComment(args.id, args.author, args.text) };

    default:
      throw new Error("Unknown tool: " + name);
  }
}

// ── JSON-RPC Handler ─────────────────────────────────────────────────────────

const rl = createInterface({ input: process.stdin });

rl.on("line", async (line) => {
  let req;
  try {
    req = JSON.parse(line);
  } catch {
    return;
  }

  try {
    switch (req.method) {
      case "initialize":
        return result(req.id, {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "task-board-mcp", version: "2.0.0" }
        });

      case "notifications/initialized":
        return;

      case "tools/list":
        return result(req.id, { tools: TOOLS });

      case "tools/call": {
        const res = await handleCall(req.params.name, req.params.arguments || {});
        return textResult(req.id, res);
      }

      case "ping":
        return result(req.id, {});

      default:
        send({ jsonrpc: "2.0", id: req.id, error: { code: -32601, message: `Method not found: ${req.method}` } });
    }
  } catch (err) {
    if (req.id !== undefined) {
      errorResult(req.id, err.message);
    }
  }
});

process.stderr.write("task-board-mcp v2.0.0 started (SQLite). DATA_DIR=" + DATA_DIR + "\n");
