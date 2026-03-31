import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FileText,
  Image,
  Paperclip,
  PenLine,
  Clock,
  Hash,
  FolderOpen,
  AlertCircle,
  Tag,
  BarChart3,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useProjectStore } from '@/stores/projectStore';
import { readFile, buildFileTree, openFileInEditor } from '@/hooks/useTauri';
import type { FileNode } from '@/types';
import YAML from 'yaml';
import { useEditorStore } from '@/stores/editorStore';

interface ContentStats {
  totalPosts: number;
  totalWords: number;
  draftPosts: DraftPost[];
  imageCount: number;
  attachmentCount: number;
  categories: Map<string, number>;
  tags: Map<string, number>;
  recentFiles: RecentFile[];
}

interface DraftPost {
  path: string;
  title: string;
  date?: string;
}

interface RecentFile {
  path: string;
  name: string;
  lastModified: number;
}

export function StatisticsPanel() {
  const { t } = useTranslation();
  const { currentProject, setSelectedFile } = useProjectStore();
  const { openFile } = useEditorStore();
  const [stats, setStats] = useState<ContentStats>({
    totalPosts: 0,
    totalWords: 0,
    draftPosts: [],
    imageCount: 0,
    attachmentCount: 0,
    categories: new Map(),
    tags: new Map(),
    recentFiles: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'drafts' | 'taxonomy'>('overview');

  const analyzeContent = async () => {
    if (!currentProject) return;

    try {
      setIsLoading(true);
      const contentPath = `${currentProject.path}/content`;
      const staticPath = `${currentProject.path}/static`;

      // Get file tree
      const fileTree = await buildFileTree(contentPath);

      let totalPosts = 0;
      let totalWords = 0;
      const draftPosts: DraftPost[] = [];
      const categories = new Map<string, number>();
      const tags = new Map<string, number>();
      const recentFiles: RecentFile[] = [];

      // Recursively analyze markdown files
      const analyzeNode = async (node: FileNode) => {
        if (node.file_type === 'directory' && node.children) {
          for (const child of node.children) {
            await analyzeNode(child);
          }
        } else if (node.file_type === 'file' && node.path.endsWith('.md')) {
          try {
            const content = await readFile(node.path);
            const fileName = node.path.split(/[/\\]/).pop() || '';

            // Parse frontmatter
            const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
            if (frontmatterMatch) {
              const frontmatterContent = frontmatterMatch[1];
              const bodyContent = frontmatterMatch[2] || '';

              let frontmatter: Record<string, unknown> = {};
              try {
                frontmatter = YAML.parse(frontmatterContent) || {};
              } catch {
                // Fallback: skip malformed frontmatter
              }

              // Count as post
              totalPosts++;

              // Count words (body only, excluding frontmatter)
              const words = bodyContent.trim().split(/\s+/).length;
              totalWords += words;

              // Check if draft
              if (frontmatter.draft === true || frontmatter.draft === 'true') {
                draftPosts.push({
                  path: node.path,
                  title: (frontmatter.title as string) || fileName.replace('.md', ''),
                  date: frontmatter.date as string,
                });
              }

              // Collect categories
              if (frontmatter.categories) {
                const cats = Array.isArray(frontmatter.categories)
                  ? frontmatter.categories
                  : [frontmatter.categories];
                cats.forEach((cat) => {
                  const catName = String(cat);
                  categories.set(catName, (categories.get(catName) || 0) + 1);
                });
              }

              // Collect tags
              if (frontmatter.tags) {
                const tagList = Array.isArray(frontmatter.tags)
                  ? frontmatter.tags
                  : [frontmatter.tags];
                tagList.forEach((tag) => {
                  const tagName = String(tag);
                  tags.set(tagName, (tags.get(tagName) || 0) + 1);
                });
              }

              // Track recent files (use a simple heuristic since we don't have fs.stat)
              // We'll use the file path as a proxy for now
              recentFiles.push({
                path: node.path,
                name: fileName,
                lastModified: Date.now(), // Placeholder, would need backend support
              });
            }
          } catch (err) {
            console.error('Failed to analyze file:', node.path, err);
          }
        }
      };

      for (const node of fileTree) {
        await analyzeNode(node);
      }

      // Get media counts from static directory
      let imageCount = 0;
      let attachmentCount = 0;

      try {
        const staticTree = await buildFileTree(staticPath);
        const countMedia = (node: FileNode) => {
          if (node.file_type === 'directory' && node.children) {
            for (const child of node.children) {
              countMedia(child);
            }
          } else if (node.file_type === 'file') {
            const ext = node.path.split('.').pop()?.toLowerCase();
            if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext || '')) {
              imageCount++;
            } else if (['pdf', 'doc', 'docx', 'zip', 'tar', 'gz'].includes(ext || '')) {
              attachmentCount++;
            }
          }
        };
        for (const node of staticTree) {
          countMedia(node);
        }
      } catch {
        // Static directory might not exist
      }

      // Sort drafts by date (newest first)
      draftPosts.sort((a, b) => {
        if (!a.date) return 1;
        if (!b.date) return -1;
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });

      // Sort recent files by path as a proxy (would need proper mtime from backend)
      recentFiles.sort((a, b) => b.path.localeCompare(a.path));

      setStats({
        totalPosts,
        totalWords,
        draftPosts,
        imageCount,
        attachmentCount,
        categories,
        tags,
        recentFiles: recentFiles.slice(0, 10),
      });
    } catch (err) {
      console.error('Failed to analyze content:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    analyzeContent();
  }, [currentProject]);

  const formatNumber = (num: number) => {
    if (num >= 10000) return `${(num / 10000).toFixed(1)}w`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return num.toString();
  };

  const formatWordCount = (count: number) => {
    if (count >= 10000) return `${(count / 10000).toFixed(1)} 万字`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)} 千字`;
    return `${count} 字`;
  };

  // Handle click on draft post to open in editor
  const handleDraftClick = async (path: string) => {
    if (!currentProject) return;

    try {
      const contentFile = await openFileInEditor(path, currentProject.path);
      // Update project store to show file as selected
      setSelectedFile(contentFile);
      // Open in editor store
      openFile(contentFile);
    } catch (err) {
      console.error('Failed to open draft:', err);
    }
  };

  if (!currentProject) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>{t('stats.noProject', '请先打开一个项目')}</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          {t('stats.title', '站点统计')}
        </h3>
        <Badge variant="secondary" className="text-xs">
          {currentProject.name}
        </Badge>
      </div>

      {/* Tabs */}
      <div className="flex border-b">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
            activeTab === 'overview'
              ? 'bg-accent text-accent-foreground'
              : 'hover:bg-muted'
          }`}
        >
          {t('stats.overview', '概览')}
        </button>
        <button
          onClick={() => setActiveTab('drafts')}
          className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
            activeTab === 'drafts'
              ? 'bg-accent text-accent-foreground'
              : 'hover:bg-muted'
          }`}
        >
          {t('stats.drafts', '草稿')}
          {stats.draftPosts.length > 0 && (
            <span className="ml-1 text-xs text-muted-foreground">
              ({stats.draftPosts.length})
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('taxonomy')}
          className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
            activeTab === 'taxonomy'
              ? 'bg-accent text-accent-foreground'
              : 'hover:bg-muted'
          }`}
        >
          {t('stats.taxonomy', '分类/标签')}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'overview' && (
          <ScrollArea className="h-full">
            <div className="p-4 space-y-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <FileText className="h-4 w-4" />
                    <span className="text-xs">{t('stats.posts', '文章')}</span>
                  </div>
                  <div className="text-2xl font-bold">{formatNumber(stats.totalPosts)}</div>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <PenLine className="h-4 w-4" />
                    <span className="text-xs">{t('stats.words', '字数')}</span>
                  </div>
                  <div className="text-2xl font-bold">{formatWordCount(stats.totalWords)}</div>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Image className="h-4 w-4" />
                    <span className="text-xs">{t('stats.images', '图片')}</span>
                  </div>
                  <div className="text-2xl font-bold">{formatNumber(stats.imageCount)}</div>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Paperclip className="h-4 w-4" />
                    <span className="text-xs">{t('stats.attachments', '附件')}</span>
                  </div>
                  <div className="text-2xl font-bold">{formatNumber(stats.attachmentCount)}</div>
                </div>
              </div>

              <Separator />

              {/* Drafts Summary */}
              {stats.draftPosts.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-500" />
                    {t('stats.draftsPending', '待发布的草稿')}
                    <Badge variant="secondary" className="ml-auto">
                      {stats.draftPosts.length}
                    </Badge>
                  </h4>
                  <div className="space-y-1">
                    {stats.draftPosts.slice(0, 3).map((draft) => (
                      <div
                        key={draft.path}
                        onClick={() => handleDraftClick(draft.path)}
                        className="text-sm p-2 rounded hover:bg-accent truncate cursor-pointer"
                        title={draft.title}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            handleDraftClick(draft.path);
                          }
                        }}
                      >
                        {draft.title}
                      </div>
                    ))}
                    {stats.draftPosts.length > 3 && (
                      <div className="text-xs text-muted-foreground text-center py-1">
                        {t('stats.moreDrafts', '还有 {{count}} 篇草稿', { count: stats.draftPosts.length - 3 })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <Separator />

              {/* Quick Stats */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium">{t('stats.quickStats', '快速统计')}</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('stats.categories', '分类')}</span>
                    <span className="font-medium">{stats.categories.size}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('stats.tags', '标签')}</span>
                    <span className="font-medium">{stats.tags.size}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('stats.avgWords', '平均字数')}</span>
                    <span className="font-medium">
                      {stats.totalPosts > 0 ? Math.round(stats.totalWords / stats.totalPosts) : 0} 字
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        )}

        {activeTab === 'drafts' && (
          <ScrollArea className="h-full">
            <div className="p-3">
              {stats.draftPosts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">{t('stats.noDrafts', '没有草稿文章')}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {stats.draftPosts.map((draft) => (
                    <div
                      key={draft.path}
                      onClick={() => handleDraftClick(draft.path)}
                      className="p-3 rounded-lg border hover:bg-accent/50 cursor-pointer transition-colors"
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          handleDraftClick(draft.path);
                        }
                      }}
                    >
                      <div className="flex items-start gap-2">
                        <PenLine className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate" title={draft.title}>
                            {draft.title}
                          </div>
                          {draft.date && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {new Date(draft.date).toLocaleDateString('zh-CN')}
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground truncate mt-1">
                            {draft.path.split(/[/\\]/).pop()}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        {activeTab === 'taxonomy' && (
          <ScrollArea className="h-full">
            <div className="p-3 space-y-4">
              {/* Categories */}
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <FolderOpen className="h-4 w-4" />
                  {t('stats.categories', '分类')}
                  <span className="text-xs text-muted-foreground ml-auto">
                    {stats.categories.size} 个
                  </span>
                </h4>
                {stats.categories.size === 0 ? (
                  <div className="text-xs text-muted-foreground py-2">
                    {t('stats.noCategories', '暂无分类')}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {Array.from(stats.categories.entries())
                      .sort((a, b) => b[1] - a[1])
                      .map(([name, count]) => (
                        <Badge
                          key={name}
                          variant="secondary"
                          className="text-xs cursor-default hover:bg-accent"
                          title={`${name}: ${count} 篇文章`}
                        >
                          {name}
                          <span className="ml-1 text-muted-foreground">({count})</span>
                        </Badge>
                      ))}
                  </div>
                )}
              </div>

              <Separator />

              {/* Tags */}
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Tag className="h-4 w-4" />
                  {t('stats.tags', '标签')}
                  <span className="text-xs text-muted-foreground ml-auto">
                    {stats.tags.size} 个
                  </span>
                </h4>
                {stats.tags.size === 0 ? (
                  <div className="text-xs text-muted-foreground py-2">
                    {t('stats.noTags', '暂无标签')}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {Array.from(stats.tags.entries())
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 50)
                      .map(([name, count]) => (
                        <Badge
                          key={name}
                          variant="outline"
                          className="text-xs cursor-default hover:bg-accent"
                          style={{
                            fontSize: count > 5 ? '0.875rem' : count > 2 ? '0.75rem' : '0.625rem',
                            opacity: count > 5 ? 1 : count > 2 ? 0.8 : 0.6,
                          }}
                          title={`${name}: ${count} 篇文章`}
                        >
                          {name}
                          <span className="ml-1 text-muted-foreground">({count})</span>
                        </Badge>
                      ))}
                    {stats.tags.size > 50 && (
                      <Badge variant="outline" className="text-xs">
                        +{stats.tags.size - 50} more
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
