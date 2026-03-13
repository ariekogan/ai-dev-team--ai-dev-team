import { createInterface } from "readline";
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

const DATA_DIR = process.env.DATA_DIR || "./data";
const DOCS_DIR = join(DATA_DIR, "docs");

// Ensure storage directories exist
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
if (!existsSync(DOCS_DIR)) mkdirSync(DOCS_DIR, { recursive: true });

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

function loadDoc(id) {
  const file = join(DOCS_DIR, `${id}.json`);
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, "utf8"));
}

function saveDoc(doc) {
  const file = join(DOCS_DIR, `${doc.id}.json`);
  writeFileSync(file, JSON.stringify(doc, null, 2));
}

function allDocs() {
  if (!existsSync(DOCS_DIR)) return [];
  return readdirSync(DOCS_DIR)
    .filter(f => f.endsWith(".json"))
    .map(f => JSON.parse(readFileSync(join(DOCS_DIR, f), "utf8")));
}

function generateId(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) + "-" + Date.now().toString(36);
}

// ── Tools ────────────────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "knowledge.list_docs",
    description: "List all knowledge base documents. Optionally filter by category or tags.",
    inputSchema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description: "Filter by category: architecture, standards, rules, decisions",
          enum: ["architecture", "standards", "rules", "decisions"]
        },
        tag: {
          type: "string",
          description: "Filter by tag"
        }
      }
    }
  },
  {
    name: "knowledge.get_doc",
    description: "Get a specific document by its ID. Returns full content.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Document ID" }
      },
      required: ["id"]
    }
  },
  {
    name: "knowledge.update_doc",
    description: "Create or update a knowledge base document. If id is provided and exists, updates it. Otherwise creates a new doc.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Document ID (optional for new docs — auto-generated from title)" },
        title: { type: "string", description: "Document title" },
        category: {
          type: "string",
          description: "Document category",
          enum: ["architecture", "standards", "rules", "decisions"]
        },
        content: { type: "string", description: "Full document content (markdown supported)" },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Tags for organization and search"
        }
      },
      required: ["title", "category", "content"]
    }
  },
  {
    name: "knowledge.search",
    description: "Search documents by keyword in title, content, and tags. Returns matching docs with highlighted snippets.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query (searches title, content, and tags)" }
      },
      required: ["query"]
    }
  }
];

// ── Tool Handlers ────────────────────────────────────────────────────────────

async function handleCall(name, args) {
  switch (name) {
    case "knowledge.list_docs": {
      let docs = allDocs();
      if (args.category) docs = docs.filter(d => d.category === args.category);
      if (args.tag) docs = docs.filter(d => d.tags && d.tags.includes(args.tag));
      // Return summaries (no full content)
      const summaries = docs.map(d => ({
        id: d.id,
        title: d.title,
        category: d.category,
        tags: d.tags || [],
        updated_at: d.updated_at
      }));
      return { docs: summaries, count: summaries.length };
    }

    case "knowledge.get_doc": {
      const doc = loadDoc(args.id);
      if (!doc) throw new Error(`Document not found: ${args.id}`);
      return doc;
    }

    case "knowledge.update_doc": {
      const now = new Date().toISOString();
      let doc = args.id ? loadDoc(args.id) : null;

      if (doc) {
        // Update existing
        doc.title = args.title || doc.title;
        doc.category = args.category || doc.category;
        doc.content = args.content || doc.content;
        doc.tags = args.tags || doc.tags;
        doc.updated_at = now;
      } else {
        // Create new
        doc = {
          id: args.id || generateId(args.title),
          title: args.title,
          category: args.category,
          content: args.content,
          tags: args.tags || [],
          created_at: now,
          updated_at: now
        };
      }

      saveDoc(doc);
      return { ok: true, doc: { id: doc.id, title: doc.title, category: doc.category, updated_at: doc.updated_at } };
    }

    case "knowledge.search": {
      const query = (args.query || "").toLowerCase();
      if (!query) throw new Error("Search query is required");

      const docs = allDocs();
      const results = [];

      for (const doc of docs) {
        const titleMatch = doc.title.toLowerCase().includes(query);
        const contentMatch = doc.content.toLowerCase().includes(query);
        const tagMatch = (doc.tags || []).some(t => t.toLowerCase().includes(query));

        if (titleMatch || contentMatch || tagMatch) {
          // Extract snippet around match in content
          let snippet = "";
          if (contentMatch) {
            const idx = doc.content.toLowerCase().indexOf(query);
            const start = Math.max(0, idx - 80);
            const end = Math.min(doc.content.length, idx + query.length + 80);
            snippet = (start > 0 ? "..." : "") + doc.content.slice(start, end) + (end < doc.content.length ? "..." : "");
          }

          results.push({
            id: doc.id,
            title: doc.title,
            category: doc.category,
            tags: doc.tags || [],
            snippet,
            match_in: [
              titleMatch && "title",
              contentMatch && "content",
              tagMatch && "tags"
            ].filter(Boolean)
          });
        }
      }

      return { results, count: results.length, query: args.query };
    }

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
    return; // ignore malformed input
  }

  try {
    switch (req.method) {
      case "initialize":
        return result(req.id, {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "project-knowledge-mcp", version: "1.0.0" }
        });

      case "notifications/initialized":
        return; // no response needed

      case "tools/list":
        return result(req.id, { tools: TOOLS });

      case "tools/call": {
        const res = await handleCall(req.params.name, req.params.arguments || {});
        return textResult(req.id, res);
      }

      case "ping":
        return result(req.id, {});

      default:
        // Unknown method — return error per JSON-RPC spec
        send({ jsonrpc: "2.0", id: req.id, error: { code: -32601, message: `Method not found: ${req.method}` } });
    }
  } catch (err) {
    if (req.id !== undefined) {
      errorResult(req.id, err.message);
    }
  }
});

process.stderr.write("project-knowledge-mcp started. DATA_DIR=" + DATA_DIR + "\n");
