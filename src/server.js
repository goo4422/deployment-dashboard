require("dotenv").config();
const express = require('express');
const si = require('systeminformation');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Jenkins pipeline inject хийсэн өгөгдөл
const DEPLOY_INFO = {
  version:     process.env.APP_VERSION  || 'v1.0.0',
  buildNumber: process.env.BUILD_NUMBER || '1',
  buildDate:   process.env.BUILD_DATE   || new Date().toISOString(),
  gitBranch:   process.env.GIT_BRANCH   || 'main',
  gitCommit:   process.env.GIT_COMMIT   || 'unknown',
  environment: process.env.NODE_ENV     || 'production',
  dockerImage: process.env.DOCKER_IMAGE || 'dashboard:latest',
};

// ── Dashboard HTML — env vars inject хийж serve хийнэ ──
app.get('/', (req, res) => {
  let html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');

  // Template placeholder-уудыг бодит утгаар солино
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

// Static assets
app.use(express.static(path.join(__dirname, '../public')));

// ── API Routes ──────────────────────────────────────

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: Math.floor(process.uptime()), timestamp: new Date().toISOString() });
});

// Deployment info
app.get('/api/deployment', (req, res) => {
  res.json({ ...DEPLOY_INFO, uptime: Math.floor(process.uptime()) });
});

// Server metrics — бодит CPU/Memory/Disk
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

// Pipeline info
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

app.listen(PORT, () => {
  console.log(`✅ Server running → http://localhost:${PORT}`);
  console.log(`📦 Version: ${DEPLOY_INFO.version} | Build: #${DEPLOY_INFO.buildNumber} | Branch: ${DEPLOY_INFO.gitBranch}`);
});

module.exports = app;
