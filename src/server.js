require("dotenv").config();
const express = require('express');
const si = require('systeminformation');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// In-memory metrics ring buffer (max 20 readings)
const metricsHistory = [];

// ── Jenkins pipeline inject хийсэн өгөгдөл ─────────────
const DEPLOY_INFO = {
  version:     process.env.APP_VERSION  || 'v1.0.0',
  buildNumber: process.env.BUILD_NUMBER || '1',
  buildDate:   process.env.BUILD_DATE   || new Date().toISOString(),
  gitBranch:   process.env.GIT_BRANCH   || 'main',
  gitCommit:   process.env.GIT_COMMIT   || 'unknown',
  environment: process.env.NODE_ENV     || 'production',
  dockerImage: process.env.DOCKER_IMAGE || 'dashboard:latest',
};

// ── Data persistence ────────────────────────────────────
const DATA_DIR     = path.join(__dirname, '../data');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
const TASKS_FILE   = path.join(DATA_DIR, 'tasks.json');

function initData() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  if (!fs.existsSync(HISTORY_FILE)) {
    fs.writeFileSync(HISTORY_FILE, '[]');
  }

  if (!fs.existsSync(TASKS_FILE)) {
    const seed = [
      { id: 1, title: 'Docker container тохиргоо шалгах',       priority: 'high',   done: true,  createdAt: new Date().toISOString() },
      { id: 2, title: 'Jenkins pipeline CI/CD тохируулах',       priority: 'high',   done: true,  createdAt: new Date().toISOString() },
      { id: 3, title: 'EC2 серверт автомат deploy хийх',         priority: 'high',   done: true,  createdAt: new Date().toISOString() },
      { id: 4, title: 'Health check endpoint нэмэх',             priority: 'medium', done: true,  createdAt: new Date().toISOString() },
      { id: 5, title: 'Docker volume persistence тохируулах',    priority: 'medium', done: false, createdAt: new Date().toISOString() },
      { id: 6, title: 'Deployment history хадгалах систем нэмэх', priority: 'medium', done: false, createdAt: new Date().toISOString() },
      { id: 7, title: 'Task Manager веб апп нэмэх',              priority: 'low',    done: false, createdAt: new Date().toISOString() },
    ];
    fs.writeFileSync(TASKS_FILE, JSON.stringify(seed, null, 2));
  }

  // Энэ deploy-г history-д бүртгэнэ (давхардуулахгүй)
  const history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
  const alreadyRecorded = history.some(h => h.buildNumber === DEPLOY_INFO.buildNumber);
  if (!alreadyRecorded) {
    history.unshift({
      id:          Date.now(),
      version:     DEPLOY_INFO.version,
      buildNumber: DEPLOY_INFO.buildNumber,
      buildDate:   DEPLOY_INFO.buildDate,
      gitBranch:   DEPLOY_INFO.gitBranch,
      gitCommit:   DEPLOY_INFO.gitCommit.substring(0, 7),
      dockerImage: DEPLOY_INFO.dockerImage,
      environment: DEPLOY_INFO.environment,
      status:      'success',
      deployedAt:  new Date().toISOString(),
    });
    if (history.length > 20) history.splice(20);
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
  }
}

initData();

// ── Page routes ─────────────────────────────────────────
app.get('/', (req, res) => {
  let html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
  html = html
    .replace(/\{\{VERSION\}\}/g,      DEPLOY_INFO.version)
    .replace(/\{\{BUILD_NUMBER\}\}/g,  DEPLOY_INFO.buildNumber)
    .replace(/\{\{BUILD_DATE\}\}/g,    DEPLOY_INFO.buildDate)
    .replace(/\{\{GIT_BRANCH\}\}/g,    DEPLOY_INFO.gitBranch)
    .replace(/\{\{GIT_COMMIT\}\}/g,    DEPLOY_INFO.gitCommit.substring(0, 7))
    .replace(/\{\{ENVIRONMENT\}\}/g,   DEPLOY_INFO.environment)
    .replace(/\{\{DOCKER_IMAGE\}\}/g,  DEPLOY_INFO.dockerImage);
  res.send(html);
});

app.get('/tasks', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/tasks.html'));
});

app.use(express.static(path.join(__dirname, '../public')));

// ── API: Health check ───────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status:    'ok',
    uptime:    Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// ── API: Deployment info ────────────────────────────────
app.get('/api/deployment', (req, res) => {
  res.json({ ...DEPLOY_INFO, uptime: Math.floor(process.uptime()) });
});

// ── API: Server metrics ─────────────────────────────────
app.get('/api/metrics', async (req, res) => {
  try {
    const [cpu, mem, disk] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.fsSize(),
    ]);
    const data = {
      cpu:       { usage: Math.round(cpu.currentLoad), cores: cpu.cpus?.length || 1 },
      memory:    { total: mem.total, used: mem.used, percent: Math.round((mem.used / mem.total) * 100) },
      disk:      { total: disk[0]?.size || 0, used: disk[0]?.used || 0, percent: Math.round(disk[0]?.use || 0) },
      timestamp: new Date().toISOString(),
    };
    metricsHistory.push({ cpu: data.cpu.usage, memory: data.memory.percent, disk: data.disk.percent, t: data.timestamp });
    if (metricsHistory.length > 20) metricsHistory.shift();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch metrics' });
  }
});

// ── API: Metrics history (sparkline data) ───────────────
app.get('/api/metrics/history', (req, res) => {
  res.json(metricsHistory);
});

// ── API: Alerts (threshold-based) ──────────────────────
app.get('/api/alerts', async (req, res) => {
  try {
    const [cpu, mem, disk] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.fsSize(),
    ]);
    const cpuPct  = Math.round(cpu.currentLoad);
    const memPct  = Math.round((mem.used / mem.total) * 100);
    const diskPct = Math.round(disk[0]?.use || 0);

    const alerts = [];
    if      (cpuPct > 90)  alerts.push({ type: 'critical', metric: 'CPU',    value: cpuPct,  message: `CPU хэрэглээ ${cpuPct}% хүрлээ` });
    else if (cpuPct > 70)  alerts.push({ type: 'warning',  metric: 'CPU',    value: cpuPct,  message: `CPU хэрэглээ ${cpuPct}% байна` });
    if      (memPct > 90)  alerts.push({ type: 'critical', metric: 'Memory', value: memPct,  message: `Санах ой ${memPct}% хүрлээ` });
    else if (memPct > 80)  alerts.push({ type: 'warning',  metric: 'Memory', value: memPct,  message: `Санах ой ${memPct}% байна` });
    if      (diskPct > 90) alerts.push({ type: 'critical', metric: 'Disk',   value: diskPct, message: `Диск ${diskPct}% дүүрлээ` });
    else if (diskPct > 80) alerts.push({ type: 'warning',  metric: 'Disk',   value: diskPct, message: `Диск ${diskPct}% байна` });

    res.json({ alerts, count: alerts.length });
  } catch (err) {
    res.json({ alerts: [], count: 0 });
  }
});

// ── API: Pipeline stages ────────────────────────────────
app.get('/api/pipeline', (req, res) => {
  res.json({
    buildNumber: DEPLOY_INFO.buildNumber,
    branch:      DEPLOY_INFO.gitBranch,
    commit:      DEPLOY_INFO.gitCommit.substring(0, 7),
    stages: [
      { name: 'Checkout', status: 'done', duration: '12s' },
      { name: 'Install',  status: 'done', duration: '48s' },
      { name: 'Test',     status: 'done', duration: '1m 22s' },
      { name: 'Build',    status: 'done', duration: '55s' },
      { name: 'Docker',   status: 'done', duration: '1m 05s' },
      { name: 'Deploy',   status: 'done', duration: '30s' },
      { name: 'Health',   status: 'done', duration: '10s' },
    ],
  });
});

// ── API: Deployment history ─────────────────────────────
app.get('/api/history', (req, res) => {
  const history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
  res.json(history);
});

// ── API: Tasks CRUD ─────────────────────────────────────
const readTasks  = () => JSON.parse(fs.readFileSync(TASKS_FILE, 'utf8'));
const writeTasks = (tasks) => fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2));

app.get('/api/tasks', (req, res) => {
  res.json(readTasks());
});

app.post('/api/tasks', (req, res) => {
  const { title, priority = 'medium' } = req.body;
  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'Title is required' });
  }
  const tasks = readTasks();
  const task = {
    id:        Date.now(),
    title:     title.trim(),
    priority,
    done:      false,
    createdAt: new Date().toISOString(),
  };
  tasks.push(task);
  writeTasks(tasks);
  res.status(201).json(task);
});

app.put('/api/tasks/:id', (req, res) => {
  const tasks = readTasks();
  const idx = tasks.findIndex(t => t.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Task not found' });
  const { title, priority, done } = req.body;
  if (title !== undefined) tasks[idx].title = title.trim();
  if (priority !== undefined) tasks[idx].priority = priority;
  if (done !== undefined) tasks[idx].done = Boolean(done);
  writeTasks(tasks);
  res.json(tasks[idx]);
});

app.delete('/api/tasks/:id', (req, res) => {
  const tasks = readTasks();
  const idx = tasks.findIndex(t => t.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Task not found' });
  tasks.splice(idx, 1);
  writeTasks(tasks);
  res.status(204).end();
});

// ── API: Rollback ───────────────────────────────────────
app.get('/api/rollback/candidates', (req, res) => {
  const history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
  // Одоогийн build-аас өмнөх хувилбарууд
  const candidates = history
    .filter(h => h.buildNumber !== DEPLOY_INFO.buildNumber && h.status === 'success')
    .slice(0, 5);
  res.json(candidates);
});

app.post('/api/rollback/:buildNumber', (req, res) => {
  const history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
  const target = history.find(h => h.buildNumber === req.params.buildNumber);
  if (!target) return res.status(404).json({ error: 'Build not found in history' });

  // Rollback event-г history-д бүртгэнэ
  history.unshift({
    id:          Date.now(),
    version:     target.version,
    buildNumber: target.buildNumber,
    buildDate:   target.buildDate,
    gitBranch:   target.gitBranch,
    gitCommit:   target.gitCommit,
    dockerImage: target.dockerImage,
    environment: target.environment,
    status:      'success',
    deployedAt:  new Date().toISOString(),
    rollback:    true,
    rolledBackFrom: DEPLOY_INFO.buildNumber,
  });
  if (history.length > 20) history.splice(20);
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));

  res.json({
    message:  `Rollback to ${target.version} (Build #${target.buildNumber}) initiated`,
    target,
    dockerImage: target.dockerImage,
  });
});

// ── Start ───────────────────────────────────────────────
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`✅ Server running → http://localhost:${PORT}`);
    console.log(`📦 Version: ${DEPLOY_INFO.version} | Build: #${DEPLOY_INFO.buildNumber} | Branch: ${DEPLOY_INFO.gitBranch}`);
  });
}

module.exports = app;
