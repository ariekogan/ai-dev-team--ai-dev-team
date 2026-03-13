/**
 * Dev Team Dashboard — Native Plugin
 *
 * A mobile-optimized dashboard that displays:
 * - Task board (grouped by status, with task detail modal)
 * - Knowledge base browser (doc list with content viewer)
 *
 * Data sources:
 * - task-board-mcp: tasks.list, tasks.get
 * - project-knowledge-mcp: knowledge.list_docs, knowledge.get_doc
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Modal,
  StyleSheet,
} from 'react-native';
import { PluginSDK, useApi } from '@adas/plugin-sdk';
import type { PluginProps, ThemeTokens } from '@adas/plugin-sdk';

// ── Data types ──────────────────────────────────────────────

interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  assignee?: string;
  priority?: string;
  tags?: string[];
  comments?: Array<{ author: string; text: string; created_at: string }>;
  created_at?: string;
  updated_at?: string;
}

interface Doc {
  id: string;
  title: string;
  category?: string;
  tags?: string[];
  content?: string;
  updated_at?: string;
}

const STATUS_ORDER = ['todo', 'in_progress', 'review', 'testing', 'done'];
const STATUS_LABELS: Record<string, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  review: 'Review',
  testing: 'Testing',
  done: 'Done',
};

// ── Priority badge colors ───────────────────────────────────

function priorityColor(priority: string | undefined, theme: ThemeTokens) {
  switch (priority) {
    case 'critical': return theme.colors.error;
    case 'high': return theme.colors.warning;
    case 'medium': return theme.colors.accent;
    case 'low': return theme.colors.textMuted;
    default: return theme.colors.textMuted;
  }
}

function statusColor(status: string, theme: ThemeTokens) {
  switch (status) {
    case 'done': return theme.colors.success;
    case 'in_progress': return theme.colors.accent;
    case 'review': return theme.colors.purple;
    case 'testing': return theme.colors.warning;
    case 'todo': return theme.colors.textMuted;
    default: return theme.colors.textMuted;
  }
}

// ── Main Component ──────────────────────────────────────────

export default PluginSDK.register('devteam-dashboard', {
  type: 'ui',
  capabilities: { haptics: true },

  Component({ bridge, native, theme }: PluginProps) {
    const api = useApi(bridge);
    const [tab, setTab] = useState<'tasks' | 'docs'>('tasks');
    const [tasks, setTasks] = useState<Task[]>([]);
    const [docs, setDocs] = useState<Doc[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Detail modals
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [selectedDoc, setSelectedDoc] = useState<Doc | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);

    // Fetch data from MCP connectors — using the simple useApi hook.
    // Uses a ref to avoid recreating the callback when `api` identity changes,
    // which would reset the auto-refresh interval and cause flicker.
    const apiRef = useRef(api);
    apiRef.current = api;

    const fetchData = useCallback(async (isRefresh = false) => {
      try {
        // Only show loading UI on initial load — background refreshes are silent.
        // No spinners, no flicker, data just appears updated.
        if (!isRefresh) {
          setLoading(true);
          setError(null);
        }

        const [taskRes, docRes] = await Promise.allSettled([
          apiRef.current('task-board-mcp', 'tasks.list', {}),
          apiRef.current('project-knowledge-mcp', 'knowledge.list_docs', {}),
        ]);

        // Silently update data — React batches these, so one re-render
        if (taskRes.status === 'fulfilled') {
          setTasks(taskRes.value?.tasks || []);
        }
        if (docRes.status === 'fulfilled') {
          setDocs(docRes.value?.docs || []);
        }

        // Only show error on initial load, not background refresh
        if (!isRefresh && taskRes.status === 'rejected' && docRes.status === 'rejected') {
          setError('Failed to load data. Check connectivity.');
        }
      } catch (err: any) {
        if (!isRefresh) setError(err.message);
      } finally {
        if (!isRefresh) setLoading(false);
        setRefreshing(false); // still needed for pull-to-refresh gesture
      }
    }, []); // stable — no deps, uses apiRef

    useEffect(() => { fetchData(); }, [fetchData]);

    // Auto-refresh every 30s
    useEffect(() => {
      const interval = setInterval(() => fetchData(true), 30000);
      return () => clearInterval(interval);
    }, [fetchData]);

    // Load full task with comments
    const openTask = useCallback(async (taskId: string) => {
      try {
        native.haptics.impact('light');
      } catch {}
      setDetailLoading(true);
      try {
        const full = await api('task-board-mcp', 'tasks.get', { id: taskId });
        setSelectedTask(full);
      } catch {
        const t = tasks.find(t => t.id === taskId);
        if (t) setSelectedTask(t);
      }
      setDetailLoading(false);
    }, [api, native, tasks]);

    // Load full doc content
    const openDoc = useCallback(async (docId: string) => {
      try {
        native.haptics.impact('light');
      } catch {}
      setDetailLoading(true);
      try {
        const full = await api('project-knowledge-mcp', 'knowledge.get_doc', { id: docId });
        setSelectedDoc(full);
      } catch {
        const d = docs.find(d => d.id === docId);
        if (d) setSelectedDoc(d);
      }
      setDetailLoading(false);
    }, [api, native, docs]);

    if (loading) {
      return (
        <View style={[s.center, { backgroundColor: theme.colors.bg }]}>
          <ActivityIndicator size="small" color={theme.colors.accent} />
          <Text style={{ color: theme.colors.textSecondary, marginTop: 8, fontSize: 14 }}>
            Loading dashboard...
          </Text>
        </View>
      );
    }

    if (error && tasks.length === 0 && docs.length === 0) {
      return (
        <View style={[s.center, { backgroundColor: theme.colors.bg }]}>
          <Text style={{ color: theme.colors.error, fontSize: 14, textAlign: 'center' }}>
            {error}
          </Text>
          <Pressable
            style={[s.retryBtn, { backgroundColor: theme.colors.accentSoft }]}
            onPress={() => fetchData()}
          >
            <Text style={{ color: theme.colors.accent, fontWeight: '600' }}>Retry</Text>
          </Pressable>
        </View>
      );
    }

    const tasksByStatus = (status: string) => tasks.filter(t => t.status === status);

    return (
      <View style={[s.container, { backgroundColor: theme.colors.bg }]}>
        {/* Tab bar */}
        <View style={[s.tabBar, { borderBottomColor: theme.colors.border }]}>
          {(['tasks', 'docs'] as const).map(t => (
            <Pressable
              key={t}
              style={[s.tab, tab === t && { borderBottomColor: theme.colors.accent }]}
              onPress={() => { setTab(t); try { native.haptics.selection(); } catch {} }}
            >
              <Text style={{
                color: tab === t ? theme.colors.accent : theme.colors.textSecondary,
                fontSize: 14,
                fontWeight: tab === t ? '600' : '400',
              }}>
                {t === 'tasks' ? `Tasks (${tasks.length})` : `Docs (${docs.length})`}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Tasks tab — Kanban board with horizontal columns */}
        {tab === 'tasks' && (
          <ScrollView
            horizontal
            nestedScrollEnabled={true}
            showsHorizontalScrollIndicator={true}
            scrollEventThrottle={16}
            contentContainerStyle={{ paddingVertical: 12 }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => fetchData(true)} tintColor={theme.colors.accent} />
            }
          >
            {STATUS_ORDER.map(status => {
              const statusTasks = tasksByStatus(status);
              return (
                <View
                  key={status}
                  style={[
                    s.kanbanColumn,
                    {
                      backgroundColor: theme.colors.bg,
                      borderRightColor: theme.colors.border,
                    },
                  ]}
                >
                  {/* Column header */}
                  <View style={s.columnHeader}>
                    <View style={[s.statusDot, { backgroundColor: statusColor(status, theme) }]} />
                    <Text style={[s.columnTitle, { color: theme.colors.text }]}>
                      {STATUS_LABELS[status]}
                    </Text>
                  </View>

                  {/* Cards container - scrollable vertically */}
                  <ScrollView
                    scrollEnabled={true}
                    nestedScrollEnabled={true}
                    contentContainerStyle={s.columnCards}
                    showsVerticalScrollIndicator={true}
                  >
                    {statusTasks.length === 0 ? (
                      <View style={s.emptyColumn}>
                        <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>No tasks</Text>
                      </View>
                    ) : (
                      statusTasks.map(task => (
                        <Pressable
                          key={task.id}
                          style={[
                            s.kanbanTaskCard,
                            {
                              backgroundColor: theme.colors.surface,
                              borderColor:
                                task.priority === 'critical'
                                  ? theme.colors.error
                                  : task.priority === 'high'
                                  ? theme.colors.warning
                                  : theme.colors.border,
                              borderLeftWidth: task.priority ? 3 : 1,
                            },
                          ]}
                          onPress={() => openTask(task.id)}
                        >
                          {/* Title */}
                          <Text style={[s.cardTitle, { color: theme.colors.text }]} numberOfLines={3}>
                            {task.title}
                          </Text>

                          {/* Tags */}
                          {task.tags && task.tags.length > 0 && (
                            <View style={s.cardTags}>
                              {task.tags.slice(0, 2).map(tag => (
                                <View key={tag} style={[s.miniTag, { backgroundColor: theme.colors.accentSoft }]}>
                                  <Text style={{ color: theme.colors.accent, fontSize: 8, fontWeight: '500' }}>
                                    {tag}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          )}

                          {/* Assignee */}
                          {task.assignee && (
                            <Text style={[s.cardAssignee, { color: theme.colors.textSecondary }]}>
                              {task.assignee}
                            </Text>
                          )}
                        </Pressable>
                      ))
                    )}
                  </ScrollView>
                </View>
              );
            })}
          </ScrollView>
        )}

        {/* Docs tab */}
        {tab === 'docs' && (
          <FlatList
            data={docs}
            keyExtractor={item => item.id}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => fetchData(true)} tintColor={theme.colors.accent} />
            }
            contentContainerStyle={s.docList}
            renderItem={({ item: doc }) => (
              <Pressable
                style={[
                  s.docCard,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                  },
                ]}
                onPress={() => openDoc(doc.id)}
              >
                <View style={s.docHeader}>
                  {doc.category && (
                    <View style={[s.docCategory, { backgroundColor: theme.colors.purpleSoft }]}>
                      <Text style={{ color: theme.colors.purple, fontSize: 12, fontWeight: '600' }}>
                        {doc.category.toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={[s.docTitle, { color: theme.colors.text }]} numberOfLines={2}>
                  {doc.title}
                </Text>
                {doc.updated_at && (
                  <Text style={[s.docDate, { color: theme.colors.textMuted }]}>
                    Updated {new Date(doc.updated_at).toLocaleDateString()}
                  </Text>
                )}
                {doc.tags && doc.tags.length > 0 && (
                  <View style={s.docTagRow}>
                    {doc.tags.slice(0, 3).map(tag => (
                      <View key={tag} style={[s.tag, { backgroundColor: theme.colors.accentSoft }]}>
                        <Text style={{ color: theme.colors.accent, fontSize: 10, fontWeight: '500' }}>
                          {tag}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </Pressable>
            )}
            ListEmptyComponent={
              <View style={s.center}>
                <Text style={{ color: theme.colors.textSecondary }}>No documents found</Text>
              </View>
            }
          />
        )}

        {/* Task detail modal */}
        <Modal visible={!!selectedTask} animationType="slide" presentationStyle="pageSheet">
          {selectedTask && (
            <TaskDetail
              task={selectedTask}
              theme={theme}
              loading={detailLoading}
              onClose={() => setSelectedTask(null)}
            />
          )}
        </Modal>

        {/* Doc detail modal */}
        <Modal visible={!!selectedDoc} animationType="slide" presentationStyle="pageSheet">
          {selectedDoc && (
            <DocDetail
              doc={selectedDoc}
              theme={theme}
              loading={detailLoading}
              onClose={() => setSelectedDoc(null)}
            />
          )}
        </Modal>
      </View>
    );
  },
});

// ── Task Detail ─────────────────────────────────────────────

function TaskDetail({ task, theme, loading, onClose }: {
  task: Task;
  theme: ThemeTokens;
  loading: boolean;
  onClose: () => void;
}) {
  return (
    <View style={[s.modal, { backgroundColor: theme.colors.bg }]}>
      <View style={[s.modalHeader, { borderBottomColor: theme.colors.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[s.modalTitle, { color: theme.colors.text }]} numberOfLines={2}>
            {task.title}
          </Text>
        </View>
        <Pressable style={s.closeBtn} onPress={onClose}>
          <Text style={{ color: theme.colors.textSecondary, fontSize: 16 }}>Done</Text>
        </Pressable>
      </View>
      <ScrollView style={s.modalBody} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Status & Priority */}
        <View style={s.metaRow}>
          <View style={[s.statusBadge, { backgroundColor: statusColor(task.status, theme) + '20' }]}>
            <Text style={{ color: statusColor(task.status, theme), fontSize: 12, fontWeight: '600' }}>
              {STATUS_LABELS[task.status] || task.status}
            </Text>
          </View>
          {task.priority && (
            <View style={[s.statusBadge, { backgroundColor: priorityColor(task.priority, theme) + '20' }]}>
              <Text style={{ color: priorityColor(task.priority, theme), fontSize: 12, fontWeight: '600' }}>
                {task.priority.toUpperCase()}
              </Text>
            </View>
          )}
          {task.assignee && (
            <Text style={{ color: theme.colors.textSecondary, fontSize: 13 }}>
              Assigned to {task.assignee}
            </Text>
          )}
        </View>

        {/* Description */}
        {task.description && (
          <View style={s.descSection}>
            <Text style={[s.sectionLabel, { color: theme.colors.text }]}>Description</Text>
            <RenderMarkdown content={task.description} theme={theme} />
          </View>
        )}

        {/* Tags */}
        {task.tags && task.tags.length > 0 && (
          <View style={s.tagRow}>
            {task.tags.map(tag => (
              <View key={tag} style={[s.tag, { backgroundColor: theme.colors.accentSoft }]}>
                <Text style={{ color: theme.colors.accent, fontSize: 11 }}>{tag}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Comments */}
        {task.comments && task.comments.length > 0 && (
          <View style={s.commentsSection}>
            <Text style={[s.commentsTitle, { color: theme.colors.text }]}>
              Comments ({task.comments.length})
            </Text>
            {task.comments.map((c, i) => (
              <View key={i} style={[s.comment, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <View style={s.commentHeader}>
                  <Text style={{ color: theme.colors.accent, fontSize: 12, fontWeight: '600' }}>
                    {c.author}
                  </Text>
                  {c.created_at && (
                    <Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>
                      {new Date(c.created_at).toLocaleDateString()}
                    </Text>
                  )}
                </View>
                <Text style={{ color: theme.colors.text, fontSize: 13, marginTop: 4, lineHeight: 18 }}>
                  {c.text}
                </Text>
              </View>
            ))}
          </View>
        )}

        {loading && (
          <ActivityIndicator size="small" color={theme.colors.accent} style={{ marginTop: 16 }} />
        )}
      </ScrollView>
    </View>
  );
}

// ── Doc Detail ──────────────────────────────────────────────

function DocDetail({ doc, theme, loading, onClose }: {
  doc: Doc;
  theme: ThemeTokens;
  loading: boolean;
  onClose: () => void;
}) {
  return (
    <View style={[s.modal, { backgroundColor: theme.colors.bg }]}>
      <View style={[s.modalHeader, { borderBottomColor: theme.colors.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[s.modalTitle, { color: theme.colors.text }]} numberOfLines={2}>
            {doc.title}
          </Text>
        </View>
        <Pressable style={s.closeBtn} onPress={onClose}>
          <Text style={{ color: theme.colors.textSecondary, fontSize: 16 }}>Done</Text>
        </Pressable>
      </View>
      <ScrollView style={s.modalBody} contentContainerStyle={{ paddingBottom: 40 }}>
        {doc.category && (
          <View style={s.metaRow}>
            <View style={[s.tag, { backgroundColor: theme.colors.purpleSoft }]}>
              <Text style={{ color: theme.colors.purple, fontSize: 11 }}>{doc.category}</Text>
            </View>
            {doc.updated_at && (
              <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
                Updated {new Date(doc.updated_at).toLocaleDateString()}
              </Text>
            )}
          </View>
        )}
        {doc.content ? (
          <RenderMarkdown content={doc.content} theme={theme} />
        ) : loading ? (
          <ActivityIndicator size="small" color={theme.colors.accent} style={{ marginTop: 24 }} />
        ) : (
          <Text style={{ color: theme.colors.textMuted, marginTop: 16, textAlign: 'center' }}>
            No content available
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

// ── Markdown Renderer ───────────────────────────────────

function RenderMarkdown({ content, theme }: { content: string; theme: ThemeTokens }) {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];

  let listItems: string[] = [];
  let codeBlock = '';
  let inCode = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code blocks
    if (line.startsWith('```')) {
      if (inCode) {
        elements.push(
          <View key={`code-${i}`} style={[s.codeBlock, { backgroundColor: theme.colors.bg }]}>
            <Text style={{ color: theme.colors.textSecondary, fontSize: 12, fontFamily: 'Courier New' }}>
              {codeBlock}
            </Text>
          </View>,
        );
        codeBlock = '';
        inCode = false;
      } else {
        inCode = true;
      }
      continue;
    }

    if (inCode) {
      codeBlock += line + '\n';
      continue;
    }

    // Headings
    if (line.startsWith('## ')) {
      if (listItems.length > 0) {
        elements.push(
          <View key={`list-${i}`} style={s.listContainer}>
            {listItems.map((item, idx) => (
              <View key={idx} style={s.listItem}>
                <Text style={{ color: theme.colors.accent, fontSize: 14, marginRight: 6 }}>•</Text>
                <Text style={{ color: theme.colors.text, fontSize: 13, flex: 1, lineHeight: 18 }}>
                  {item.replace(/^[\s-*]+/, '')}
                </Text>
              </View>
            ))}
          </View>,
        );
        listItems = [];
      }
      elements.push(
        <Text key={`h2-${i}`} style={[s.heading2, { color: theme.colors.text }]}>
          {line.replace(/^#+\s+/, '')}
        </Text>,
      );
      continue;
    }

    if (line.startsWith('# ')) {
      if (listItems.length > 0) {
        elements.push(
          <View key={`list-${i}`} style={s.listContainer}>
            {listItems.map((item, idx) => (
              <View key={idx} style={s.listItem}>
                <Text style={{ color: theme.colors.accent, fontSize: 14, marginRight: 6 }}>•</Text>
                <Text style={{ color: theme.colors.text, fontSize: 13, flex: 1, lineHeight: 18 }}>
                  {item.replace(/^[\s-*]+/, '')}
                </Text>
              </View>
            ))}
          </View>,
        );
        listItems = [];
      }
      elements.push(
        <Text key={`h1-${i}`} style={[s.heading1, { color: theme.colors.text }]}>
          {line.replace(/^#+\s+/, '')}
        </Text>,
      );
      continue;
    }

    // Bullet lists
    if (line.match(/^[\s-*]+\s/)) {
      listItems.push(line);
      continue;
    }

    // Empty lines
    if (line.trim() === '') {
      if (listItems.length > 0) {
        elements.push(
          <View key={`list-${i}`} style={s.listContainer}>
            {listItems.map((item, idx) => (
              <View key={idx} style={s.listItem}>
                <Text style={{ color: theme.colors.accent, fontSize: 14, marginRight: 6 }}>•</Text>
                <Text style={{ color: theme.colors.text, fontSize: 13, flex: 1, lineHeight: 18 }}>
                  {item.replace(/^[\s-*]+/, '')}
                </Text>
              </View>
            ))}
          </View>,
        );
        listItems = [];
      }
      elements.push(<View key={`space-${i}`} style={{ height: 8 }} />);
      continue;
    }

    // Regular paragraph
    if (line.trim()) {
      if (listItems.length > 0) {
        elements.push(
          <View key={`list-${i}`} style={s.listContainer}>
            {listItems.map((item, idx) => (
              <View key={idx} style={s.listItem}>
                <Text style={{ color: theme.colors.accent, fontSize: 14, marginRight: 6 }}>•</Text>
                <Text style={{ color: theme.colors.text, fontSize: 13, flex: 1, lineHeight: 18 }}>
                  {item.replace(/^[\s-*]+/, '')}
                </Text>
              </View>
            ))}
          </View>,
        );
        listItems = [];
      }
      elements.push(
        <Text key={`para-${i}`} style={{ color: theme.colors.text, fontSize: 13, lineHeight: 20, marginBottom: 8 }}>
          {line}
        </Text>,
      );
    }
  }

  // Handle remaining list items
  if (listItems.length > 0) {
    elements.push(
      <View key="list-final" style={s.listContainer}>
        {listItems.map((item, idx) => (
          <View key={idx} style={s.listItem}>
            <Text style={{ color: theme.colors.accent, fontSize: 14, marginRight: 6 }}>•</Text>
            <Text style={{ color: theme.colors.text, fontSize: 13, flex: 1, lineHeight: 18 }}>
              {item.replace(/^[\s-*]+/, '')}
            </Text>
          </View>
        ))}
      </View>,
    );
  }

  return <View>{elements}</View>;
}

// ── Styles ──────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  retryBtn: { marginTop: 12, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },

  // Tab bar
  tabBar: { flexDirection: 'row', borderBottomWidth: 1 },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },

  // Tasks — Kanban board (horizontal columns)
  kanbanColumn: { width: 280, paddingHorizontal: 12, paddingVertical: 0, borderRightWidth: 1, height: '100%' },
  columnHeader: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 8, gap: 6, borderBottomWidth: 1, borderBottomColor: '#333' },
  columnTitle: { fontSize: 14, fontWeight: '700', flex: 1 },
  columnCards: { paddingVertical: 8 },
  emptyColumn: { height: 100, justifyContent: 'center', alignItems: 'center' },

  kanbanTaskCard: { padding: 10, borderRadius: 10, borderWidth: 1, marginBottom: 8, minHeight: 110 },
  cardTitle: { fontSize: 13, fontWeight: '600', marginBottom: 6, lineHeight: 16 },
  cardTags: { flexDirection: 'row', gap: 3, flexWrap: 'wrap', marginBottom: 6 },
  cardAssignee: { fontSize: 10, fontWeight: '500' },
  miniTag: { paddingHorizontal: 4, paddingVertical: 1, borderRadius: 2 },

  sectionTitle: { fontSize: 15, fontWeight: '600', letterSpacing: 0.3 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },

  // Docs
  docList: { padding: 16 },
  docCard: { padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
  docHeader: { marginBottom: 8 },
  docCategory: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, marginBottom: 8 },
  docTitle: { fontSize: 16, fontWeight: '600', marginBottom: 8, lineHeight: 22 },
  docDate: { fontSize: 12, marginBottom: 8 },
  docTagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },

  // Modal
  modal: { flex: 1 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  modalTitle: { fontSize: 17, fontWeight: '600' },
  closeBtn: { marginLeft: 12, padding: 4 },
  modalBody: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  descSection: { paddingVertical: 12, marginTop: 12 },
  sectionLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  heading1: { fontSize: 18, fontWeight: '700', marginBottom: 10, marginTop: 12 },
  heading2: { fontSize: 16, fontWeight: '600', marginBottom: 8, marginTop: 10 },
  codeBlock: { padding: 12, borderRadius: 8, marginVertical: 8, borderWidth: 1, borderColor: '#444' },
  listContainer: { marginVertical: 8 },
  listItem: { flexDirection: 'row', marginBottom: 6, paddingLeft: 4 },

  commentsSection: { marginTop: 20 },
  commentsTitle: { fontSize: 15, fontWeight: '600', marginBottom: 12 },
  comment: { padding: 12, borderRadius: 8, borderWidth: 1, marginBottom: 8 },
  commentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
