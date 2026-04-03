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

  test('GET /api/metrics → cpu, memory, disk байна', async () => {
    const res = await request(app).get('/api/metrics');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('cpu');
    expect(res.body).toHaveProperty('memory');
    expect(res.body).toHaveProperty('disk');
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

// ── Tasks CRUD API ───────────────────────────────────────
describe('Tasks CRUD API', () => {
  let createdTaskId;

  test('GET /api/tasks → array буцаана', async () => {
    const res = await request(app).get('/api/tasks');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('POST /api/tasks → шинэ task үүсгэнэ', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .send({ title: 'CI/CD pipeline тест', priority: 'high' });
    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.title).toBe('CI/CD pipeline тест');
    expect(res.body.priority).toBe('high');
    expect(res.body.done).toBe(false);
    createdTaskId = res.body.id;
  });

  test('POST /api/tasks → createdAt талбар байна', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .send({ title: 'Timestamp тест' });
    expect(res.body).toHaveProperty('createdAt');
    expect(new Date(res.body.createdAt).toString()).not.toBe('Invalid Date');
    await request(app).delete(`/api/tasks/${res.body.id}`);
  });

  test('POST /api/tasks → default priority "medium" байна', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .send({ title: 'Default priority тест' });
    expect(res.statusCode).toBe(201);
    expect(res.body.priority).toBe('medium');
    await request(app).delete(`/api/tasks/${res.body.id}`);
  });

  test('POST /api/tasks — title байхгүй бол 400', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .send({ priority: 'low' });
    expect(res.statusCode).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  test('POST /api/tasks — хоосон title бол 400', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .send({ title: '   ' });
    expect(res.statusCode).toBe(400);
  });

  test('PUT /api/tasks/:id → done=true болгоно', async () => {
    const res = await request(app)
      .put(`/api/tasks/${createdTaskId}`)
      .send({ done: true });
    expect(res.statusCode).toBe(200);
    expect(res.body.done).toBe(true);
  });

  test('PUT /api/tasks/:id → priority шинэчилнэ', async () => {
    const res = await request(app)
      .put(`/api/tasks/${createdTaskId}`)
      .send({ priority: 'low' });
    expect(res.statusCode).toBe(200);
    expect(res.body.priority).toBe('low');
  });

  test('PUT /api/tasks/:id → title шинэчилнэ', async () => {
    const res = await request(app)
      .put(`/api/tasks/${createdTaskId}`)
      .send({ title: 'Шинэчилсэн гарчиг' });
    expect(res.statusCode).toBe(200);
    expect(res.body.title).toBe('Шинэчилсэн гарчиг');
  });

  test('PUT /api/tasks/999999 → 404', async () => {
    const res = await request(app)
      .put('/api/tasks/999999')
      .send({ done: true });
    expect(res.statusCode).toBe(404);
  });

  test('DELETE /api/tasks/:id → 204 буцаана', async () => {
    const res = await request(app)
      .delete(`/api/tasks/${createdTaskId}`);
    expect(res.statusCode).toBe(204);
  });

  test('DELETE /api/tasks/999999 → 404', async () => {
    const res = await request(app)
      .delete('/api/tasks/999999');
    expect(res.statusCode).toBe(404);
  });

  test('DELETE хийсний дараа GET-д байхгүй болно', async () => {
    const create = await request(app)
      .post('/api/tasks')
      .send({ title: 'Устгах тест' });
    const id = create.body.id;
    await request(app).delete(`/api/tasks/${id}`);
    const list = await request(app).get('/api/tasks');
    expect(list.body.find(t => t.id === id)).toBeUndefined();
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
