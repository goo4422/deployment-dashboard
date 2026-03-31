require("dotenv").config();
const express = require('express');
const si = require('systeminformation');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

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
    res.json({
      cpu:    { usage: Math.round(cpu.currentLoad), cores: cpu.cpus?.length || 1 },
      memory: { total: mem.total, used: mem.used, percent: Math.round((mem.used / mem.total) * 100) },
      disk:   { total: disk[0]?.size || 0, used: disk[0]?.used || 0, percent: Math.round(disk[0]?.use || 0) },
    });
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch metrics' });
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

// ── Start ───────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ Server running → http://localhost:${PORT}`);
  console.log(`📦 Version: ${DEPLOY_INFO.version} | Build: #${DEPLOY_INFO.buildNumber} | Branch: ${DEPLOY_INFO.gitBranch}`);
});

module.exports = app;
