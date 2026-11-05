/**
 * 随手记 quick-notes · Client half
 *
 * 三个入口：
 *   1. 侧栏面板「随手记」：速记框 + 按天分组的时间线 + 搜索 + 删除
 *   2. 快捷键 ⌘⇧N 唤起居中速记浮层（任意页面，含输入框聚焦时）
 *   3. 文件本身：~/Documents/随手记/YYYY-MM-DD.md
 *
 * 只依赖宿主提供的 slots / locale 服务，不 require 任何 dsh-client-* 原语。
 */

window.__ModuleLoader__.load({
  id: '@yanghx/dsh-quick-notes',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useState, useEffect, useRef, useCallback, useMemo } = React;

    const NS = 'quick-notes';
    const API = '/api/quick-notes';
    const SHORTCUT_ID = 'quick-notes.capture';

    const DICT = {
      zh: {
        title: '随手记',
        search: '搜索记录',
        placeholder: '想到什么，随手记下…',
        'hint.save': '⏎ 保存',
        'hint.newline': '⇧⏎ 换行',
        'hint.esc': 'Esc 关闭',
        save: '记下',
        saving: '保存中…',
        saved: '已记下',
        today: '今天',
        yesterday: '昨天',
        'unit.note': '条',
        'summary.today': '今天 {count} 条',
        empty: '还没有记录',
        'empty.hint': '想到什么，按快捷键记一笔。',
        'empty.search': '没有匹配的记录',
        loadMore: '加载更早',
        loading: '读取中…',
        retry: '重试',
        copy: '复制',
        copied: '已复制',
        delete: '删除',
        'delete.confirm': '确认删除？',
        confirm: '确认',
        cancel: '取消',
        close: '关闭',
        settings: '设置',
        'settings.path': '保存位置',
        'settings.pathHint': '每天一个 Markdown 文件，文件名就是日期。',
        'settings.choose': '选择文件夹',
        'settings.reveal': '在 Finder 中显示',
        'settings.openToday': '打开今天的文件',
        'settings.reset': '恢复默认',
        'settings.shortcut': '快捷键',
        'settings.shortcutHint': '可在 设置 → 快捷键 里修改',
        'settings.apply': '保存路径',
        'settings.applied': '路径已更新',
        'settings.copyPath': '复制路径',
        'settings.notebooks': '笔记本',
        'settings.currentVault': '当前笔记本',
        'settings.addNotebook': '添加笔记本',
        'notebook': '笔记本',
        'notebook.current': '当前',
        'notebook.setCurrent': '设为当前',
        'notebook.added': '笔记本已添加',
        'notebook.rename': '重命名',
        'notebook.renamed': '已重命名',
        'notebook.remove': '移除',
        'notebook.removed': '已移除（文件保留在原处）',
        'notebook.removeConfirm': '只解除关联，不会删除文件。确认移除？',
        'notebook.namePlaceholder': '名字，如：工作',
        'notebook.noPath': '先选择文件夹',
        'notebook.lastOne': '至少要保留一个笔记本',
        'notebook.duplicate': '已有同名笔记本',
        'notebook.nameRequired': '名字不能为空',
        'notebook.activeChanged': '已切换到「{name}」',
        'notebook.to': '写入「{name}」',
        'footer.saveAt': '保存于',
        'footer.change': '修改',
        'error.host': '宿主端没有响应，试试重启 DeepSeek Harness。',
        'error.title': '出了点问题',
        'notify.deleted': '已删除',
        'notify.failed': '没成功：{message}',
        'search.clear': '清空',
      },
      en: {
        title: 'Quick Notes',
        search: 'Search notes',
        placeholder: 'Catch it before it slips…',
        'hint.save': '⏎ save',
        'hint.newline': '⇧⏎ new line',
        'hint.esc': 'Esc close',
        save: 'Save',
        saving: 'Saving…',
        saved: 'Saved',
        today: 'Today',
        yesterday: 'Yesterday',
        'unit.note': 'notes',
        'summary.today': 'Today {count}',
        empty: 'Nothing here yet',
        'empty.hint': 'When something comes to mind, hit the shortcut.',
        'empty.search': 'No matching notes',
        loadMore: 'Load earlier',
        loading: 'Loading…',
        retry: 'Retry',
        copy: 'Copy',
        copied: 'Copied',
        delete: 'Delete',
        'delete.confirm': 'Delete this note?',
        confirm: 'Confirm',
        cancel: 'Cancel',
        close: 'Close',
        settings: 'Settings',
        'settings.path': 'Save location',
        'settings.pathHint': 'One Markdown file per day, named after the date.',
        'settings.choose': 'Choose folder',
        'settings.reveal': 'Reveal in Finder',
        'settings.openToday': "Open today's file",
        'settings.reset': 'Use default',
        'settings.shortcut': 'Shortcut',
        'settings.shortcutHint': 'Change it in Settings → Shortcuts',
        'settings.apply': 'Save path',
        'settings.applied': 'Path updated',
        'settings.copyPath': 'Copy path',
        'settings.notebooks': 'Notebooks',
        'settings.currentVault': 'Current notebook',
        'settings.addNotebook': 'Add notebook',
        'notebook': 'Notebook',
        'notebook.current': 'Current',
        'notebook.setCurrent': 'Set current',
        'notebook.added': 'Notebook added',
        'notebook.rename': 'Rename',
        'notebook.renamed': 'Renamed',
        'notebook.remove': 'Remove',
        'notebook.removed': 'Removed (files stay where they are)',
        'notebook.removeConfirm': 'This only unlinks the folder, it will not delete files. Remove?',
        'notebook.namePlaceholder': 'Name, e.g. Work',
        'notebook.noPath': 'Pick a folder first',
        'notebook.lastOne': 'Keep at least one notebook',
        'notebook.duplicate': 'A notebook with that name exists',
        'notebook.nameRequired': 'Name is required',
        'notebook.activeChanged': 'Switched to "{name}"',
        'notebook.to': 'Saving to "{name}"',
        'footer.saveAt': 'Saved in',
        'footer.change': 'change',
        'error.host': 'The host side is not responding. Try restarting DeepSeek Harness.',
        'error.title': 'Something went wrong',
        'notify.deleted': 'Deleted',
        'notify.failed': 'Failed: {message}',
        'search.clear': 'Clear',
      },
    };

    // ------------------------------------------------------------------
    // 小工具
    // ------------------------------------------------------------------

    function createStore(initial) {
      let state = initial;
      const listeners = new Set();
      return {
        get: () => state,
        set(patch) {
          state = Object.assign({}, state, typeof patch === 'function' ? patch(state) : patch);
          for (const fn of listeners) fn(state);
        },
        subscribe(fn) {
          listeners.add(fn);
          return () => listeners.delete(fn);
        },
      };
    }

    const captureStore = createStore({ open: false, seq: 0 });
    const versionStore = createStore({ v: 0 });
    const toastStore = createStore({ message: '', key: 0, tone: 'ok' });
    const activeNameStore = createStore({ name: '' });
    let toastTimer = null;

    function toast(message, tone) {
      toastStore.set({ message, tone: tone ?? 'ok', key: Date.now() });
      if (toastTimer !== null) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toastStore.set({ message: '' }), 1800);
    }

    let openCapture = null;

    async function api(pathname, options) {
      const headers = { 'x-dsh-quick-notes': '1' };
      const opts = options ? Object.assign({}, options) : undefined;
      let url = `${API}${pathname}`;
      if (opts && opts.vault !== undefined && opts.vault !== '') {
        const v = opts.vault;
        if (opts.body !== undefined) {
          // JSON body：把 vault 合并进去
          let body = opts.body;
          if (typeof body === 'string') {
            try {
              body = JSON.parse(body);
            } catch {
              body = {};
            }
          }
          body = Object.assign({}, body, { vault: v });
          opts.body = JSON.stringify(body);
          headers['content-type'] = 'application/json';
        } else {
          // GET 查询串
          url += `${url.indexOf('?') === -1 ? '?' : '&'}vault=${encodeURIComponent(v)}`;
        }
        delete opts.vault;
      }
      if (opts && opts.body !== undefined) headers['content-type'] = headers['content-type'] ?? 'application/json';
      let res;
      try {
        res = await fetch(url, Object.assign({}, opts, { headers }));
      } catch (error) {
        throw new Error(runtime.t('error.host'));
      }
      let data = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }
      if (!res.ok) throw new Error((data && data.error) || `HTTP ${res.status}`);
      return data;
    }

    function pad(n) {
      return String(n).padStart(2, '0');
    }

    function localDate(d) {
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    }

    function isZh() {
      const lang = (typeof navigator !== 'undefined' && navigator.language) || 'zh';
      return lang.toLowerCase().indexOf('zh') === 0;
    }

    function dayLabel(date, weekday, t) {
      const today = new Date();
      const todayStr = localDate(today);
      const yesterday = new Date(today.getTime() - 86400000);
      if (date === todayStr) return t('today');
      if (date === localDate(yesterday)) return t('yesterday');
      const [y, m, d] = date.split('-').map(Number);
      if (isZh()) return `${m}月${d}日 · ${weekday}`;
      try {
        const label = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(y, m - 1, d, 12));
        return `${label} · ${weekday}`;
      } catch {
        return date;
      }
    }

    function Icon(props) {
      const size = props.size || 16;
      return h(
        'svg',
        {
          viewBox: '0 0 24 24',
          width: size,
          height: size,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.7,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
          focusable: 'false',
        },
        props.paths.map((d, i) => h('path', { key: i, d })),
      );
    }

    function NotesIcon() {
      return h(
        'svg',
        {
          viewBox: '0 0 24 24',
          width: 18,
          height: 18,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.6,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
          focusable: 'false',
        },
        h('path', { d: 'M7.5 3.75h9a1.75 1.75 0 0 1 1.75 1.75v13a1.75 1.75 0 0 1-1.75 1.75h-9A1.75 1.75 0 0 1 5.75 18.5v-13A1.75 1.75 0 0 1 7.5 3.75Z' }),
        h('path', { d: 'M9 8.25h6M9 11.75h6M9 15.25h3.25' }),
        h('circle', { cx: 16.4, cy: 15.4, r: 1.15, fill: 'currentColor', stroke: 'none', opacity: 0.55 }),
      );
    }

    // ------------------------------------------------------------------
    // 样式（注入一次，随插件卸载移除）
    // ------------------------------------------------------------------

    const STYLE_ID = 'quick-notes-style';
    const CSS = `
.qn-root,.qn-root *{box-sizing:border-box}
.qn-root{height:100%;overflow-y:auto;padding:14px 20px 60px;color:var(--dsw-alias-label-primary);font-size:13px;line-height:1.65;scrollbar-width:thin}
.qn-root::-webkit-scrollbar{width:10px}
.qn-root::-webkit-scrollbar-thumb{background:var(--dsw-alias-border-l2);border-radius:8px;border:3px solid transparent;background-clip:content-box}
.qn-head{position:sticky;top:0;z-index:5;display:flex;align-items:center;gap:10px;padding:10px 0 12px;background:linear-gradient(to bottom,var(--dsw-alias-bg-layer-1) 72%,transparent)}
.qn-title{font-size:15px;font-weight:600;letter-spacing:.2px;margin:0;flex:none}
.qn-sub{font-size:11.5px;color:var(--dsw-alias-label-tertiary);flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.qn-tools{display:flex;align-items:center;gap:6px;flex:none}
.qn-search{display:flex;align-items:center;gap:6px;height:28px;padding:0 9px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-tertiary);transition:border-color .15s}
.qn-search:focus-within{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-secondary)}
.qn-search input{width:92px;border:0;outline:0;background:transparent;color:var(--dsw-alias-label-primary);font-size:12px;font-family:inherit}
.qn-search input::placeholder{color:var(--dsw-alias-label-tertiary)}
.qn-iconbtn{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;padding:0;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;transition:background .12s,color .12s}
.qn-iconbtn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.qn-iconbtn:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary));outline-offset:1px}
.qn-composer{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);border-radius:12px;padding:10px 12px 8px;transition:border-color .15s,box-shadow .15s}
.qn-composer:focus-within{border-color:var(--dsw-alias-brand-primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-brand-primary) 14%,transparent)}
.qn-composer textarea{display:block;width:100%;min-height:44px;max-height:180px;resize:none;border:0;outline:0;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:14px;line-height:1.6;padding:0}
.qn-composer textarea::placeholder{color:var(--dsw-alias-label-tertiary)}
.qn-composer-foot{display:flex;align-items:center;gap:8px;margin-top:6px;min-height:26px}
.qn-hint{font-size:11px;color:var(--dsw-alias-label-tertiary);white-space:nowrap}
.qn-spacer{flex:1}
.qn-primary{height:28px;padding:0 12px;border:0;border-radius:8px;background:var(--dsw-alias-brand-primary);color:#fff;font-size:12px;font-weight:500;font-family:inherit;cursor:pointer;transition:opacity .12s,transform .06s}
.qn-primary:hover{opacity:.9}
.qn-primary:active{transform:translateY(1px)}
.qn-primary:disabled{opacity:.45;cursor:default}
.qn-primary:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary));outline-offset:2px}
.qn-ghost{height:26px;padding:0 8px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:11.5px;cursor:pointer}
.qn-ghost:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.qn-flash{font-size:11.5px;color:var(--dsw-alias-state-success-primary,var(--dsw-alias-brand-primary))}
.qn-err{font-size:11.5px;color:var(--dsw-alias-state-error-primary,#d9534f)}
.qn-days{margin-top:16px;display:flex;flex-direction:column;gap:16px}
.qn-day-head{display:flex;align-items:center;gap:8px;margin:0 2px 7px;color:var(--dsw-alias-label-secondary);font-size:11.5px}
.qn-dot{width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-brand-primary);opacity:.75;flex:none}
.qn-day-count{color:var(--dsw-alias-label-tertiary)}
.qn-notes{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);border-radius:12px;overflow:hidden}
.qn-note{display:grid;grid-template-columns:46px 1fr auto;gap:10px;align-items:start;padding:9px 12px;position:relative}
.qn-note+.qn-note{border-top:1px solid var(--dsw-alias-border-l1)}
.qn-note:hover{background:var(--dsw-alias-interactive-bg-hover)}
.qn-time{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:var(--dsw-alias-label-tertiary);padding-top:2px;font-variant-numeric:tabular-nums}
.qn-text{white-space:pre-wrap;word-break:break-word;font-size:13px;line-height:1.62}
.qn-text mark{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 22%,transparent);color:inherit;border-radius:3px;padding:0 1px}
.qn-actions{display:flex;gap:2px;opacity:0;transition:opacity .12s}
.qn-note:hover .qn-actions,.qn-note:focus-within .qn-actions{opacity:1}
.qn-mini{height:24px;padding:0 7px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:11px;cursor:pointer}
.qn-mini:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.qn-mini.danger:hover{color:var(--dsw-alias-state-error-primary,#d9534f)}
.qn-confirm{display:flex;align-items:center;gap:4px;font-size:11px;color:var(--dsw-alias-label-secondary)}
.qn-empty{margin-top:56px;text-align:center;color:var(--dsw-alias-label-tertiary)}
.qn-empty svg{opacity:.5;margin-bottom:10px}
.qn-empty p{margin:0;font-size:13px}
.qn-empty small{display:block;margin-top:4px;font-size:11.5px}
.qn-loadmore{align-self:center;margin-top:4px}
.qn-vaultrow{display:flex;align-items:center;gap:10px;margin:2px 0 14px}
.qn-vault-picker{position:relative;flex:none}
.qn-vault-btn{display:inline-flex;align-items:center;gap:6px;height:30px;max-width:220px;padding:0 10px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font:inherit;font-size:12.5px;font-weight:500;cursor:pointer;transition:border-color .12s,background .12s}
.qn-vault-btn:hover{border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-interactive-bg-hover)}
.qn-vault-btn-name{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.qn-vault-btn svg{flex:none;color:var(--dsw-alias-label-tertiary);transition:transform .12s}
.qn-vault-picker[data-open='true'] .qn-vault-btn svg{transform:rotate(180deg)}
.qn-vault-menu{position:absolute;top:calc(100% + 4px);left:0;z-index:60;min-width:180px;max-width:260px;padding:4px;border-radius:10px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);box-shadow:0 12px 36px rgba(0,0,0,.28);animation:qn-rise .12s ease-out}
.qn-vault-opt{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;padding:7px 10px;border:0;border-radius:7px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12.5px;text-align:left;cursor:pointer}
.qn-vault-opt:hover{background:var(--dsw-alias-interactive-bg-hover)}
.qn-vault-opt.active{color:var(--dsw-alias-brand-primary);font-weight:600}
.qn-vault-path{font-size:11px;color:var(--dsw-alias-label-tertiary);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.qn-vault-list{display:flex;flex-direction:column;gap:8px}
.qn-vault-item{border:1px solid var(--dsw-alias-border-l1);border-radius:10px;padding:9px 11px;background:var(--dsw-alias-bg-layer-2)}
.qn-vault-item.active{border-color:var(--dsw-alias-brand-primary)}
.qn-vault-item-head{display:flex;align-items:center;gap:8px}
.qn-vault-name{font-size:12.5px;font-weight:600;color:var(--dsw-alias-label-primary);flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.qn-vault-badge{flex:none;font-size:10px;line-height:1;padding:3px 6px;border-radius:99px;background:color-mix(in srgb,var(--dsw-alias-brand-primary) 16%,transparent);color:var(--dsw-alias-brand-primary);font-weight:600}
.qn-vault-item-path{display:block;margin-top:5px;font-size:10.5px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--dsw-alias-label-tertiary);word-break:break-all}
.qn-vault-item-actions{display:flex;gap:2px;flex:none}
.qn-vault-actions{display:flex;gap:6px;margin-top:9px;flex-wrap:wrap}
.qn-addform{display:flex;flex-direction:column;gap:8px}
.qn-addrow{display:flex;gap:6px}
.qn-addrow .qn-input{flex:1;min-width:0}
.qn-addpath{font-size:10.5px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--dsw-alias-label-tertiary);word-break:break-all}
.qn-footer{margin-top:26px;text-align:center;font-size:11px;color:var(--dsw-alias-label-tertiary)}
.qn-footer button{border:0;background:transparent;color:var(--dsw-alias-label-tertiary);font:inherit;cursor:pointer;text-decoration:underline;text-underline-offset:2px;padding:0 2px}
.qn-footer button:hover{color:var(--dsw-alias-label-secondary)}
.qn-backdrop{position:fixed;inset:0;z-index:80;display:flex;align-items:flex-start;justify-content:center;padding:15vh 24px 24px;background:rgba(6,9,14,.44);animation:qn-fade .12s ease-out}
.qn-capture{width:min(580px,100%);background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);border-radius:16px;box-shadow:0 28px 80px rgba(0,0,0,.42);padding:14px 16px 11px;animation:qn-rise .14s ease-out}
.qn-capture textarea{display:block;width:100%;min-height:76px;max-height:40vh;resize:none;border:0;outline:0;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:15px;line-height:1.65}
.qn-capture textarea::placeholder{color:var(--dsw-alias-label-tertiary)}
.qn-capture-foot{display:flex;align-items:center;gap:10px;margin-top:8px}
.qn-drawer-veil{position:fixed;inset:0;z-index:70;background:rgba(6,9,14,.3)}
.qn-drawer{position:fixed;top:0;right:0;bottom:0;z-index:71;width:min(400px,92vw);background:var(--dsw-alias-bg-layer-1);border-left:1px solid var(--dsw-alias-border-l2);box-shadow:-24px 0 60px rgba(0,0,0,.22);padding:18px 20px 32px;overflow-y:auto;animation:qn-slide .16s ease-out}
.qn-drawer h3{margin:0 0 2px;font-size:14px;font-weight:600}
.qn-drawer .qn-close{position:absolute;top:12px;right:12px}
.qn-field{margin-top:20px}
.qn-label{display:block;font-size:11.5px;color:var(--dsw-alias-label-secondary);margin-bottom:6px}
.qn-code{display:block;padding:9px 10px;border-radius:9px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px;line-height:1.5;color:var(--dsw-alias-label-primary);word-break:break-all}
.qn-row{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.qn-input{width:100%;height:30px;padding:0 9px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px;outline:0}
.qn-input:focus{border-color:var(--dsw-alias-brand-primary)}
.qn-note-text{font-size:11px;line-height:1.6;color:var(--dsw-alias-label-tertiary);margin-top:18px;padding-top:14px;border-top:1px solid var(--dsw-alias-border-l1)}
.qn-sep{height:1px;background:var(--dsw-alias-border-l1);margin:18px 0}
.qn-kbd{display:inline-flex;align-items:center;gap:2px;margin-left:6px;color:var(--dsw-alias-label-secondary)}
.qn-kbd span{display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 4px;border-radius:5px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);font-size:10.5px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.qn-toast{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:95;padding:7px 13px;border-radius:9px;background:var(--dsw-alias-bg-layer-3);border:1px solid var(--dsw-alias-border-l2);box-shadow:0 10px 30px rgba(0,0,0,.26);font-size:12px;color:var(--dsw-alias-label-primary);animation:qn-rise .14s ease-out}
.qn-toast.err{border-color:var(--dsw-alias-state-error-primary,#d9534f)}
@keyframes qn-fade{from{opacity:0}to{opacity:1}}
@keyframes qn-rise{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@keyframes qn-slide{from{opacity:0;transform:translateX(12px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.qn-backdrop,.qn-capture,.qn-drawer,.qn-toast{animation:none}}
`;

    function installStyle() {
      if (document.getElementById(STYLE_ID) !== null) return () => {};
      const el = document.createElement('style');
      el.id = STYLE_ID;
      el.textContent = CSS;
      (document.head ?? document.documentElement).append(el);
      return () => el.remove();
    }

    // ------------------------------------------------------------------
    // 运行时引用（apply 时填充）
    // ------------------------------------------------------------------

    const runtime = {
      t: (key) => key,
      keycap: () => '⌘⇧N',
      pickDirectory: null,
      locale: null,
    };

    function useKeycap() {
      const [keys, setKeys] = useState('');
      useEffect(() => {
        const store = runtime.keycapStore;
        if (store === undefined) return () => {};
        const read = () => setKeys(store());
        read();
        const shortcuts = runtime.shortcuts;
        if (shortcuts?.catalog?.subscribe) return shortcuts.catalog.subscribe(read);
        return () => {};
      }, []);
      return keys === '' ? runtime.keycapFallback : keys;
    }

    function useStore(store) {
      const [state, setState] = useState(store.get());
      useEffect(() => store.subscribe(setState), [store]);
      return state;
    }

    // ------------------------------------------------------------------
    // 组件
    // ------------------------------------------------------------------

    const ICONS = {
        gear: ['M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z', 'M19.4 13.5a7.8 7.8 0 0 0 0-3l1.4-1.1-1.9-3.3-1.7.7a7.7 7.7 0 0 0-2.6-1.5L14.3 3h-3.8l-.3 2.3a7.7 7.7 0 0 0-2.6 1.5l-1.7-.7L4 9.4l1.4 1.1a7.8 7.8 0 0 0 0 3L4 14.6l1.9 3.3 1.7-.7a7.7 7.7 0 0 0 2.6 1.5l.3 2.3h3.8l.3-2.3a7.7 7.7 0 0 0 2.6-1.5l1.7.7 1.9-3.3-1.4-1.1Z'],
        search: ['M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Z', 'M15.2 15.2 20 20'],
        close: ['M6 6l12 12M18 6 6 18'],
        folder: ['M3.8 7.2a2 2 0 0 1 2-2h3.4l2 2h7a2 2 0 0 1 2 2v8.6a2 2 0 0 1-2 2h-12a2 2 0 0 1-2-2V7.2Z'],
        note: ['M7.5 3.75h9a1.75 1.75 0 0 1 1.75 1.75v13a1.75 1.75 0 0 1-1.75 1.75h-9A1.75 1.75 0 0 1 5.75 18.5v-13A1.75 1.75 0 0 1 7.5 3.75Z', 'M9 8.25h6M9 11.75h6M9 15.25h3.25'],
        chevron: ['M6 9.5 12 15.5 18 9.5'],
        check: ['M5 12.5 10 17.5 19 7.5'],
    };

    function Composer(props) {
      const t = runtime.t;
      const [value, setValue] = useState('');
      const [busy, setBusy] = useState(false);
      const [error, setError] = useState('');
      const [flash, setFlash] = useState('');
      const ref = useRef(null);
      const keycap = useKeycap();
      const activeInfo = useStore(activeNameStore);
      const autoGrow = useCallback(() => {
        const el = ref.current;
        if (el === null) return;
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, props.variant === 'overlay' ? 220 : 160)}px`;
      }, [props.variant]);

      useEffect(() => {
        autoGrow();
        if (props.autoFocus && ref.current !== null) {
          ref.current.focus();
          ref.current.setSelectionRange(ref.current.value.length, ref.current.value.length);
        }
      }, [props.autoFocus]);

      const submit = useCallback(async () => {
        const text = value.trim();
        if (text === '' || busy) return;
        setBusy(true);
        setError('');
        try {
          const result = await api('/notes', { method: 'POST', body: JSON.stringify({ text, vault: activeInfo.name }) });
          setValue('');
          setFlash(`${t('saved')} ${result.note.time}${activeInfo.name !== '' ? ` · ${activeInfo.name}` : ''}`);
          versionStore.set((s) => ({ v: s.v + 1 }));
          if (props.onSaved) props.onSaved(result.note);
          if (ref.current !== null) {
            ref.current.style.height = 'auto';
            if (props.variant === 'overlay') ref.current.focus();
          }
          setTimeout(() => setFlash(''), 2200);
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        } finally {
          setBusy(false);
        }
      }, [value, busy, props.onSaved, t, activeInfo.name]);

      const onKeyDown = (e) => {
        if (e.nativeEvent && e.nativeEvent.isComposing) return;
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          submit();
          return;
        }
        if (e.key === 'Escape' && props.onEscape) {
          e.preventDefault();
          props.onEscape();
        }
      };

      return h(
        'div',
        { className: props.variant === 'overlay' ? 'qn-capture' : 'qn-composer' },
        h('textarea', {
          ref,
          value,
          rows: 1,
          placeholder: t('placeholder'),
          autoFocus: Boolean(props.autoFocus),
          onChange: (e) => {
            setValue(e.target.value);
            setFlash('');
            autoGrow();
          },
          onKeyDown,
          'aria-label': t('placeholder'),
        }),
        h(
          'div',
          { className: 'qn-composer-foot' },
          h(
            'span',
            { className: 'qn-hint' },
            `${props.variant === 'overlay' && activeInfo.name !== '' ? `${t('notebook.to').replace('{name}', activeInfo.name)}  ·  ` : ''}${props.variant === 'panel' && keycap ? `${keycap}  ·  ` : ''}${t('hint.save')}  ·  ${t('hint.newline')}${props.variant === 'overlay' ? `  ·  ${t('hint.esc')}` : ''}`,
          ),
          h('span', { className: 'qn-spacer' }),
          flash !== '' ? h('span', { className: 'qn-flash' }, flash) : null,
          error !== '' ? h('span', { className: 'qn-err', role: 'alert' }, error) : null,
          h('button', { type: 'button', className: 'qn-primary', disabled: busy || value.trim() === '', onClick: submit }, busy ? t('saving') : t('save')),
        ),
      );
    }

    function Note({ note, t, onDeleted, vaultName }) {
      const [confirming, setConfirming] = useState(false);
      const [busy, setBusy] = useState(false);
      const [error, setError] = useState('');
      const [copied, setCopied] = useState(false);

      const copy = async () => {
        try {
          await navigator.clipboard.writeText(note.text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        } catch {
          /* 剪贴板不可用时静默 */
        }
      };

      const remove = async () => {
        setBusy(true);
        setError('');
        try {
          await api('/notes', { method: 'DELETE', body: JSON.stringify({ id: note.id, vault: vaultName }) });
          versionStore.set((s) => ({ v: s.v + 1 }));
          toast(t('notify.deleted'));
          if (onDeleted) onDeleted(note);
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
          setConfirming(false);
        } finally {
          setBusy(false);
        }
      };

      let actions;
      if (confirming) {
        actions = h(
          'div',
          { className: 'qn-confirm' },
          h('span', null, t('delete.confirm')),
          h('button', { type: 'button', className: 'qn-mini danger', disabled: busy, onClick: remove }, t('delete')),
          h('button', { type: 'button', className: 'qn-mini', onClick: () => setConfirming(false) }, t('cancel')),
        );
      } else {
        actions = h(
          'div',
          { className: 'qn-actions' },
          h('button', { type: 'button', className: 'qn-mini', title: t('copy'), onClick: copy }, copied ? t('copied') : t('copy')),
          h('button', { type: 'button', className: 'qn-mini danger', title: t('delete'), onClick: () => setConfirming(true) }, t('delete')),
        );
      }

      return h(
        'div',
        { className: 'qn-note' },
        h('span', { className: 'qn-time' }, note.time),
        h('div', { className: 'qn-text' }, error !== '' ? h('span', { className: 'qn-err' }, error) : note.text),
        actions,
      );
    }

    function matches(note, query) {
      if (query === '') return true;
      return note.text.toLowerCase().indexOf(query.toLowerCase()) !== -1;
    }

    function Settings(props) {
      const t = runtime.t;
      const [busy, setBusy] = useState(false);
      const [error, setError] = useState('');
      const [note, setNote] = useState('');
      const keycap = useKeycap();
      const [addName, setAddName] = useState('');
      const [addPath, setAddPath] = useState('');
      const [renameFor, setRenameFor] = useState('');
      const [renameDraft, setRenameDraft] = useState('');
      const [removing, setRemoving] = useState('');

      const vaults = props.vaults || [];
      const activeName = props.activeName || '';
      const onlyOne = vaults.length <= 1;

      const flash = (msg) => {
        setNote(msg);
        setTimeout(() => setNote(''), 1800);
      };

      const toMap = (list) => {
        const map = {};
        for (const v of list) map[v.name] = v.path;
        return map;
      };

      const save = async (nextVaults, nextActive, okNote) => {
        setBusy(true);
        setError('');
        try {
          const result = await api('/config', { method: 'PUT', body: JSON.stringify({ vaults: nextVaults, active: nextActive }) });
          props.onChanged(result);
          flash(okNote);
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        } finally {
          setBusy(false);
        }
      };

      const setCurrent = (name) => save(toMap(vaults), name, t('notebook.activeChanged').replace('{name}', name));

      const chooseFolder = async () => {
        if (runtime.pickDirectory === null) {
          setError(t('error.host'));
          return;
        }
        try {
          const picked = await runtime.pickDirectory();
          const value = typeof picked === 'string' ? picked : picked && picked.path;
          if (typeof value === 'string' && value !== '') setAddPath(value);
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        }
      };

      const addNotebook = () => {
        const name = addName.trim();
        if (name === '') {
          setError(t('notebook.nameRequired'));
          return;
        }
        if (vaults.some((v) => v.name === name)) {
          setError(t('notebook.duplicate'));
          return;
        }
        if (addPath === '') {
          setError(t('notebook.noPath'));
          return;
        }
        const next = toMap(vaults);
        next[name] = addPath;
        save(next, activeName, t('notebook.added')).then(() => {
          setAddName('');
          setAddPath('');
        });
      };

      const beginRename = (v) => {
        setRenameFor(v.name);
        setRenameDraft(v.name);
      };

      const confirmRename = () => {
        const name = renameDraft.trim();
        if (name === '') {
          setError(t('notebook.nameRequired'));
          return;
        }
        if (name !== renameFor && vaults.some((v) => v.name === name)) {
          setError(t('notebook.duplicate'));
          return;
        }
        const map = toMap(vaults);
        const path = map[renameFor];
        delete map[renameFor];
        map[name] = path;
        const nextActive = activeName === renameFor ? name : activeName;
        setRenameFor('');
        save(map, nextActive, t('notebook.renamed'));
      };

      const confirmRemove = () => {
        const map = toMap(vaults);
        delete map[removing];
        const nextActive = activeName === removing ? Object.keys(map)[0] : activeName;
        setRemoving('');
        save(map, nextActive, t('notebook.removed'));
      };

      const reveal = async (target) => {
        try {
          await api('/reveal', { method: 'POST', body: JSON.stringify({ target }) });
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        }
      };

      const copyPath = async () => {
        const activeVault = vaults.find((v) => v.name === activeName);
        if (!activeVault) return;
        try {
          await navigator.clipboard.writeText(activeVault.path);
          flash(t('copied'));
        } catch {
          /* ignore */
        }
      };

      const activeVault = vaults.find((v) => v.name === activeName);

      return h(
        React.Fragment,
        null,
        h('div', { className: 'qn-drawer-veil', onClick: props.onClose }),
        h(
          'div',
          { className: 'qn-drawer', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('settings') },
          h('button', { type: 'button', className: 'qn-iconbtn qn-close', onClick: props.onClose, 'aria-label': t('close') }, h(Icon, { paths: ICONS.close, size: 16 })),
          h('h3', null, t('settings')),
          activeVault
            ? h('div', { className: 'qn-field' },
                h('span', { className: 'qn-label' }, t('settings.currentVault')),
                h('code', { className: 'qn-code' }, activeVault.path),
                h('div', { className: 'qn-row' },
                  h('button', { type: 'button', className: 'qn-ghost', onClick: copyPath }, t('settings.copyPath')),
                  h('button', { type: 'button', className: 'qn-ghost', onClick: () => reveal('vault') }, t('settings.reveal')),
                  h('button', { type: 'button', className: 'qn-ghost', onClick: () => reveal('today') }, t('settings.openToday')),
                ),
              )
            : null,
          h('div', { className: 'qn-field' },
            h('span', { className: 'qn-label' }, `${t('settings.notebooks')}（${vaults.length}）`),
            h('div', { className: 'qn-vault-list' },
              vaults.map((v) => {
                const isActive = v.name === activeName;
                const isRenaming = renameFor === v.name;
                const isRemoving = removing === v.name;
                return h(
                  'div',
                  { key: v.name, className: `qn-vault-item${isActive ? ' active' : ''}` },
                  h('div', { className: 'qn-vault-item-head' },
                    h('span', { className: 'qn-vault-name', title: v.name }, v.name),
                    isActive ? h('span', { className: 'qn-vault-badge' }, t('notebook.current')) : null,
                    h('div', { className: 'qn-vault-item-actions' },
                      isActive ? null : h('button', { type: 'button', className: 'qn-mini', onClick: () => setCurrent(v.name) }, t('notebook.setCurrent')),
                      isRenaming ? null : h('button', { type: 'button', className: 'qn-mini', onClick: () => beginRename(v) }, t('notebook.rename')),
                      h('button', { type: 'button', className: 'qn-mini danger', disabled: onlyOne, title: onlyOne ? t('notebook.lastOne') : undefined, onClick: () => setRemoving(v.name) }, t('notebook.remove')),
                    ),
                  ),
                  h('span', { className: 'qn-vault-item-path' }, v.path),
                  isRenaming
                    ? h('div', { className: 'qn-vault-actions' },
                        h('input', {
                          className: 'qn-input',
                          value: renameDraft,
                          autoFocus: true,
                          onChange: (e) => setRenameDraft(e.target.value),
                          onKeyDown: (e) => {
                            if (e.key === 'Enter') confirmRename();
                            if (e.key === 'Escape') setRenameFor('');
                          },
                        }),
                        h('button', { type: 'button', className: 'qn-ghost', disabled: busy, onClick: confirmRename }, t('confirm')),
                        h('button', { type: 'button', className: 'qn-ghost', onClick: () => setRenameFor('') }, t('cancel')),
                      )
                    : null,
                  isRemoving
                    ? h('div', { className: 'qn-vault-actions' },
                        h('span', { className: 'qn-hint' }, t('notebook.removeConfirm')),
                        h('button', { type: 'button', className: 'qn-mini danger', disabled: busy, onClick: confirmRemove }, t('delete')),
                        h('button', { type: 'button', className: 'qn-mini', onClick: () => setRemoving('') }, t('cancel')),
                      )
                    : null,
                );
              }),
            ),
          ),
          h('div', { className: 'qn-field' },
            h('span', { className: 'qn-label' }, t('settings.addNotebook')),
            h('div', { className: 'qn-addform' },
              h('div', { className: 'qn-addrow' },
                h('input', {
                  className: 'qn-input',
                  value: addName,
                  placeholder: t('notebook.namePlaceholder'),
                  onChange: (e) => setAddName(e.target.value),
                  onKeyDown: (e) => {
                    if (e.key === 'Enter') addNotebook();
                  },
                }),
                h('button', { type: 'button', className: 'qn-ghost', onClick: chooseFolder }, t('settings.choose')),
              ),
              addPath !== '' ? h('span', { className: 'qn-addpath' }, addPath) : null,
              h('button', { type: 'button', className: 'qn-primary', disabled: busy || addName.trim() === '' || addPath === '', onClick: addNotebook }, busy ? t('saving') : t('settings.addNotebook')),
            ),
          ),
          error !== '' ? h('p', { className: 'qn-err', role: 'alert' }, error) : null,
          note !== '' ? h('p', { className: 'qn-flash' }, note) : null,
          h('div', { className: 'qn-field' },
            h('span', { className: 'qn-label' }, t('settings.shortcut')),
            h('div', { className: 'qn-hint' }, keycap, ' · ', t('settings.shortcutHint')),
          ),
          h('p', { className: 'qn-note-text' }, t('settings.pathHint')),
        ),
      );
    }

    function Toasts() {
      const [state, setState] = useState(toastStore.get());
      useEffect(() => toastStore.subscribe(setState), []);
      if (state.message === '') return null;
      return h('div', { className: `qn-toast${state.tone === 'err' ? ' err' : ''}`, role: 'status' }, state.message);
    }

    function CaptureOverlay() {
      const t = runtime.t;
      const [state, setState] = useState(captureStore.get());
      useEffect(() => captureStore.subscribe(setState), []);

      useEffect(() => {
        if (!state.open) return undefined;
        const onKey = (e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            captureStore.set({ open: false });
          }
        };
        window.addEventListener('keydown', onKey, true);
        return () => window.removeEventListener('keydown', onKey, true);
      }, [state.open]);

      return h(
        React.Fragment,
        null,
        h(Toasts, null),
        state.open
          ? h(
              'div',
              {
                className: 'qn-backdrop',
                onMouseDown: (e) => {
                  if (e.target === e.currentTarget) captureStore.set({ open: false });
                },
              },
              h(
                'div',
                { className: 'qn-capture', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('title') },
                h(Composer, {
                  variant: 'overlay',
                  autoFocus: true,
                  onEscape: () => captureStore.set({ open: false }),
                  onSaved: (note) => {
                    toast(`${t('saved')} ${note.time}`);
                    captureStore.set((s) => ({ open: false, seq: s.seq + 1 }));
                  },
                }),
              ),
            )
          : null,
      );
    }

    function Panel() {
      const t = runtime.t;
      const [vaults, setVaults] = useState([]);
      const [activeName, setActiveName] = useState('');
      const [days, setDays] = useState([]);
      const [total, setTotal] = useState(0);
      const [hasMore, setHasMore] = useState(false);
      const [loading, setLoading] = useState(true);
      const [error, setError] = useState('');
      const [query, setQuery] = useState('');
      const [settingsOpen, setSettingsOpen] = useState(false);
      const [loadingMore, setLoadingMore] = useState(false);
      const [menuOpen, setMenuOpen] = useState(false);
      const activeRef = useRef('');

      const activeVault = vaults.find((v) => v.name === activeName) || null;

      const load = useCallback(async (keepPages) => {
        try {
          const data = await api('/bootstrap');
          setVaults(data.vaults || []);
          setActiveName(data.active || '');
          activeNameStore.set({ name: data.active || '' });
          const isSwitch = (data.active || '') !== activeRef.current;
          activeRef.current = data.active || '';
          const page = await api(`/days?limit=60${data.active ? `&vault=${encodeURIComponent(data.active)}` : ''}`);
          if (!keepPages || isSwitch) {
            setDays(page.days);
          } else {
            // 按日期合并：新数据覆盖同日期旧数据（删除/新增后刷新），并剔除空日期
            setDays((prev) => {
              const map = new Map(prev.map((d) => [d.date, d]));
              for (const day of page.days) map.set(day.date, day);
              for (const [date, day] of map) {
                if (!day || !Array.isArray(day.notes) || day.notes.length === 0) map.delete(date);
              }
              return [...map.values()];
            });
          }
          setTotal(page.total);
          setHasMore(page.hasMore);
          setError('');
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        } finally {
          setLoading(false);
        }
      }, []);

      useEffect(() => {
        load(false);
      }, [load]);

      useEffect(() => versionStore.subscribe(() => load(true)), [load]);

      const switchVault = async (name) => {
        if (name === activeRef.current) return;
        try {
          const map = {};
          for (const v of vaults) map[v.name] = v.path;
          await api('/config', { method: 'PUT', body: JSON.stringify({ vaults: map, active: name }) });
          await load(false);
          toast(t('notebook.activeChanged').replace('{name}', name));
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        }
      };

      useEffect(() => {
        if (!menuOpen) return undefined;
        const onDown = (e) => {
          if (!(e.target instanceof Element) || !e.target.closest('.qn-vault-picker')) setMenuOpen(false);
        };
        const onEsc = (e) => {
          if (e.key === 'Escape') setMenuOpen(false);
        };
        window.addEventListener('mousedown', onDown);
        window.addEventListener('keydown', onEsc);
        return () => {
          window.removeEventListener('mousedown', onDown);
          window.removeEventListener('keydown', onEsc);
        };
      }, [menuOpen]);

      const loadMore = async () => {
        if (days.length === 0) return;
        setLoadingMore(true);
        try {
          const before = days[days.length - 1].date;
          const page = await api(`/days?limit=60&before=${before}${activeRef.current ? `&vault=${encodeURIComponent(activeRef.current)}` : ''}`);
          setDays((prev) => prev.concat(page.days));
          setHasMore(page.hasMore);
          setTotal(page.total);
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        } finally {
          setLoadingMore(false);
        }
      };

      const q = query.trim();
      const shown = useMemo(() => {
        if (q === '') return days;
        return days
          .map((day) => ({ date: day.date, weekday: day.weekday, notes: day.notes.filter((n) => matches(n, q)) }))
          .filter((day) => day.notes.length > 0);
      }, [days, q]);

      const shownCount = useMemo(() => shown.reduce((sum, day) => sum + day.notes.length, 0), [shown]);

      const shortPath = (p) => (typeof p === 'string' && p.indexOf('/') === 0 ? p.replace(/^\/Users\/[^/]+/, '~') : p || '');

      let body;
      if (loading) {
        body = h('div', { className: 'qn-empty' }, h('p', null, t('loading')));
      } else if (error !== '' && days.length === 0) {
        body = h(
          'div',
          { className: 'qn-empty' },
          h('p', null, t('error.title')),
          h('small', null, error),
          h('div', { style: { marginTop: 12 } }, h('button', { type: 'button', className: 'qn-ghost', onClick: () => { setLoading(true); load(false); } }, t('retry'))),
        );
      } else if (shown.length === 0) {
        body = h(
          'div',
          { className: 'qn-empty' },
          h(Icon, { paths: ICONS.note, size: 30 }),
          h('p', null, q !== '' ? t('empty.search') : t('empty')),
          q === '' ? h('small', null, t('empty.hint')) : null,
        );
      } else {
        body = h(
          'div',
          { className: 'qn-days' },
          shown.map((day) =>
            h(
              'section',
              { key: day.date, className: 'qn-day' },
              h(
                'div',
                { className: 'qn-day-head' },
                h('span', { className: 'qn-dot' }),
                h('span', null, dayLabel(day.date, day.weekday, t)),
                h('span', { className: 'qn-day-count' }, `${day.notes.length} ${t('unit.note')}`),
              ),
              h('div', { className: 'qn-notes' }, day.notes.map((note) => h(Note, { key: note.id, note, t, vaultName: activeName }))),
            ),
          ),
          hasMore && q === '' ? h('button', { type: 'button', className: 'qn-ghost qn-loadmore', disabled: loadingMore, onClick: loadMore }, loadingMore ? t('loading') : t('loadMore')) : null,
        );
      }

      return h(
        'div',
        { className: 'qn-root' },
        h(
          'div',
          { className: 'qn-head' },
          h('h2', { className: 'qn-title' }, t('title')),
          h('span', { className: 'qn-sub' }, q === '' ? `${total} ${t('unit.note')}` : `${shownCount} ${t('unit.note')}`),
          h(
            'div',
            { className: 'qn-tools' },
            h(
              'div',
              { className: 'qn-search' },
              h(Icon, { paths: ICONS.search, size: 13 }),
              h('input', {
                value: query,
                placeholder: t('search'),
                onChange: (e) => setQuery(e.target.value),
                'aria-label': t('search'),
              }),
              query !== '' ? h('button', { type: 'button', className: 'qn-iconbtn', style: { width: 18, height: 18 }, onClick: () => setQuery(''), 'aria-label': t('search.clear') }, h(Icon, { paths: ICONS.close, size: 11 })) : null,
            ),
            h('button', { type: 'button', className: 'qn-iconbtn', title: t('settings'), 'aria-label': t('settings'), onClick: () => setSettingsOpen(true) }, h(Icon, { paths: ICONS.gear, size: 16 })),
          ),
        ),
        h(
          'div',
          { className: 'qn-vaultrow' },
          h(
            'div',
            { className: 'qn-vault-picker', 'data-open': menuOpen ? 'true' : 'false' },
            h(
              'button',
              { type: 'button', className: 'qn-vault-btn', onClick: () => setMenuOpen((o) => !o), 'aria-haspopup': 'listbox', 'aria-expanded': menuOpen ? 'true' : 'false', title: t('settings.notebooks') },
              h('span', { className: 'qn-vault-btn-name' }, activeName !== '' ? activeName : t('notebook')),
              h(Icon, { paths: ICONS.chevron, size: 12 }),
            ),
            menuOpen
              ? h(
                  'div',
                  { className: 'qn-vault-menu', role: 'listbox' },
                  vaults.map((v) =>
                    h(
                      'button',
                      {
                        key: v.name,
                        type: 'button',
                        role: 'option',
                        'aria-selected': v.name === activeName ? 'true' : 'false',
                        className: `qn-vault-opt${v.name === activeName ? ' active' : ''}`,
                        onClick: () => {
                          setMenuOpen(false);
                          switchVault(v.name);
                        },
                      },
                      h('span', null, v.name),
                      v.name === activeName ? h(Icon, { paths: ICONS.check, size: 12 }) : null,
                    ),
                  ),
                )
              : null,
          ),
          activeVault ? h('span', { className: 'qn-vault-path', title: activeVault.path }, shortPath(activeVault.path)) : null,
        ),
        h(Composer, { variant: 'panel' }),
        body,
        h(
          'div',
          { className: 'qn-footer' },
          `${t('footer.saveAt')} `,
          h('code', null, shortPath(activeVault ? activeVault.path : '')),
          ' · ',
          h('button', { type: 'button', onClick: () => setSettingsOpen(true) }, t('footer.change')),
        ),
        settingsOpen ? h(Settings, { vaults, activeName, onClose: () => setSettingsOpen(false), onChanged: () => load(false) }) : null,
      );
    }

    // ------------------------------------------------------------------
    // 插件入口
    // ------------------------------------------------------------------

    const SHORTCUT_PROFILES = ['desktop:macos', 'desktop:windows', 'desktop:linux', 'web:macos', 'web:windows'];

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        const locale = ctx.locale;
        if (locale && typeof locale.register === 'function') {
          ctx.effect(() => locale.register(NS, DICT));
          const bound = typeof locale.bind === 'function' ? locale.bind(NS) : null;
          runtime.t = (key) => {
            const table = DICT.zh;
            if (bound !== null) {
              const value = bound(key);
              if (typeof value === 'string' && value !== key) return value;
            }
            return table[key] ?? key;
          };
        } else {
          runtime.t = (key) => DICT.zh[key] ?? key;
        }

        ctx.effect(installStyle);

        // 目录选择器（可选服务）
        const bindPicker = (workspace) => {
          if (workspace && typeof workspace.pickDirectory === 'function') {
            runtime.pickDirectory = () => workspace.pickDirectory();
          }
        };
        try {
          ctx.inject(['uiWorkspace'], (scope) => bindPicker(scope.uiWorkspace));
        } catch {
          /* 服务缺失时走全局兜底 */
        }
        if (runtime.pickDirectory === null && globalThis.__DSH_DIRECTORY_PICKER__ && typeof globalThis.__DSH_DIRECTORY_PICKER__.pick === 'function') {
          runtime.pickDirectory = () => globalThis.__DSH_DIRECTORY_PICKER__.pick();
        }

        // 快捷键
        runtime.keycapFallback = '⌘⇧N';
        runtime.keycapStore = () => {
          const shortcuts = runtime.shortcuts;
          if (!shortcuts || !shortcuts.catalog) return '';
          try {
            const row = shortcuts.catalog.getSnapshot().find((item) => item.id === SHORTCUT_ID);
            return row && Array.isArray(row.keys) ? row.keys.join('') : '';
          } catch {
            return '';
          }
        };

        ctx.effect(() => {
          let shortcuts = null;
          try {
            shortcuts = ctx.get ? ctx.get('shortcuts') : ctx.shortcuts;
          } catch {
            shortcuts = null;
          }
          if (!shortcuts || typeof shortcuts.register !== 'function') {
            return () => {};
          }
          runtime.shortcuts = shortcuts;
          const binding = { code: 'KeyN', modifiers: ['primary', 'shift'] };
          const defaults = {};
          for (const profile of SHORTCUT_PROFILES) defaults[profile] = binding;
          const dispose = shortcuts.register({
            id: SHORTCUT_ID,
            label: '随手记一条',
            aliases: [],
            defaults,
            regions: ['page', 'editable'],
            modals: [],
            resolve: () => ({
              status: 'handled',
              run: () => captureStore.set((s) => ({ open: true, seq: s.seq + 1 })),
            }),
          });
          return typeof dispose === 'function' ? dispose : () => {};
        }, 'quick-notes: shortcut');

        openCapture = () => captureStore.set((s) => ({ open: true, seq: s.seq + 1 }));

        // 侧栏面板
        ctx.slots.inject('sidebar.panellist', () =>
          ctx.slots.register(
            {
              name: 'sidebar.panellist',
              id: 'quick-notes',
              order: 40,
              label: () => runtime.t('title'),
              locale: NS,
            },
            NotesIcon,
          ),
        );

        // 面板本体（布局 root 作用域、以面板 id 为 key 的 main slot）
        ctx.slots.inject('main', () =>
          ctx.slots.register(
            {
              name: 'main',
              key: 'quick-notes',
              locale: NS,
              inject: () => ({ t: runtime.t }),
            },
            Panel,
          ),
        );

        // 速记浮层 + toast
        ctx.slots.inject('shell.overlay', () =>
          ctx.slots.register({ name: 'shell.overlay', id: 'quick-notes-capture', order: 900 }, CaptureOverlay),
        );
      },
    };
  },
});
