/**
 * 随手记 quick-notes · Host half
 *
 * 职责：
 *   - 保存目录的读写（每天一个 Markdown 文件）
 *   - 给 Client 提供同源 HTTP 接口 /api/quick-notes/*
 *   - 配置持久化（默认 ~/Documents/随手记，可改）
 *   - 在 Finder / 资源管理器中显示文件
 *
 * 数据格式（每天一个文件 YYYY-MM-DD.md）：
 *
 *   # 2026-11-05 星期三
 *
 *   - 10:25 先把方案定下来
 *   - 11:02 第二行是续行
 *     续行内容
 *
 * 零依赖，只用 Node 内置模块。
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';

const ROUTE = '/api/quick-notes';
const HEADER = 'x-dsh-quick-notes';
const DAY_FILE = /^(\d{4})-(\d{2})-(\d{2})\.md$/;
const NOTE_LINE = /^- (\d{2}):(\d{2}) ?(.*)$/;
const MAX_BODY = 1 << 20; // 1 MiB
const MAX_TEXT = 20000;
const MAX_FILES = 400;

const NAME = 'quick-notes';

/** @param {Date} date */
function ymd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function hhmm(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function weekdayOf(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  try {
    return new Intl.DateTimeFormat('zh-CN', { weekday: 'long' }).format(new Date(y, m - 1, d, 12));
  } catch {
    return '';
  }
}

function noteId(date, time, text) {
  const hash = createHash('sha1').update(`${time}\n${text}`).digest('hex').slice(0, 8);
  return `${date}|${time}|${hash}`;
}

function expandHome(p) {
  if (typeof p !== 'string' || p.trim() === '') return '';
  let out = p.trim();
  if (out === '~') out = os.homedir();
  else if (out.startsWith('~/') || out.startsWith('~\\')) out = path.join(os.homedir(), out.slice(2));
  return path.isAbsolute(out) ? path.normalize(out) : '';
}

/** 规范化笔记本表：名字去空白、去重、路径必须绝对；非法条目直接丢弃 */
function normalizeVaults(input) {
  const out = {};
  if (input === null || typeof input !== 'object') return out;
  for (const [name, dir] of Object.entries(input)) {
    const cleanName = typeof name === 'string' ? name.trim() : '';
    if (cleanName === '' || cleanName in out) continue;
    const p = expandHome(dir);
    if (p === '') continue;
    out[cleanName] = p;
  }
  return out;
}

function firstVaultName(vaults) {
  return Object.keys(vaults)[0] ?? '';
}

/** 把 Markdown 文本解析成条目数组 */
function parseDay(content, date) {
  const lines = content.replace(/\r\n?/g, '\n').split('\n');
  /** @type {{id:string,time:string,text:string,start:number,end:number}[]} */
  const notes = [];
  let current = null;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const match = NOTE_LINE.exec(line);
    if (match !== null) {
      if (current !== null) {
        current.end = i;
        current.text = current.text.replace(/\s+$/, '');
        notes.push(current);
      }
      current = {
        id: '',
        time: `${match[1]}:${match[2]}`,
        text: match[3] ?? '',
        start: i,
        end: i + 1,
      };
      continue;
    }
    if (current !== null && (line.startsWith('  ') || line.trim() === '')) {
      current.text += `\n${line.startsWith('  ') ? line.slice(2) : ''}`;
      continue;
    }
    if (current !== null) {
      current.end = i;
      current.text = current.text.replace(/\s+$/, '');
      notes.push(current);
      current = null;
    }
  }
  if (current !== null) {
    current.end = lines.length;
    current.text = current.text.replace(/\s+$/, '');
    notes.push(current);
  }
  for (const note of notes) {
    note.id = noteId(date, note.time, note.text);
    note.lines = note.end - note.start;
  }
  return notes;
}

function serializeNote(time, text) {
  const rows = text.split('\n').map((row) => row.replace(/\s+$/, ''));
  const head = `- ${time} ${rows[0] ?? ''}`;
  const rest = rows.slice(1).map((row) => (row === '' ? '  ' : `  ${row}`));
  return [head, ...rest].join('\n');
}

function normalizeText(input) {
  if (typeof input !== 'string') return '';
  return input
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+$/, ''))
    .join('\n')
    .replace(/^\n+/, '')
    .replace(/\n+$/, '')
    .slice(0, MAX_TEXT);
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error('请求体过大'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (raw.trim() === '') return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('请求体不是合法 JSON'));
      }
    });
    req.on('error', reject);
  });
}

function revealInFileManager(target) {
  const platform = process.platform;
  let command;
  let args;
  if (platform === 'darwin') {
    command = 'open';
    args = ['-R', target];
  } else if (platform === 'win32') {
    command = 'explorer.exe';
    args = ['/select,', target];
  } else {
    command = 'xdg-open';
    args = [path.dirname(target)];
  }
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { detached: true, stdio: 'ignore' });
    child.once('error', reject);
    child.once('spawn', () => {
      child.unref();
      resolve(true);
    });
  });
}

function openPath(target) {
  const platform = process.platform;
  const command = platform === 'darwin' ? 'open' : platform === 'win32' ? 'explorer.exe' : 'xdg-open';
  return new Promise((resolve, reject) => {
    const child = spawn(command, [target], { detached: true, stdio: 'ignore' });
    child.once('error', reject);
    child.once('spawn', () => {
      child.unref();
      resolve(true);
    });
  });
}

export function apply(ctx, config = {}) {
  const dshHome = process.env.DSH_HOME && process.env.DSH_HOME.trim() !== ''
    ? process.env.DSH_HOME
    : path.join(os.homedir(), '.dsh');
  const configFile = path.join(dshHome, NAME, 'config.json');
  const defaultVault = path.join(os.homedir(), 'Documents', '随手记');

  // 状态：多笔记本 { vaults: {name: path}, active: name }
  const state = {
    vaults: {},
    active: '',
  };

  // 读配置：坏文件不阻塞启动；旧格式 {"vault": path} 自动迁移成 {"vaults": {"默认": path}}
  let legacy = false;
  try {
    const raw = fs.readFileSync(configFile, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed?.vaults && typeof parsed.vaults === 'object') {
      state.vaults = normalizeVaults(parsed.vaults);
      state.active = typeof parsed.active === 'string' && parsed.active in state.vaults
        ? parsed.active
        : firstVaultName(state.vaults);
    } else {
      const wanted = expandHome(parsed?.vault);
      if (wanted !== '') {
        state.vaults = { 默认: wanted };
        legacy = true;
      }
    }
  } catch {
    // 首次运行没有配置文件
  }
  if (Object.keys(state.vaults).length === 0) {
    state.vaults = { 默认: defaultVault };
  }
  if (!(state.active in state.vaults)) state.active = firstVaultName(state.vaults);
  if (legacy) void persistConfig();

  // ---- 文件缓存 ----
  /** @type {Map<string, {mtimeMs:number, size:number, notes:any[]}>} */
  const cache = new Map();
  /** @type {Map<string, Promise<unknown>>} */
  const queues = new Map();

  function withLock(key, job) {
    const previous = queues.get(key) ?? Promise.resolve();
    const next = previous.then(job, job);
    queues.set(key, next.catch(() => undefined));
    return next;
  }

  function vaultPath(name) {
    const p = state.vaults[name];
    if (!p) throw new Error(`笔记本「${name ?? ''}」不存在`);
    return p;
  }

  function activePath() {
    return vaultPath(state.active);
  }

  async function ensureVault(vault = activePath()) {
    await fsp.mkdir(vault, { recursive: true });
  }

  async function vaultWritable(vault = activePath()) {
    try {
      await ensureVault(vault);
      const probe = path.join(vault, `.quick-notes-write-test-${process.pid}`);
      await fsp.writeFile(probe, 'ok');
      await fsp.unlink(probe);
      return { ok: true };
    } catch (error) {
      return { ok: false, reason: error instanceof Error ? error.message : String(error) };
    }
  }

  function dayPath(date, vault = activePath()) {
    return path.join(vault, `${date}.md`);
  }

  async function readDayFile(date, vault = activePath()) {
    const file = dayPath(date, vault);
    let stat;
    try {
      stat = await fsp.stat(file);
    } catch {
      return [];
    }
    const hit = cache.get(file);
    if (hit !== undefined && hit.mtimeMs === stat.mtimeMs && hit.size === stat.size) {
      return hit.notes;
    }
    let raw;
    try {
      raw = await fsp.readFile(file, 'utf8');
    } catch {
      return [];
    }
    const notes = parseDay(raw, date).map((note) => ({
      id: note.id,
      time: note.time,
      text: note.text,
    }));
    cache.set(file, { mtimeMs: stat.mtimeMs, size: stat.size, notes });
    return notes;
  }

  async function listDayFiles(vault = activePath()) {
    await ensureVault(vault);
    let names = [];
    try {
      names = await fsp.readdir(vault);
    } catch {
      return [];
    }
    return names
      .filter((name) => DAY_FILE.test(name))
      .map((name) => name.slice(0, 10))
      .sort()
      .reverse()
      .slice(0, MAX_FILES);
  }

  async function countAll(dates, vault) {
    let total = 0;
    for (const date of dates) {
      const notes = await readDayFile(date, vault);
      total += notes.length;
    }
    return total;
  }

  async function appendNote(textInput, vaultName) {
    const vault = vaultPath(vaultName);
    const now = new Date();
    const date = ymd(now);
    const time = hhmm(now);
    const text = normalizeText(textInput);
    if (text === '') throw new Error('内容为空');

    return withLock(date, async () => {
      await ensureVault(vault);
      const file = dayPath(date, vault);
      let existing = '';
      try {
        existing = await fsp.readFile(file, 'utf8');
      } catch {
        existing = '';
      }
      if (existing === '') {
        const header = `# ${date} ${weekdayOf(date)}\n\n`;
        await fsp.writeFile(file, header, 'utf8');
        existing = header;
      }
      const block = serializeNote(time, text);
      const needsGap = existing.endsWith('\n') ? '' : '\n';
      await fsp.appendFile(file, `${needsGap}${block}\n`, 'utf8');
      cache.delete(file);
      return { id: noteId(date, time, text), date, time, text };
    });
  }

  async function deleteNote(id, vaultName) {
    if (typeof id !== 'string' || !id.includes('|')) throw new Error('条目 id 不合法');
    const [date, time, hash] = id.split('|');
    if (!DAY_FILE.test(`${date}.md`) || !/^\d{2}:\d{2}$/.test(time ?? '') || !/^[0-9a-f]{8}$/.test(hash ?? '')) {
      throw new Error('条目 id 不合法');
    }
    const vault = vaultPath(vaultName);
    return withLock(date, async () => {
      const file = dayPath(date, vault);
      let raw;
      try {
        raw = await fsp.readFile(file, 'utf8');
      } catch {
        throw new Error('这一天还没有记录');
      }
      const lines = raw.replace(/\r\n?/g, '\n').split('\n');
      const parsed = parseDay(raw, date);
      const target = parsed.find((note) => note.id === id);
      if (target === undefined) throw new Error('这条记录已经不在了，刷新看看');
      const next = [...lines.slice(0, target.start), ...lines.slice(target.end)];
      let text = next.join('\n').replace(/\n{3,}$/, '\n');
      if (!text.endsWith('\n')) text += '\n';
      if (text.trim() === '' || /^# \d{4}-\d{2}-\d{2}[^\n]*\n*$/.test(text)) {
        await fsp.rm(file, { force: true });
      } else {
        await fsp.writeFile(file, text, 'utf8');
      }
      cache.delete(file);
      return { removed: id, date };
    });
  }

  async function editNote(id, textInput, vaultName) {
    if (typeof id !== 'string' || !id.includes('|')) throw new Error('条目 id 不合法');
    const [date, time, hash] = id.split('|');
    if (!DAY_FILE.test(`${date}.md`) || !/^\d{2}:\d{2}$/.test(time ?? '') || !/^[0-9a-f]{8}$/.test(hash ?? '')) {
      throw new Error('条目 id 不合法');
    }
    const text = normalizeText(textInput);
    if (text === '') throw new Error('内容不能为空，想删请用删除');
    const vault = vaultPath(vaultName);
    return withLock(date, async () => {
      const file = dayPath(date, vault);
      let raw;
      try {
        raw = await fsp.readFile(file, 'utf8');
      } catch {
        throw new Error('这一天还没有记录');
      }
      const lines = raw.replace(/\r\n?/g, '\n').split('\n');
      const parsed = parseDay(raw, date);
      const target = parsed.find((note) => note.id === id);
      if (target === undefined) throw new Error('这条记录已经不在了，刷新看看');
      const block = serializeNote(target.time, text).split('\n');
      const next = [...lines.slice(0, target.start), ...block, ...lines.slice(target.end)];
      let output = next.join('\n');
      if (!output.endsWith('\n')) output += '\n';
      await fsp.writeFile(file, output, 'utf8');
      cache.delete(file);
      return { id: noteId(date, target.time, text), date, time: target.time, text };
    });
  }

  async function listDays(limit, before, vaultName) {
    const vault = vaultPath(vaultName);
    const files = await listDayFiles(vault);
    if (files.length === 0) return { days: [], hasMore: false, total: 0 };
    const filtered = before === '' ? files : files.filter((date) => date < before);
    const page = filtered.slice(0, limit);
    const days = [];
    for (const date of page) {
      const notes = await readDayFile(date, vault);
      if (notes.length > 0) {
        days.push({ date, weekday: weekdayOf(date), notes });
      }
    }
    const total = await countAll(files, vault);
    return { days, hasMore: filtered.length > page.length, total };
  }

  async function persistConfig() {
    await fsp.mkdir(path.dirname(configFile), { recursive: true });
    await fsp.writeFile(configFile, `${JSON.stringify({ vaults: state.vaults, active: state.active }, null, 2)}\n`, 'utf8');
  }

  async function saveVaults(nextVaults, nextActive) {
    const normalized = normalizeVaults(nextVaults);
    if (Object.keys(normalized).length === 0) throw new Error('至少保留一个笔记本');
    // 全量校验（all-or-nothing）：任一目录不可写，整个保存被拒绝，配置不变
    for (const [name, vault] of Object.entries(normalized)) {
      await fsp.mkdir(vault, { recursive: true });
      const probe = path.join(vault, `.quick-notes-write-test-${process.pid}`);
      try {
        await fsp.writeFile(probe, 'ok');
        await fsp.unlink(probe);
      } catch (error) {
        throw new Error(`目录「${name}」不可写：${error instanceof Error ? error.message : String(error)}`);
      }
    }
    state.vaults = normalized;
    state.active = typeof nextActive === 'string' && nextActive in normalized
      ? nextActive
      : firstVaultName(normalized);
    cache.clear();
    await persistConfig();
    return { vaults: state.vaults, active: state.active };
  }

  function pickVaultName(wanted) {
    const name = typeof wanted === 'string' ? wanted : '';
    if (name === '') return state.active;
    if (!(name in state.vaults)) throw new Error(`笔记本「${name}」不存在`);
    return name;
  }

  // ---- HTTP ----
  async function handle(req, res) {
    if (req.headers[HEADER] !== '1') {
      sendJson(res, 403, { error: '缺少插件请求头' });
      return;
    }
    const url = new URL(req.url ?? '/', 'http://localhost');
    const sub = url.pathname.slice(ROUTE.length) || '/';
    const method = req.method ?? 'GET';

    if (method === 'GET' && (sub === '/' || sub === '/health')) {
      const vault = activePath();
      const health = await vaultWritable(vault);
      sendJson(res, 200, {
        ok: health.ok,
        reason: health.reason ?? '',
        vault,
        defaultVault,
        configFile,
      });
      return;
    }

    if (method === 'GET' && sub === '/bootstrap') {
      const vault = activePath();
      const health = await vaultWritable(vault);
      const today = ymd(new Date());
      const todayNotes = health.ok ? await readDayFile(today, vault) : [];
      const files = health.ok ? await listDayFiles(vault) : [];
      const total = health.ok ? await countAll(files, vault) : 0;
      sendJson(res, 200, {
        ok: health.ok,
        reason: health.reason ?? '',
        vault,
        vaults: Object.entries(state.vaults).map(([name, path]) => ({ name, path })),
        active: state.active,
        defaultVault,
        configFile,
        today,
        todayCount: todayNotes.length,
        total,
      });
      return;
    }

    if (method === 'GET' && sub === '/days') {
      const limitRaw = Number(url.searchParams.get('limit') ?? '60');
      const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.round(limitRaw), 1), 200) : 60;
      const beforeRaw = url.searchParams.get('before') ?? '';
      const before = DAY_FILE.test(`${beforeRaw}.md`) ? beforeRaw : '';
      const vaultName = pickVaultName(url.searchParams.get('vault'));
      const page = await listDays(limit, before, vaultName);
      sendJson(res, 200, { vault: state.vaults[vaultName], vaultName, ...page });
      return;
    }

    if (method === 'POST' && sub === '/notes') {
      const body = await readBody(req);
      const vaultName = pickVaultName(body?.vault);
      const note = await appendNote(body?.text, vaultName);
      sendJson(res, 200, { ok: true, vault: state.vaults[vaultName], vaultName, note });
      return;
    }

    if (method === 'DELETE' && sub === '/notes') {
      const body = await readBody(req);
      const vaultName = pickVaultName(body?.vault);
      const result = await deleteNote(body?.id, vaultName);
      sendJson(res, 200, { ok: true, vault: state.vaults[vaultName], vaultName, ...result });
      return;
    }

    if (method === 'PATCH' && sub === '/notes') {
      const body = await readBody(req);
      const vaultName = pickVaultName(body?.vault);
      const note = await editNote(body?.id, body?.text, vaultName);
      sendJson(res, 200, { ok: true, vault: state.vaults[vaultName], vaultName, note });
      return;
    }

    if (sub === '/config') {
      if (method === 'GET') {
        sendJson(res, 200, { vaults: state.vaults, active: state.active, defaultVault, configFile });
        return;
      }
      if (method === 'PUT') {
        const body = await readBody(req);
        const result = await saveVaults(body?.vaults, body?.active);
        sendJson(res, 200, { ok: true, ...result, defaultVault, configFile });
        return;
      }
    }

    if (method === 'POST' && sub === '/reveal') {
      const body = await readBody(req);
      const vault = activePath();
      const target = body?.target === 'today' ? 'today' : 'vault';
      await ensureVault(vault);
      if (target === 'today') {
        const date = ymd(new Date());
        const file = dayPath(date, vault);
        try {
          await fsp.access(file);
          await revealInFileManager(file);
        } catch {
          await openPath(vault);
        }
      } else {
        await openPath(vault);
      }
      sendJson(res, 200, { ok: true });
      return;
    }

    sendJson(res, 404, { error: `未知接口 ${method} ${sub}` });
  }

  const serverPlugin = (server) => {
    const register = server?.register ?? ctx.webServer?.register;
    if (typeof register !== 'function') {
      ctx.logger?.warn?.('[quick-notes] webServer 不可用，接口没有注册');
      return;
    }
    register.call(server ?? ctx.webServer, {
      kind: 'prefix',
      path: ROUTE,
      handler: async (req, res) => {
        try {
          await handle(req, res);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          sendJson(res, 400, { error: message });
        }
      },
    });
  };

  if (typeof ctx.inject === 'function') {
    ctx.inject(['webServer'], (scope) => serverPlugin(scope?.webServer));
  } else {
    serverPlugin(ctx.webServer);
  }

  ctx.logger?.info?.(`[quick-notes] 当前笔记本 ${state.active} → ${activePath()}`);
}
