import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bold,
  Italic,
  Heading,
  Quote,
  Code,
  List,
  ListOrdered,
  Link,
  Image,
  Table,
  Minus,
  Paperclip,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface MarkdownToolbarProps {
  editorRef: React.RefObject<any>;
  onInsertImage: () => void;
  onInsertAttachment: () => void;
}

interface ToolbarItem {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  action: () => void;
}

export function MarkdownToolbar({ editorRef, onInsertImage, onInsertAttachment }: MarkdownToolbarProps) {
  const { t } = useTranslation();

  const getSelectedText = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return { text: '', selection: null };

    const selection = editor.getSelection();
    if (!selection) return { text: '', selection: null };

    const model = editor.getModel();
    const text = model.getValueInRange(selection);
    return { text, selection };
  }, [editorRef]);

  const insertText = useCallback((before: string, after: string = '') => {
    const editor = editorRef.current;
    if (!editor) return;

    const { text, selection } = getSelectedText();

    if (selection) {
      // If text is selected, wrap it with the markers
      const newText = before + text + after;
      editor.executeEdits('toolbar', [
        {
          range: selection,
          text: newText,
        },
      ]);

      // If no text was selected, position cursor inside the markers
      if (!text) {
        const newPosition = selection.getStartPosition();
        editor.setPosition({
          lineNumber: newPosition.lineNumber,
          column: newPosition.column + before.length,
        });
      }
    } else {
      // No selection, just insert at cursor
      const position = editor.getPosition();
      if (position) {
        editor.executeEdits('toolbar', [
          {
            range: {
              startLineNumber: position.lineNumber,
              startColumn: position.column,
              endLineNumber: position.lineNumber,
              endColumn: position.column,
            },
            text: before + after,
          },
        ]);
        editor.setPosition({
          lineNumber: position.lineNumber,
          column: position.column + before.length,
        });
      }
    }

    editor.focus();
  }, [editorRef, getSelectedText]);

  const insertLine = useCallback((text: string) => {
    const editor = editorRef.current;
    if (!editor) return;

    const { text: selectedText, selection } = getSelectedText();

    if (selection) {
      if (selectedText) {
        // If text is selected, replace with the template
        editor.executeEdits('toolbar', [
          {
            range: selection,
            text: text,
          },
        ]);
      } else {
        // No selection, insert at cursor
        editor.executeEdits('toolbar', [
          {
            range: selection,
            text: text,
          },
        ]);
      }
    } else {
      const position = editor.getPosition();
      if (position) {
        editor.executeEdits('toolbar', [
          {
            range: {
              startLineNumber: position.lineNumber,
              startColumn: position.column,
              endLineNumber: position.lineNumber,
              endColumn: position.column,
            },
            text: text,
          },
        ]);
      }
    }

    editor.focus();
  }, [editorRef, getSelectedText]);

  const toolbarItems: ToolbarItem[] = [
    {
      icon: <Bold className="h-4 w-4" />,
      label: t('editor.toolbar.bold', '加粗'),
      shortcut: 'Ctrl+B',
      action: () => insertText('**', '**'),
    },
    {
      icon: <Italic className="h-4 w-4" />,
      label: t('editor.toolbar.italic', '斜体'),
      shortcut: 'Ctrl+I',
      action: () => insertText('*', '*'),
    },
    {
      icon: <Heading className="h-4 w-4" />,
      label: t('editor.toolbar.heading', '标题'),
      shortcut: 'Ctrl+H',
      action: () => insertLine('## 标题'),
    },
    {
      icon: <Quote className="h-4 w-4" />,
      label: t('editor.toolbar.quote', '引用'),
      action: () => insertLine('> 引用文本'),
    },
    {
      icon: <Code className="h-4 w-4" />,
      label: t('editor.toolbar.code', '代码块'),
      action: () => insertText('```\n', '\n```'),
    },
    {
      icon: <List className="h-4 w-4" />,
      label: t('editor.toolbar.ul', '无序列表'),
      action: () => insertLine('- 列表项'),
    },
    {
      icon: <ListOrdered className="h-4 w-4" />,
      label: t('editor.toolbar.ol', '有序列表'),
      action: () => insertLine('1. 列表项'),
    },
    {
      icon: <Link className="h-4 w-4" />,
      label: t('editor.toolbar.link', '链接'),
      shortcut: 'Ctrl+K',
      action: () => insertText('[链接文本](', ')'),
    },
    {
      icon: <Image className="h-4 w-4" />,
      label: t('editor.toolbar.image', '图片'),
      action: onInsertImage,
    },
    {
      icon: <Paperclip className="h-4 w-4" />,
      label: t('editor.toolbar.attachment', '附件'),
      action: onInsertAttachment,
    },
    {
      icon: <Table className="h-4 w-4" />,
      label: t('editor.toolbar.table', '表格'),
      action: () => insertLine('| 列1 | 列2 | 列3 |\n|-----|-----|-----|\n| 内容 | 内容 | 内容 |'),
    },
    {
      icon: <Minus className="h-4 w-4" />,
      label: t('editor.toolbar.hr', '分隔线'),
      action: () => insertLine('---'),
    },
  ];

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center gap-1 px-2 py-1.5 border-b bg-muted/30">
        {toolbarItems.map((item, index) => (
          <Tooltip key={index}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={item.action}
              >
                {item.icon}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <div className="flex items-center gap-2">
                <span>{item.label}</span>
                {item.shortcut && (
                  <kbd className="text-xs bg-muted px-1.5 py-0.5 rounded">
                    {item.shortcut}
                  </kbd>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
