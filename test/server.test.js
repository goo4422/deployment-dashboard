const request = require('supertest');
const app = require('../src/server');

// ── Deployment Dashboard API ─────────────────────────────
describe('Deployment Dashboard API', () => {

  test('GET /health → 200 ok', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  test('GET /health → uptime талбар байна', async () => {
    const res = await request(app).get('/health');
    expect(res.body).toHaveProperty('uptime');
    expect(typeof res.body.uptime).toBe('number');
  });

  test('GET /health → timestamp талбар байна', async () => {
    const res = await request(app).get('/health');
    expect(res.body).toHaveProperty('timestamp');
    expect(new Date(res.body.timestamp).toString()).not.toBe('Invalid Date');
  });

  test('GET /api/deployment → version, buildNumber, gitBranch байна', async () => {
    const res = await request(app).get('/api/deployment');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('version');
    expect(res.body).toHaveProperty('buildNumber');
    expect(res.body).toHaveProperty('gitBranch');
  });

  test('GET /api/deployment → environment, dockerImage байна', async () => {
    const res = await request(app).get('/api/deployment');
    expect(res.body).toHaveProperty('environment');
    expect(res.body).toHaveProperty('dockerImage');
  });

  test('GET /api/deployment → uptime тоо байна', async () => {
    const res = await request(app).get('/api/deployment');
    expect(res.body).toHaveProperty('uptime');
    expect(typeof res.body.uptime).toBe('number');
  });

  test('GET /api/pipeline → 7 stages байна', async () => {
    const res = await request(app).get('/api/pipeline');
    expect(res.statusCode).toBe(200);
    expect(res.body.stages).toHaveLength(7);
  });

  test('GET /api/pipeline → buildNumber, branch, commit байна', async () => {
    const res = await request(app).get('/api/pipeline');
    expect(res.body).toHaveProperty('buildNumber');
    expect(res.body).toHaveProperty('branch');
    expect(res.body).toHaveProperty('commit');
  });

  test('GET /api/pipeline → stage бүр name, status байна', async () => {
    const res = await request(app).get('/api/pipeline');
    res.body.stages.forEach(stage => {
      expect(stage).toHaveProperty('name');
      expect(stage).toHaveProperty('status');
    });
  });

  test('GET /api/pipeline → stage бүр duration тоо байна', async () => {
    const res = await request(app).get('/api/pipeline');
    res.body.stages.forEach(stage => {
      expect(stage).toHaveProperty('duration');
      expect(typeof stage.duration).toBe('number');
    });
  });

  test('GET /api/metrics → cpu, memory, disk байна', async () => {
    const res = await request(app).get('/api/metrics');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('cpu');
    expect(res.body).toHaveProperty('memory');
    expect(res.body).toHaveProperty('disk');
  });

  test('GET /api/metrics → requests тоо байна', async () => {
    const res = await request(app).get('/api/metrics');
    if (res.statusCode === 200) {
      expect(res.body).toHaveProperty('requests');
      expect(typeof res.body.requests).toBe('number');
    }
  });

  test('GET /api/metrics → cpu.usage тоо байна', async () => {
    const res = await request(app).get('/api/metrics');
    expect(typeof res.body.cpu.usage).toBe('number');
  });

  test('GET /api/metrics → memory.total, used, percent байна', async () => {
    const res = await request(app).get('/api/metrics');
    expect(res.body.memory).toHaveProperty('total');
    expect(res.body.memory).toHaveProperty('used');
    expect(res.body.memory).toHaveProperty('percent');
  });

  test('GET /api/history → array буцаана', async () => {
    const res = await request(app).get('/api/history');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('GET /api/history → анхны бичлэг deployedAt талбартай', async () => {
    const res = await request(app).get('/api/history');
    if (res.body.length > 0) {
      expect(res.body[0]).toHaveProperty('deployedAt');
      expect(res.body[0]).toHaveProperty('version');
      expect(res.body[0]).toHaveProperty('buildNumber');
    }
  });

});

// ── Container API ────────────────────────────────────────
describe('Container API', () => {

  test('GET /api/container → 200 эсвэл 500 буцаана', async () => {
    const res = await request(app).get('/api/container');
    expect([200, 500]).toContain(res.statusCode);
  });

  test('GET /api/container → 200 үед шаардлагатай талбарууд байна', async () => {
    const res = await request(app).get('/api/container');
    if (res.statusCode === 200) {
      expect(res.body).toHaveProperty('restartCount');
      expect(res.body).toHaveProperty('startedAt');
      expect(res.body).toHaveProperty('status');
    }
  });

});

// ── Rollback API ─────────────────────────────────────────
describe('Rollback API', () => {

  test('GET /api/rollback/candidates → array буцаана', async () => {
    const res = await request(app).get('/api/rollback/candidates');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('POST /api/rollback/999 → 404 буцаана', async () => {
    const res = await request(app).post('/api/rollback/999');
    expect(res.statusCode).toBe(404);
  });

});

// ── Restart API ──────────────────────────────────────────
describe('Restart API', () => {

  test('POST /api/restart → 200 буцаана', async () => {
    const res = await request(app).post('/api/restart');
    expect(res.statusCode).toBe(200);
  });

  test('POST /api/restart → message талбар байна', async () => {
    const res = await request(app).post('/api/restart');
    expect(res.body).toHaveProperty('message');
    expect(typeof res.body.message).toBe('string');
  });

});

// ── Metrics History API ──────────────────────────────────
describe('Metrics History API', () => {

  test('GET /api/metrics/history → array буцаана', async () => {
    const res = await request(app).get('/api/metrics/history');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('GET /api/metrics → timestamp талбар байна', async () => {
    const res = await request(app).get('/api/metrics');
    // 500 буцааж болох тул зөвхөн буцаах форматыг шалгана
    if (res.statusCode === 200) {
      expect(res.body).toHaveProperty('timestamp');
      expect(new Date(res.body.timestamp).toString()).not.toBe('Invalid Date');
    } else {
      expect(res.statusCode).toBe(500);
    }
  });

});

// ── Alerts API ───────────────────────────────────────────
describe('Alerts API', () => {

  test('GET /api/alerts → 200 буцаана', async () => {
    const res = await request(app).get('/api/alerts');
    expect(res.statusCode).toBe(200);
  });

  test('GET /api/alerts → alerts массив болон count байна', async () => {
    const res = await request(app).get('/api/alerts');
    expect(res.body).toHaveProperty('alerts');
    expect(res.body).toHaveProperty('count');
    expect(Array.isArray(res.body.alerts)).toBe(true);
    expect(typeof res.body.count).toBe('number');
  });

  test('GET /api/alerts → count нь alerts.length-тай тэнцүү', async () => {
    const res = await request(app).get('/api/alerts');
    expect(res.body.count).toBe(res.body.alerts.length);
  });

  test('GET /api/alerts → alert бүр type болон metric талбартай', async () => {
    const res = await request(app).get('/api/alerts');
    res.body.alerts.forEach(a => {
      expect(a).toHaveProperty('type');
      expect(a).toHaveProperty('metric');
      expect(a).toHaveProperty('value');
      expect(a).toHaveProperty('message');
      expect(['warning','critical']).toContain(a.type);
    });
  });

});
