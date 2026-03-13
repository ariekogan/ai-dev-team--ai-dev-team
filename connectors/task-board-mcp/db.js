import Database from "better-sqlite3";
import { readFileSync, renameSync, existsSync } from "fs";
import { join } from "path";

const VALID_STATUSES = ["todo", "in_progress", "review", "testing", "done"];
const VALID_PRIORITIES = ["low", "medium", "high", "critical"];

function generateId() {
  return "TASK-" + Date.now().toString(36).toUpperCase() + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
}

export function createDb(dbPath) {
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      status TEXT DEFAULT 'todo',
      assignee TEXT DEFAULT 'unassigned',
      priority TEXT DEFAULT 'medium',
      tags TEXT DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      completed_at TEXT
    );
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT NOT NULL REFERENCES tasks(id),
      author TEXT DEFAULT 'unknown',
      text TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_comments_task ON comments(task_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
  `);

  // Auto-migrate from tasks.json if it exists alongside the DB
  if (dbPath !== ":memory:") {
    const jsonFile = join(dbPath, "..", "tasks.json");
    if (existsSync(jsonFile)) {
      try {
        const existing = db.prepare("SELECT COUNT(*) as c FROM tasks").get();
        if (existing.c === 0) {
          const tasks = JSON.parse(readFileSync(jsonFile, "utf8"));
          migrateFromJson(db, tasks);
          renameSync(jsonFile, jsonFile + ".migrated");
          process.stderr.write(`Migrated ${tasks.length} tasks from tasks.json to SQLite\n`);
        }
      } catch (err) {
        process.stderr.write(`Migration warning: ${err.message}\n`);
      }
    }
  }

  return {
    createTask({ title, description, assignee, priority, tags }) {
      if (priority && !VALID_PRIORITIES.includes(priority)) {
        throw new Error(`Invalid priority: ${priority}. Valid: ${VALID_PRIORITIES.join(", ")}`);
      }
      const now = new Date().toISOString();
      const id = generateId();
      const task = {
        id,
        title,
        description: description || "",
        status: "todo",
        assignee: assignee || "unassigned",
        priority: priority || "medium",
        tags: tags || [],
        created_at: now,
        updated_at: now,
        completed_at: null,
      };
      db.prepare(`INSERT INTO tasks (id, title, description, status, assignee, priority, tags, created_at, updated_at)
                   VALUES (@id, @title, @description, @status, @assignee, @priority, @tags, @created_at, @updated_at)`)
        .run({ ...task, tags: JSON.stringify(task.tags) });
      return task;
    },

    listTasks({ status, assignee, priority, tag } = {}) {
      let sql = `SELECT t.*, (SELECT COUNT(*) FROM comments c WHERE c.task_id = t.id) AS comment_count FROM tasks t WHERE 1=1`;
      const params = {};
      if (status) { sql += " AND t.status = @status"; params.status = status; }
      if (assignee) { sql += " AND t.assignee = @assignee"; params.assignee = assignee; }
      if (priority) { sql += " AND t.priority = @priority"; params.priority = priority; }
      if (tag) { sql += " AND t.tags LIKE @tag"; params.tag = `%"${tag}"%`; }
      sql += " ORDER BY t.updated_at DESC";

      const rows = db.prepare(sql).all(params);
      return rows.map(r => ({
        id: r.id,
        title: r.title,
        status: r.status,
        assignee: r.assignee,
        priority: r.priority,
        tags: JSON.parse(r.tags || "[]"),
        comment_count: r.comment_count,
        updated_at: r.updated_at,
      }));
    },

    getTask(id) {
      const row = db.prepare("SELECT * FROM tasks WHERE id = @id").get({ id });
      if (!row) throw new Error(`Task not found: ${id}`);
      const comments = db.prepare("SELECT * FROM comments WHERE task_id = @id ORDER BY created_at").all({ id });
      return {
        ...row,
        tags: JSON.parse(row.tags || "[]"),
        comments: comments.map(c => ({ author: c.author, text: c.text, created_at: c.created_at })),
      };
    },

    updateTask(id, fields) {
      const existing = db.prepare("SELECT * FROM tasks WHERE id = @id").get({ id });
      if (!existing) throw new Error(`Task not found: ${id}`);

      if (fields.status && !VALID_STATUSES.includes(fields.status)) {
        throw new Error(`Invalid status: ${fields.status}. Valid: ${VALID_STATUSES.join(", ")}`);
      }
      if (fields.priority && !VALID_PRIORITIES.includes(fields.priority)) {
        throw new Error(`Invalid priority: ${fields.priority}. Valid: ${VALID_PRIORITIES.join(", ")}`);
      }

      const now = new Date().toISOString();
      const updates = [];
      const params = { id, updated_at: now };

      for (const key of ["title", "description", "status", "assignee", "priority", "tags"]) {
        if (fields[key] !== undefined) {
          updates.push(`${key} = @${key}`);
          params[key] = key === "tags" ? JSON.stringify(fields[key]) : fields[key];
        }
      }
      updates.push("updated_at = @updated_at");

      db.prepare(`UPDATE tasks SET ${updates.join(", ")} WHERE id = @id`).run(params);

      const updated = db.prepare("SELECT * FROM tasks WHERE id = @id").get({ id });
      return {
        id: updated.id,
        title: updated.title,
        status: updated.status,
        assignee: updated.assignee,
        updated_at: updated.updated_at,
      };
    },

    completeTask(id, summary) {
      const existing = db.prepare("SELECT * FROM tasks WHERE id = @id").get({ id });
      if (!existing) throw new Error(`Task not found: ${id}`);

      const now = new Date().toISOString();
      db.prepare("UPDATE tasks SET status = 'done', updated_at = @now, completed_at = @now WHERE id = @id")
        .run({ id, now });
      db.prepare("INSERT INTO comments (task_id, author, text, created_at) VALUES (@id, 'system', @text, @now)")
        .run({ id, text: summary || "Task completed", now });

      return { id, title: existing.title, status: "done", completed_at: now };
    },

    addComment(taskId, author, text) {
      const existing = db.prepare("SELECT id FROM tasks WHERE id = @id").get({ id: taskId });
      if (!existing) throw new Error(`Task not found: ${taskId}`);

      const now = new Date().toISOString();
      db.prepare("INSERT INTO comments (task_id, author, text, created_at) VALUES (@taskId, @author, @text, @now)")
        .run({ taskId, author: author || "unknown", text, now });
      db.prepare("UPDATE tasks SET updated_at = @now WHERE id = @id").run({ id: taskId, now });

      return { task_id: taskId, author: author || "unknown", text, created_at: now };
    },

    close() {
      db.close();
    },
  };
}

function migrateFromJson(db, tasks) {
  const insertTask = db.prepare(`INSERT INTO tasks (id, title, description, status, assignee, priority, tags, created_at, updated_at, completed_at)
    VALUES (@id, @title, @description, @status, @assignee, @priority, @tags, @created_at, @updated_at, @completed_at)`);
  const insertComment = db.prepare(`INSERT INTO comments (task_id, author, text, created_at)
    VALUES (@task_id, @author, @text, @created_at)`);

  const migrate = db.transaction((tasks) => {
    for (const t of tasks) {
      insertTask.run({
        id: t.id,
        title: t.title || "",
        description: t.description || "",
        status: t.status || "todo",
        assignee: t.assignee || "unassigned",
        priority: t.priority || "medium",
        tags: JSON.stringify(t.tags || []),
        created_at: t.created_at || new Date().toISOString(),
        updated_at: t.updated_at || new Date().toISOString(),
        completed_at: t.completed_at || null,
      });
      for (const c of (t.comments || [])) {
        insertComment.run({
          task_id: t.id,
          author: c.author || "unknown",
          text: c.text || "",
          created_at: c.created_at || new Date().toISOString(),
        });
      }
    }
  });
  migrate(tasks);
}
