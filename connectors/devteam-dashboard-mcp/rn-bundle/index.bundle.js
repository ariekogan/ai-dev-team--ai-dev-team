var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// rn-src/index.tsx
var rn_src_exports = {};
__export(rn_src_exports, {
  default: () => rn_src_default
});
module.exports = __toCommonJS(rn_src_exports);
var import_react = __toESM(require("react"), 1);
var import_react_native = require("react-native");
var import_plugin_sdk = require("@adas/plugin-sdk");
var STATUS_ORDER = ["todo", "in_progress", "review", "testing", "done"];
var STATUS_LABELS = {
  todo: "To Do",
  in_progress: "In Progress",
  review: "Review",
  testing: "Testing",
  done: "Done"
};
function priorityColor(priority, theme) {
  switch (priority) {
    case "critical":
      return theme.colors.error;
    case "high":
      return theme.colors.warning;
    case "medium":
      return theme.colors.accent;
    case "low":
      return theme.colors.textMuted;
    default:
      return theme.colors.textMuted;
  }
}
function statusColor(status, theme) {
  switch (status) {
    case "done":
      return theme.colors.success;
    case "in_progress":
      return theme.colors.accent;
    case "review":
      return theme.colors.purple;
    case "testing":
      return theme.colors.warning;
    case "todo":
      return theme.colors.textMuted;
    default:
      return theme.colors.textMuted;
  }
}
var rn_src_default = import_plugin_sdk.PluginSDK.register("devteam-dashboard", {
  type: "ui",
  capabilities: { haptics: true },
  Component({ bridge, native, theme }) {
    const api = (0, import_plugin_sdk.useApi)(bridge);
    const [tab, setTab] = (0, import_react.useState)("tasks");
    const [tasks, setTasks] = (0, import_react.useState)([]);
    const [docs, setDocs] = (0, import_react.useState)([]);
    const [loading, setLoading] = (0, import_react.useState)(true);
    const [refreshing, setRefreshing] = (0, import_react.useState)(false);
    const [error, setError] = (0, import_react.useState)(null);
    const [selectedTask, setSelectedTask] = (0, import_react.useState)(null);
    const [selectedDoc, setSelectedDoc] = (0, import_react.useState)(null);
    const [detailLoading, setDetailLoading] = (0, import_react.useState)(false);
    const apiRef = (0, import_react.useRef)(api);
    apiRef.current = api;
    const fetchData = (0, import_react.useCallback)(async (isRefresh = false) => {
      try {
        if (!isRefresh) {
          setLoading(true);
          setError(null);
        }
        const [taskRes, docRes] = await Promise.allSettled([
          apiRef.current("task-board-mcp", "tasks.list", {}),
          apiRef.current("project-knowledge-mcp", "knowledge.list_docs", {})
        ]);
        if (taskRes.status === "fulfilled") {
          setTasks(taskRes.value?.tasks || []);
        }
        if (docRes.status === "fulfilled") {
          setDocs(docRes.value?.docs || []);
        }
        if (!isRefresh && taskRes.status === "rejected" && docRes.status === "rejected") {
          setError("Failed to load data. Check connectivity.");
        }
      } catch (err) {
        if (!isRefresh)
          setError(err.message);
      } finally {
        if (!isRefresh)
          setLoading(false);
        setRefreshing(false);
      }
    }, []);
    (0, import_react.useEffect)(() => {
      fetchData();
    }, [fetchData]);
    (0, import_react.useEffect)(() => {
      const interval = setInterval(() => fetchData(true), 3e4);
      return () => clearInterval(interval);
    }, [fetchData]);
    const openTask = (0, import_react.useCallback)(async (taskId) => {
      try {
        native.haptics.impact("light");
      } catch {
      }
      setDetailLoading(true);
      try {
        const full = await api("task-board-mcp", "tasks.get", { id: taskId });
        setSelectedTask(full);
      } catch {
        const t = tasks.find((t2) => t2.id === taskId);
        if (t)
          setSelectedTask(t);
      }
      setDetailLoading(false);
    }, [api, native, tasks]);
    const openDoc = (0, import_react.useCallback)(async (docId) => {
      try {
        native.haptics.impact("light");
      } catch {
      }
      setDetailLoading(true);
      try {
        const full = await api("project-knowledge-mcp", "knowledge.get_doc", { id: docId });
        setSelectedDoc(full);
      } catch {
        const d = docs.find((d2) => d2.id === docId);
        if (d)
          setSelectedDoc(d);
      }
      setDetailLoading(false);
    }, [api, native, docs]);
    if (loading) {
      return /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: [s.center, { backgroundColor: theme.colors.bg }] }, /* @__PURE__ */ import_react.default.createElement(import_react_native.ActivityIndicator, { size: "small", color: theme.colors.accent }), /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: { color: theme.colors.textSecondary, marginTop: 8, fontSize: 14 } }, "Loading dashboard..."));
    }
    if (error && tasks.length === 0 && docs.length === 0) {
      return /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: [s.center, { backgroundColor: theme.colors.bg }] }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: { color: theme.colors.error, fontSize: 14, textAlign: "center" } }, error), /* @__PURE__ */ import_react.default.createElement(
        import_react_native.Pressable,
        {
          style: [s.retryBtn, { backgroundColor: theme.colors.accentSoft }],
          onPress: () => fetchData()
        },
        /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: { color: theme.colors.accent, fontWeight: "600" } }, "Retry")
      ));
    }
    const tasksByStatus = (status) => tasks.filter((t) => t.status === status);
    return /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: [s.container, { backgroundColor: theme.colors.bg }] }, /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: [s.tabBar, { borderBottomColor: theme.colors.border }] }, ["tasks", "docs"].map((t) => /* @__PURE__ */ import_react.default.createElement(
      import_react_native.Pressable,
      {
        key: t,
        style: [s.tab, tab === t && { borderBottomColor: theme.colors.accent }],
        onPress: () => {
          setTab(t);
          try {
            native.haptics.selection();
          } catch {
          }
        }
      },
      /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: {
        color: tab === t ? theme.colors.accent : theme.colors.textSecondary,
        fontSize: 14,
        fontWeight: tab === t ? "600" : "400"
      } }, t === "tasks" ? `Tasks (${tasks.length})` : `Docs (${docs.length})`)
    ))), tab === "tasks" && /* @__PURE__ */ import_react.default.createElement(
      import_react_native.ScrollView,
      {
        horizontal: true,
        nestedScrollEnabled: true,
        showsHorizontalScrollIndicator: true,
        scrollEventThrottle: 16,
        contentContainerStyle: { paddingVertical: 12 },
        refreshControl: /* @__PURE__ */ import_react.default.createElement(import_react_native.RefreshControl, { refreshing, onRefresh: () => fetchData(true), tintColor: theme.colors.accent })
      },
      STATUS_ORDER.map((status) => {
        const statusTasks = tasksByStatus(status);
        return /* @__PURE__ */ import_react.default.createElement(
          import_react_native.View,
          {
            key: status,
            style: [
              s.kanbanColumn,
              {
                backgroundColor: theme.colors.bg,
                borderRightColor: theme.colors.border
              }
            ]
          },
          /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: s.columnHeader }, /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: [s.statusDot, { backgroundColor: statusColor(status, theme) }] }), /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.columnTitle, { color: theme.colors.text }] }, STATUS_LABELS[status])),
          /* @__PURE__ */ import_react.default.createElement(
            import_react_native.ScrollView,
            {
              scrollEnabled: true,
              nestedScrollEnabled: true,
              contentContainerStyle: s.columnCards,
              showsVerticalScrollIndicator: true
            },
            statusTasks.length === 0 ? /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: s.emptyColumn }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: { color: theme.colors.textMuted, fontSize: 12 } }, "No tasks")) : statusTasks.map((task) => /* @__PURE__ */ import_react.default.createElement(
              import_react_native.Pressable,
              {
                key: task.id,
                style: [
                  s.kanbanTaskCard,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: task.priority === "critical" ? theme.colors.error : task.priority === "high" ? theme.colors.warning : theme.colors.border,
                    borderLeftWidth: task.priority ? 3 : 1
                  }
                ],
                onPress: () => openTask(task.id)
              },
              /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.cardTitle, { color: theme.colors.text }], numberOfLines: 3 }, task.title),
              task.tags && task.tags.length > 0 && /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: s.cardTags }, task.tags.slice(0, 2).map((tag) => /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { key: tag, style: [s.miniTag, { backgroundColor: theme.colors.accentSoft }] }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: { color: theme.colors.accent, fontSize: 8, fontWeight: "500" } }, tag)))),
              task.assignee && /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.cardAssignee, { color: theme.colors.textSecondary }] }, task.assignee)
            ))
          )
        );
      })
    ), tab === "docs" && /* @__PURE__ */ import_react.default.createElement(
      import_react_native.FlatList,
      {
        data: docs,
        keyExtractor: (item) => item.id,
        refreshControl: /* @__PURE__ */ import_react.default.createElement(import_react_native.RefreshControl, { refreshing, onRefresh: () => fetchData(true), tintColor: theme.colors.accent }),
        contentContainerStyle: s.docList,
        renderItem: ({ item: doc }) => /* @__PURE__ */ import_react.default.createElement(
          import_react_native.Pressable,
          {
            style: [
              s.docCard,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border
              }
            ],
            onPress: () => openDoc(doc.id)
          },
          /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: s.docHeader }, doc.category && /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: [s.docCategory, { backgroundColor: theme.colors.purpleSoft }] }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: { color: theme.colors.purple, fontSize: 12, fontWeight: "600" } }, doc.category.toUpperCase()))),
          /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.docTitle, { color: theme.colors.text }], numberOfLines: 2 }, doc.title),
          doc.updated_at && /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.docDate, { color: theme.colors.textMuted }] }, "Updated ", new Date(doc.updated_at).toLocaleDateString()),
          doc.tags && doc.tags.length > 0 && /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: s.docTagRow }, doc.tags.slice(0, 3).map((tag) => /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { key: tag, style: [s.tag, { backgroundColor: theme.colors.accentSoft }] }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: { color: theme.colors.accent, fontSize: 10, fontWeight: "500" } }, tag))))
        ),
        ListEmptyComponent: /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: s.center }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: { color: theme.colors.textSecondary } }, "No documents found"))
      }
    ), /* @__PURE__ */ import_react.default.createElement(import_react_native.Modal, { visible: !!selectedTask, animationType: "slide", presentationStyle: "pageSheet" }, selectedTask && /* @__PURE__ */ import_react.default.createElement(
      TaskDetail,
      {
        task: selectedTask,
        theme,
        loading: detailLoading,
        onClose: () => setSelectedTask(null)
      }
    )), /* @__PURE__ */ import_react.default.createElement(import_react_native.Modal, { visible: !!selectedDoc, animationType: "slide", presentationStyle: "pageSheet" }, selectedDoc && /* @__PURE__ */ import_react.default.createElement(
      DocDetail,
      {
        doc: selectedDoc,
        theme,
        loading: detailLoading,
        onClose: () => setSelectedDoc(null)
      }
    )));
  }
});
function TaskDetail({ task, theme, loading, onClose }) {
  return /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: [s.modal, { backgroundColor: theme.colors.bg }] }, /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: [s.modalHeader, { borderBottomColor: theme.colors.border }] }, /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: { flex: 1 } }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.modalTitle, { color: theme.colors.text }], numberOfLines: 2 }, task.title)), /* @__PURE__ */ import_react.default.createElement(import_react_native.Pressable, { style: s.closeBtn, onPress: onClose }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: { color: theme.colors.textSecondary, fontSize: 16 } }, "Done"))), /* @__PURE__ */ import_react.default.createElement(import_react_native.ScrollView, { style: s.modalBody, contentContainerStyle: { paddingBottom: 40 } }, /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: s.metaRow }, /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: [s.statusBadge, { backgroundColor: statusColor(task.status, theme) + "20" }] }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: { color: statusColor(task.status, theme), fontSize: 12, fontWeight: "600" } }, STATUS_LABELS[task.status] || task.status)), task.priority && /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: [s.statusBadge, { backgroundColor: priorityColor(task.priority, theme) + "20" }] }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: { color: priorityColor(task.priority, theme), fontSize: 12, fontWeight: "600" } }, task.priority.toUpperCase())), task.assignee && /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: { color: theme.colors.textSecondary, fontSize: 13 } }, "Assigned to ", task.assignee)), task.description && /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: s.descSection }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.sectionLabel, { color: theme.colors.text }] }, "Description"), /* @__PURE__ */ import_react.default.createElement(RenderMarkdown, { content: task.description, theme })), task.tags && task.tags.length > 0 && /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: s.tagRow }, task.tags.map((tag) => /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { key: tag, style: [s.tag, { backgroundColor: theme.colors.accentSoft }] }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: { color: theme.colors.accent, fontSize: 11 } }, tag)))), task.comments && task.comments.length > 0 && /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: s.commentsSection }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.commentsTitle, { color: theme.colors.text }] }, "Comments (", task.comments.length, ")"), task.comments.map((c, i) => /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { key: i, style: [s.comment, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }] }, /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: s.commentHeader }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: { color: theme.colors.accent, fontSize: 12, fontWeight: "600" } }, c.author), c.created_at && /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: { color: theme.colors.textMuted, fontSize: 11 } }, new Date(c.created_at).toLocaleDateString())), /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: { color: theme.colors.text, fontSize: 13, marginTop: 4, lineHeight: 18 } }, c.text)))), loading && /* @__PURE__ */ import_react.default.createElement(import_react_native.ActivityIndicator, { size: "small", color: theme.colors.accent, style: { marginTop: 16 } })));
}
function DocDetail({ doc, theme, loading, onClose }) {
  return /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: [s.modal, { backgroundColor: theme.colors.bg }] }, /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: [s.modalHeader, { borderBottomColor: theme.colors.border }] }, /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: { flex: 1 } }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.modalTitle, { color: theme.colors.text }], numberOfLines: 2 }, doc.title)), /* @__PURE__ */ import_react.default.createElement(import_react_native.Pressable, { style: s.closeBtn, onPress: onClose }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: { color: theme.colors.textSecondary, fontSize: 16 } }, "Done"))), /* @__PURE__ */ import_react.default.createElement(import_react_native.ScrollView, { style: s.modalBody, contentContainerStyle: { paddingBottom: 40 } }, doc.category && /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: s.metaRow }, /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: [s.tag, { backgroundColor: theme.colors.purpleSoft }] }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: { color: theme.colors.purple, fontSize: 11 } }, doc.category)), doc.updated_at && /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: { color: theme.colors.textMuted, fontSize: 12 } }, "Updated ", new Date(doc.updated_at).toLocaleDateString())), doc.content ? /* @__PURE__ */ import_react.default.createElement(RenderMarkdown, { content: doc.content, theme }) : loading ? /* @__PURE__ */ import_react.default.createElement(import_react_native.ActivityIndicator, { size: "small", color: theme.colors.accent, style: { marginTop: 24 } }) : /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: { color: theme.colors.textMuted, marginTop: 16, textAlign: "center" } }, "No content available")));
}
function RenderMarkdown({ content, theme }) {
  const lines = content.split("\n");
  const elements = [];
  let listItems = [];
  let codeBlock = "";
  let inCode = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("```")) {
      if (inCode) {
        elements.push(
          /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { key: `code-${i}`, style: [s.codeBlock, { backgroundColor: theme.colors.bg }] }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: { color: theme.colors.textSecondary, fontSize: 12, fontFamily: "Courier New" } }, codeBlock))
        );
        codeBlock = "";
        inCode = false;
      } else {
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      codeBlock += line + "\n";
      continue;
    }
    if (line.startsWith("## ")) {
      if (listItems.length > 0) {
        elements.push(
          /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { key: `list-${i}`, style: s.listContainer }, listItems.map((item, idx) => /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { key: idx, style: s.listItem }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: { color: theme.colors.accent, fontSize: 14, marginRight: 6 } }, "\u2022"), /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: { color: theme.colors.text, fontSize: 13, flex: 1, lineHeight: 18 } }, item.replace(/^[\s-*]+/, "")))))
        );
        listItems = [];
      }
      elements.push(
        /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { key: `h2-${i}`, style: [s.heading2, { color: theme.colors.text }] }, line.replace(/^#+\s+/, ""))
      );
      continue;
    }
    if (line.startsWith("# ")) {
      if (listItems.length > 0) {
        elements.push(
          /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { key: `list-${i}`, style: s.listContainer }, listItems.map((item, idx) => /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { key: idx, style: s.listItem }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: { color: theme.colors.accent, fontSize: 14, marginRight: 6 } }, "\u2022"), /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: { color: theme.colors.text, fontSize: 13, flex: 1, lineHeight: 18 } }, item.replace(/^[\s-*]+/, "")))))
        );
        listItems = [];
      }
      elements.push(
        /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { key: `h1-${i}`, style: [s.heading1, { color: theme.colors.text }] }, line.replace(/^#+\s+/, ""))
      );
      continue;
    }
    if (line.match(/^[\s-*]+\s/)) {
      listItems.push(line);
      continue;
    }
    if (line.trim() === "") {
      if (listItems.length > 0) {
        elements.push(
          /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { key: `list-${i}`, style: s.listContainer }, listItems.map((item, idx) => /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { key: idx, style: s.listItem }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: { color: theme.colors.accent, fontSize: 14, marginRight: 6 } }, "\u2022"), /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: { color: theme.colors.text, fontSize: 13, flex: 1, lineHeight: 18 } }, item.replace(/^[\s-*]+/, "")))))
        );
        listItems = [];
      }
      elements.push(/* @__PURE__ */ import_react.default.createElement(import_react_native.View, { key: `space-${i}`, style: { height: 8 } }));
      continue;
    }
    if (line.trim()) {
      if (listItems.length > 0) {
        elements.push(
          /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { key: `list-${i}`, style: s.listContainer }, listItems.map((item, idx) => /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { key: idx, style: s.listItem }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: { color: theme.colors.accent, fontSize: 14, marginRight: 6 } }, "\u2022"), /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: { color: theme.colors.text, fontSize: 13, flex: 1, lineHeight: 18 } }, item.replace(/^[\s-*]+/, "")))))
        );
        listItems = [];
      }
      elements.push(
        /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { key: `para-${i}`, style: { color: theme.colors.text, fontSize: 13, lineHeight: 20, marginBottom: 8 } }, line)
      );
    }
  }
  if (listItems.length > 0) {
    elements.push(
      /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { key: "list-final", style: s.listContainer }, listItems.map((item, idx) => /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { key: idx, style: s.listItem }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: { color: theme.colors.accent, fontSize: 14, marginRight: 6 } }, "\u2022"), /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: { color: theme.colors.text, fontSize: 13, flex: 1, lineHeight: 18 } }, item.replace(/^[\s-*]+/, "")))))
    );
  }
  return /* @__PURE__ */ import_react.default.createElement(import_react_native.View, null, elements);
}
var s = import_react_native.StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32 },
  retryBtn: { marginTop: 12, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  // Tab bar
  tabBar: { flexDirection: "row", borderBottomWidth: 1 },
  tab: { flex: 1, paddingVertical: 14, alignItems: "center", borderBottomWidth: 3, borderBottomColor: "transparent" },
  // Tasks — Kanban board (horizontal columns)
  kanbanColumn: { width: 280, paddingHorizontal: 12, paddingVertical: 0, borderRightWidth: 1, height: "100%" },
  columnHeader: { flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 8, gap: 6, borderBottomWidth: 1, borderBottomColor: "#333" },
  columnTitle: { fontSize: 14, fontWeight: "700", flex: 1 },
  columnCards: { paddingVertical: 8 },
  emptyColumn: { height: 100, justifyContent: "center", alignItems: "center" },
  kanbanTaskCard: { padding: 10, borderRadius: 10, borderWidth: 1, marginBottom: 8, minHeight: 110 },
  cardTitle: { fontSize: 13, fontWeight: "600", marginBottom: 6, lineHeight: 16 },
  cardTags: { flexDirection: "row", gap: 3, flexWrap: "wrap", marginBottom: 6 },
  cardAssignee: { fontSize: 10, fontWeight: "500" },
  miniTag: { paddingHorizontal: 4, paddingVertical: 1, borderRadius: 2 },
  sectionTitle: { fontSize: 15, fontWeight: "600", letterSpacing: 0.3 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  // Docs
  docList: { padding: 16 },
  docCard: { padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
  docHeader: { marginBottom: 8 },
  docCategory: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, marginBottom: 8 },
  docTitle: { fontSize: 16, fontWeight: "600", marginBottom: 8, lineHeight: 22 },
  docDate: { fontSize: 12, marginBottom: 8 },
  docTagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  // Modal
  modal: { flex: 1 },
  modalHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  modalTitle: { fontSize: 17, fontWeight: "600" },
  closeBtn: { marginLeft: 12, padding: 4 },
  modalBody: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  descSection: { paddingVertical: 12, marginTop: 12 },
  sectionLabel: { fontSize: 14, fontWeight: "600", marginBottom: 8 },
  heading1: { fontSize: 18, fontWeight: "700", marginBottom: 10, marginTop: 12 },
  heading2: { fontSize: 16, fontWeight: "600", marginBottom: 8, marginTop: 10 },
  codeBlock: { padding: 12, borderRadius: 8, marginVertical: 8, borderWidth: 1, borderColor: "#444" },
  listContainer: { marginVertical: 8 },
  listItem: { flexDirection: "row", marginBottom: 6, paddingLeft: 4 },
  commentsSection: { marginTop: 20 },
  commentsTitle: { fontSize: 15, fontWeight: "600", marginBottom: 12 },
  comment: { padding: 12, borderRadius: 8, borderWidth: 1, marginBottom: 8 },
  commentHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }
});
