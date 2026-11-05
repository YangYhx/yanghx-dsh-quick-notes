/**
 * 宿主端冒烟测试：不启动 DeepSeek，直接伪造 cordis ctx + HTTP req/res，
 * 覆盖 迁移旧配置 → 写笔记 → 加笔记本 → 笔记本隔离 → 切换 → 重命名 → 移除 → 校验失败。
 *
 *   node dev/smoke.mjs
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';

const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'quick-notes-home-'));
const vaultDefault = path.join(tmpHome, 'default');
const vaultWork = path.join(tmpHome, 'work');
process.env.DSH_HOME = tmpHome;

// 旧格式配置：apply 时应当自动迁移成 {vaults:{默认}, active:默认}
fs.mkdirSync(path.join(tmpHome, 'quick-notes'), { recursive: true });
fs.writeFileSync(path.join(tmpHome, 'quick-notes', 'config.json'), JSON.stringify({ vault: vaultDefault }));

const { apply } = await import('../index.js');

const routes = [];
const ctx = {
  inject(deps, cb) {
    if (deps.includes('webServer')) cb({ webServer: { register(cfg) { routes.push(cfg); return () => {}; } } });
  },
  effect(fn) {
    const dispose = fn();
    return typeof dispose === 'function' ? dispose : () => {};
  },
  logger: { info() {}, warn() {}, error() {} },
};

apply(ctx, {});

if (routes.length !== 1) throw new Error(`期望注册 1 条路由，实际 ${routes.length}`);
const route = routes[0];
if (route.path !== '/api/quick-notes') throw new Error(`路由路径不对：${route.path}`);

function call(method, sub, body) {
  return new Promise((resolve, reject) => {
    const req = new EventEmitter();
    req.method = method;
    req.url = `/api/quick-notes${sub}`;
    req.headers = { 'x-dsh-quick-notes': '1' };
    const res = {
      statusCode: 200,
      headers: {},
      setHeader(key, value) { this.headers[key] = value; },
      end(text) {
        let data = null;
        try { data = JSON.parse(text); } catch { data = text; }
        resolve({ status: this.statusCode, data });
      },
    };
    route.handler(req, res).catch(reject);
    if (body !== undefined) req.emit('data', Buffer.from(JSON.stringify(body)));
    req.emit('end');
  });
}

let failures = 0;
function check(label, condition, extra) {
  if (condition) {
    console.log(`  ok  ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${label}`, extra ?? '');
  }
}

console.log('1) 旧配置自动迁移');
const boot0 = await call('GET', '/bootstrap');
check('vaults 只有一个「默认」', boot0.status === 200 && boot0.data.vaults.length === 1 && boot0.data.vaults[0].name === '默认', boot0.data);
check('默认路径指向旧配置目录', boot0.data.vaults[0].path === vaultDefault, boot0.data.vaults);
check('active = 默认', boot0.data.active === '默认');
const migrated = JSON.parse(fs.readFileSync(path.join(tmpHome, 'quick-notes', 'config.json'), 'utf8'));
check('迁移后已落盘新格式', migrated.vaults && migrated.vaults.默认 === vaultDefault && migrated.active === '默认', migrated);

console.log('2) 默认笔记本写一条');
const first = await call('POST', '/notes', { text: '默认里的一条' });
check('写入成功', first.status === 200 && typeof first.data.note.id === 'string', first.data);
check('响应带 vaultName=默认', first.data.vaultName === '默认');

console.log('3) 新增笔记本「工作」');
const added = await call('PUT', '/config', { vaults: { 默认: vaultDefault, 工作: vaultWork }, active: '默认' });
check('保存成功', added.status === 200 && added.data.vaults.工作 === vaultWork, added.data);
check('config 落盘', fs.existsSync(path.join(tmpHome, 'quick-notes', 'config.json')));
check('工作目录已创建', fs.existsSync(vaultWork));

console.log('4) 笔记本隔离');
const toWork = await call('POST', '/notes', { text: '工作里的一条', vault: '工作' });
check('写入工作成功', toWork.status === 200 && toWork.data.vaultName === '工作', toWork.data);
const dayDefault = await call('GET', '/days');
check('默认列表只有默认那条', dayDefault.data.days[0]?.notes.length === 1 && dayDefault.data.days[0].notes[0].text.includes('默认里的一条'), dayDefault.data);
const dayWork = await call('GET', '/days?vault=工作');
check('工作列表只有工作那条', dayWork.data.days[0]?.notes.length === 1 && dayWork.data.days[0].notes[0].text.includes('工作里的一条'), dayWork.data);
const workMd = fs.readdirSync(vaultWork).find((n) => n.endsWith('.md'));
check('工作文件在 work 目录', workMd !== undefined && fs.existsSync(path.join(vaultWork, workMd)));

console.log('5) 切换当前笔记本');
const switched = await call('PUT', '/config', { vaults: { 默认: vaultDefault, 工作: vaultWork }, active: '工作' });
check('active=工作', switched.status === 200 && switched.data.active === '工作');
const postNoVault = await call('POST', '/notes', { text: '切到工作后默认写入工作' });
check('不带 vault 的写入落到当前笔记本', postNoVault.data.vaultName === '工作', postNoVault.data);
const daysAfter = await call('GET', '/days');
check('当前列表=工作，两条', daysAfter.data.days[0]?.notes.length === 2, daysAfter.data);

console.log('6) 重命名「工作」→「生活」');
const renamed = await call('PUT', '/config', { vaults: { 默认: vaultDefault, 生活: vaultWork }, active: '生活' });
check('重命名成功', renamed.status === 200 && renamed.data.vaults.生活 === vaultWork && !('工作' in renamed.data.vaults), renamed.data);
const lifeDays = await call('GET', '/days?vault=生活');
check('旧数据还在（只是改名）', lifeDays.data.days[0]?.notes.length === 2, lifeDays.data);

console.log('7) 移除笔记本（不删文件）');
const removed = await call('PUT', '/config', { vaults: { 默认: vaultDefault }, active: '默认' });
check('移除成功', removed.status === 200 && Object.keys(removed.data.vaults).length === 1);
check('被移除目录文件仍在', fs.existsSync(vaultWork) && fs.readdirSync(vaultWork).some((n) => n.endsWith('.md')));

console.log('8) 校验失败（active 指向不存在的名字 → 自动回退）');
const fallback = await call('PUT', '/config', { vaults: { 默认: vaultDefault }, active: '不存在的' });
check('active 回退到默认', fallback.status === 200 && fallback.data.active === '默认', fallback.data);

console.log('9) 校验失败（空笔记本表 → 拒绝）');
const empty = await call('PUT', '/config', { vaults: {}, active: '默认' });
check('空表被拒', empty.status >= 400, empty.data);
const cfgNow = JSON.parse(fs.readFileSync(path.join(tmpHome, 'quick-notes', 'config.json'), 'utf8'));
check('配置未变', cfgNow.vaults.默认 === vaultDefault && Object.keys(cfgNow.vaults).length === 1, cfgNow);

console.log('10) 校验失败（目录不可写 → 全量拒绝）');
const deadFile = path.join(tmpHome, 'not-a-dir.txt');
fs.writeFileSync(deadFile, 'x');
const bad = await call('PUT', '/config', { vaults: { 默认: vaultDefault, 坏: deadFile }, active: '默认' });
check('坏目录被拒', bad.status >= 400, bad.data);
const cfgAfter = JSON.parse(fs.readFileSync(path.join(tmpHome, 'quick-notes', 'config.json'), 'utf8'));
check('配置未变', Object.keys(cfgAfter.vaults).length === 1 && !('坏' in cfgAfter.vaults), cfgAfter);

console.log('11) 编辑条目');
const editSource = await call('GET', '/days?vault=默认');
const editTarget = editSource.data.days[0].notes[0];
const edited = await call('PATCH', '/notes', { id: editTarget.id, text: '默认里的一条（改过）\n第二行', vault: '默认' });
check('编辑成功', edited.status === 200 && edited.data.note.text.includes('改过'), edited.data);
check('时间保留', edited.data.note.time === editTarget.time, edited.data.note);
check('新 id 与旧不同', edited.data.note.id !== editTarget.id, edited.data.note.id);
const defaultMd = fs.readdirSync(vaultDefault).find((n) => n.endsWith('.md'));
const mdBody = fs.readFileSync(path.join(vaultDefault, defaultMd), 'utf8');
check('文件已更新（含续行缩进）', mdBody.includes('默认里的一条（改过）') && mdBody.includes('  第二行'), mdBody);
const editedAgain = await call('GET', '/days?vault=默认');
check('列表里是改后内容', editedAgain.data.days[0].notes[0].text === '默认里的一条（改过）\n第二行', editedAgain.data.days[0].notes[0]);
const emptyEdit = await call('PATCH', '/notes', { id: edited.data.note.id, text: '   ', vault: '默认' });
check('空内容被拒', emptyEdit.status >= 400, emptyEdit.data);
const ghostEdit = await call('PATCH', '/notes', { id: '2026-01-01|10:00|deadbeef', text: 'x', vault: '默认' });
check('不存在的条目被拒', ghostEdit.status >= 400, ghostEdit.data);

console.log('12) 删除按笔记本定位');
const delId = edited.data.note.id;
const del = await call('DELETE', '/notes', { id: delId, vault: '默认' });
check('删除默认那条成功', del.status === 200, del.data);
const afterDel = await call('GET', '/days?vault=默认');
check('默认现在为空', afterDel.data.total === 0, afterDel.data);

console.log('13) 鉴权');
const denied = await new Promise((resolve) => {
  const req = new EventEmitter();
  req.method = 'GET';
  req.url = '/api/quick-notes/health';
  req.headers = {};
  const res = { statusCode: 200, setHeader() {}, end(text) { resolve(JSON.parse(text)); } };
  route.handler(req, res);
});
check('缺请求头被拒', denied.error !== undefined, denied);

console.log(failures === 0 ? '\n全部通过' : `\n${failures} 项失败`);
process.exit(failures === 0 ? 0 : 1);
