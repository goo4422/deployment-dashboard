require("dotenv").config();
const express = require('express');
const si      = require('systeminformation');
const fs      = require('fs');
const path    = require('path');
const { exec } = require('child_process');

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

function initData() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  if (!fs.existsSync(HISTORY_FILE)) {
    fs.writeFileSync(HISTORY_FILE, '[]');
  }

  // Энэ deploy-г history-д бүртгэнэ (давхардуулахгүй)
  let history;
  try {
    history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
    if (!Array.isArray(history)) throw new Error('invalid');
  } catch {
    history = [];
    fs.writeFileSync(HISTORY_FILE, '[]');
  }
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
      { name: 'Checkout', status: 'done' },
      { name: 'Install',  status: 'done' },
      { name: 'Test',     status: 'done' },
      { name: 'Build',    status: 'done' },
      { name: 'Docker',   status: 'done' },
      { name: 'Deploy',   status: 'done' },
      { name: 'Health',   status: 'done' },
    ],
  });
});

// ── API: System info (бодит өгөгдөл) ───────────────────
app.get('/api/sysinfo', async (req, res) => {
  try {
    const [osInfo, nodeVersion] = await Promise.all([
      si.osInfo(),
      Promise.resolve(process.version),
    ]);
    res.json({
      hostname: osInfo.hostname || 'unknown',
      os:       `${osInfo.distro} ${osInfo.release}`,
      arch:     osInfo.arch,
      node:     nodeVersion,
      env:      DEPLOY_INFO.environment,
    });
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch system info' });
  }
});

// ── Туслах: history.json найдвартай унших ───────────────
function readHistory() {
  try {
    const data = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

// ── API: Deployment history ─────────────────────────────
app.get('/api/history', (req, res) => {
  res.json(readHistory());
});

// ── API: Rollback ───────────────────────────────────────
app.get('/api/rollback/candidates', (req, res) => {
  const candidates = readHistory()
    .filter(h => h.buildNumber !== DEPLOY_INFO.buildNumber && h.status === 'success')
    .slice(0, 5);
  res.json(candidates);
});

// Docker image нэрний хүчинтэй формат: namespace/name:tag
const VALID_IMAGE = /^[a-z0-9]([a-z0-9._/-]*[a-z0-9])?(:[a-zA-Z0-9._-]+)?$/;

app.post('/api/rollback/:buildNumber', (req, res) => {
  if (!/^\d+$/.test(req.params.buildNumber)) {
    return res.status(400).json({ error: 'Invalid build number' });
  }
  const history = readHistory();
  const target = history.find(h => h.buildNumber === req.params.buildNumber);
  if (!target) return res.status(404).json({ error: 'Build not found in history' });

  // History-д rollback бүртгэнэ
  history.unshift({
    id:             Date.now(),
    version:        target.version,
    buildNumber:    target.buildNumber,
    buildDate:      target.buildDate,
    gitBranch:      target.gitBranch,
    gitCommit:      target.gitCommit,
    dockerImage:    target.dockerImage,
    environment:    target.environment,
    status:         'success',
    deployedAt:     new Date().toISOString(),
    rollback:       true,
    rolledBackFrom: DEPLOY_INFO.buildNumber,
  });
  if (history.length > 20) history.splice(20);
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));

  // Response-г эхлээд илгээнэ — дараа нь container солино
  res.json({
    message:     `Rollback to ${target.version} (Build #${target.buildNumber}) эхэллээ — 3 секундын дараа дахин ачааллана`,
    target,
    dockerImage: target.dockerImage,
  });

  // 3 секундын дараа Docker container-г бодитоор солино
  setTimeout(() => {
    const image = target.dockerImage;
    if (!VALID_IMAGE.test(image)) {
      console.error('[Rollback] Буруу image нэр:', image);
      return;
    }
    const cmd = [
      `docker pull ${image}`,
      `docker stop dashboard-app || true`,
      `docker rm   dashboard-app || true`,
      `docker run -d --name dashboard-app --restart unless-stopped` +
        ` -p 3000:3000` +
        ` -v dashboard-data:/app/data` +
        ` -v /var/run/docker.sock:/var/run/docker.sock` +
        ` -e APP_VERSION=${target.version}` +
        ` -e BUILD_NUMBER=${target.buildNumber}` +
        ` -e GIT_BRANCH=${target.gitBranch || 'main'}` +
        ` -e GIT_COMMIT=${target.gitCommit || 'unknown'}` +
        ` -e NODE_ENV=production` +
        ` -e DOCKER_IMAGE=${image}` +
        ` ${image}`,
    ].join(' && ');

    console.log(`[Rollback] ${target.version} (${image}) руу буцаж байна...`);
    exec(cmd, (err) => {
      if (err) console.error('[Rollback] Алдаа:', err.message);
      else     console.log('[Rollback] Амжилттай:', image);
    });
  }, 3000);
});

// ── API: Restart ────────────────────────────────────────
app.post('/api/restart', (req, res) => {
  console.log('[Restart] Container дахин ачаалж байна...');

  res.json({ message: 'Апп дахин ачаалж байна — 5 секундын дараа дахин холбогдоно' });

  if (process.env.NODE_ENV !== 'test') {
    setTimeout(() => {
      exec('docker restart dashboard-app', (err) => {
        if (err) console.error('[Restart] Алдаа:', err.message);
        else     console.log('[Restart] Амжилттай дахин ачааллаа');
      });
    }, 1000);
  }
});

// ── Start ───────────────────────────────────────────────
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`✅ Server running → http://localhost:${PORT}`);
    console.log(`📦 Version: ${DEPLOY_INFO.version} | Build: #${DEPLOY_INFO.buildNumber} | Branch: ${DEPLOY_INFO.gitBranch}`);
  });
}

module.exports = app;
