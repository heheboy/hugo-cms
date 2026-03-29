import { useEffect } from 'react';

export function usePreventReload() {
  useEffect(() => {
    // 阻止 F5 / Ctrl+R / Cmd+R
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F5' || ((e.ctrlKey || e.metaKey) && e.key === 'r')) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    // 阻止默认右键菜单（但放行标记了自定义右键菜单的区域）
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // 放行标记了自定义右键菜单的区域
      const hasCustomMenu = target.closest('[data-custom-context-menu]');
      // 放行 Monaco Editor（它有自己的右键菜单）
      const isInEditor = target.closest('.monaco-editor');

      if (!hasCustomMenu && !isInEditor) {
        e.preventDefault();
        return false;
      }
    };

    // 在捕获阶段拦截，确保最先处理
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('contextmenu', handleContextMenu, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('contextmenu', handleContextMenu, true);
    };
  }, []);
}
