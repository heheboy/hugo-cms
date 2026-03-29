// @ts-nocheck
import { useState, useEffect, useCallback, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { invoke } from '@tauri-apps/api/core';
import remarkGfm from 'remark-gfm';
import remarkEmoji from 'remark-emoji';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/vs2015.css';
import { Loader2 } from 'lucide-react';

interface MarkdownPreviewProps {
  content: string;
  projectPath?: string;
}

// Global cache for image base64 URLs
const imageCache = new Map<string, string>();

// Async image component that loads base64 on demand
interface AsyncImageProps {
  src: string;
  alt?: string;
  projectPath?: string;
}

function AsyncImage({ src, alt, projectPath }: AsyncImageProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attemptedPath, setAttemptedPath] = useState<string>('');

  useEffect(() => {
    let cancelled = false;

    const loadImage = async () => {
      // Check cache first
      if (imageCache.has(src)) {
        if (!cancelled) {
          setImageUrl(imageCache.get(src)!);
          setLoading(false);
        }
        return;
      }

      // Skip external URLs
      if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) {
        if (!cancelled) {
          setImageUrl(src);
          setLoading(false);
        }
        return;
      }

      if (!projectPath) {
        if (!cancelled) {
          setError('No project path');
          setLoading(false);
        }
        return;
      }

      // Resolve path - decode URL encoded characters
      const normalizedSrc = decodeURIComponent(src).replace(/\\/g, '/');
      let absolutePath: string;

      if (normalizedSrc.startsWith('/')) {
        absolutePath = `${projectPath}\\static${normalizedSrc.replace(/\//g, '\\')}`;
      } else {
        absolutePath = `${projectPath}\\static\\${normalizedSrc.replace(/\//g, '\\')}`;
      }

      if (!cancelled) {
        setAttemptedPath(absolutePath);
      }

      console.log('[AsyncImage] Loading image:', { src, absolutePath, projectPath });

      try {
        const base64Url = await invoke<string>('read_image_base64', { filePath: absolutePath });
        if (!cancelled) {
          imageCache.set(src, base64Url);
          setImageUrl(base64Url);
          setLoading(false);
        }
      } catch (err: any) {
        console.error('[AsyncImage] Failed to load:', src, err);
        if (!cancelled) {
          setError(err?.toString?.() || 'Unknown error');
          setLoading(false);
        }
      }
    };

    loadImage();

    return () => {
      cancelled = true;
    };
  }, [src, projectPath]);

  if (loading) {
    return (
      <div className="inline-flex items-center gap-2 border border-dashed border-gray-300 rounded p-2 text-gray-400 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>加载中...</span>
      </div>
    );
  }

  if (error || !imageUrl) {
    return (
      <div className="inline-block border border-dashed border-red-300 rounded p-2 text-red-400 text-sm max-w-md">
        <div>[图片加载失败: {src}]</div>
        {error && <div className="text-xs text-red-300 mt-1">错误: {error}</div>}
        {attemptedPath && <div className="text-xs text-gray-400 mt-1">路径: {attemptedPath}</div>}
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={alt}
      className="max-w-full h-auto rounded-lg shadow-md"
      loading="lazy"
      onError={(e) => {
        console.error('Image onError:', src);
        e.currentTarget.style.display = 'none';
      }}
    />
  );
}

export function MarkdownPreview({ content, projectPath }: MarkdownPreviewProps) {
  const [parsedContent, setParsedContent] = useState(content);
  const parseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Parse content to extract body (remove frontmatter if present)
  const parseContent = useCallback((rawContent: string): string => {
    const frontmatterMatch = rawContent.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    if (frontmatterMatch) {
      return frontmatterMatch[2] || '';
    }
    return rawContent;
  }, []);

  // Debounced content parsing
  useEffect(() => {
    if (parseTimeoutRef.current) {
      clearTimeout(parseTimeoutRef.current);
    }

    parseTimeoutRef.current = setTimeout(() => {
      setParsedContent(parseContent(content));
    }, 1000); // 1 second debounce

    return () => {
      if (parseTimeoutRef.current) {
        clearTimeout(parseTimeoutRef.current);
      }
    };
  }, [content, parseContent]);

  return (
    <div className="markdown-preview h-full overflow-auto bg-white p-6">
      <div className="prose prose-slate max-w-none">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkEmoji]}
          rehypePlugins={[rehypeHighlight]}
          components={{
            // 自定义代码块渲染
            code({ node, inline, className, children, ...props }: any) {
              const match = /language-(\w+)/.exec(className || '');
              return !inline && match ? (
                <div className="relative">
                  <div className="absolute top-0 right-0 px-2 py-1 text-xs text-gray-400 bg-gray-800 rounded-bl">
                    {match[1]}
                  </div>
                  <pre className="!mt-0 !bg-gray-900">
                    <code className={className} {...props}>
                      {children}
                    </code>
                  </pre>
                </div>
              ) : (
                <code className="bg-gray-100 px-1 py-0.5 rounded text-sm" {...props}>
                  {children}
                </code>
              );
            },
            // 自定义表格渲染
            table({ children }: any) {
              return (
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse border border-gray-300">
                    {children}
                  </table>
                </div>
              );
            },
            th({ children }: any) {
              return (
                <th className="border border-gray-300 px-4 py-2 bg-gray-100 font-semibold">
                  {children}
                </th>
              );
            },
            td({ children }: any) {
              return (
                <td className="border border-gray-300 px-4 py-2">
                  {children}
                </td>
              );
            },
            // 自定义链接渲染
            a({ children, href }: any) {
              return (
                <a
                  href={href}
                  className="text-blue-600 hover:text-blue-800 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {children}
                </a>
              );
            },
            // 自定义图片渲染 - 使用异步组件
            img({ src, alt }: any) {
              return (
                <AsyncImage
                  src={src}
                  alt={alt}
                  projectPath={projectPath}
                />
              );
            },
            // 自定义引用块
            blockquote({ children }: any) {
              return (
                <blockquote className="border-l-4 border-blue-500 pl-4 italic text-gray-700 bg-blue-50 py-2 pr-4 rounded-r">
                  {children}
                </blockquote>
              );
            },
          }}
        >
          {parsedContent}
        </ReactMarkdown>
      </div>
    </div>
  );
}

export default MarkdownPreview;
