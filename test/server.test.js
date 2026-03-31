const request = require('supertest');
const app = require('../src/server');

describe('Deployment Dashboard API', () => {

  test('GET /health → 200 ok', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body).toHaveProperty('uptime');
    expect(res.body).toHaveProperty('timestamp');
  });

  test('GET /api/deployment → version info байна', async () => {
    const res = await request(app).get('/api/deployment');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('version');
    expect(res.body).toHaveProperty('buildNumber');
    expect(res.body).toHaveProperty('gitBranch');
    expect(res.body).toHaveProperty('uptime');
  });

  test('GET /api/pipeline → 7 stages байна', async () => {
    const res = await request(app).get('/api/pipeline');
    expect(res.statusCode).toBe(200);
    expect(res.body.stages).toHaveLength(7);
    expect(res.body).toHaveProperty('buildNumber');
    expect(res.body).toHaveProperty('branch');
  });

  test('GET /api/metrics → cpu, memory, disk байна', async () => {
    const res = await request(app).get('/api/metrics');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('cpu');
    expect(res.body).toHaveProperty('memory');
    expect(res.body).toHaveProperty('disk');
  });

  test('GET /api/history → array буцаана', async () => {
    const res = await request(app).get('/api/history');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

});

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
      .send({ title: 'Test task for CI/CD', priority: 'high' });
    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.title).toBe('Test task for CI/CD');
    expect(res.body.priority).toBe('high');
    expect(res.body.done).toBe(false);
    createdTaskId = res.body.id;
  });

  test('POST /api/tasks — title байхгүй бол 400 алдаа', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .send({ priority: 'low' });
    expect(res.statusCode).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  test('POST /api/tasks — хоосон title бол 400 алдаа', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .send({ title: '   ' });
    expect(res.statusCode).toBe(400);
  });

  test('PUT /api/tasks/:id → task шинэчилнэ (done=true)', async () => {
    const res = await request(app)
      .put(`/api/tasks/${createdTaskId}`)
      .send({ done: true });
    expect(res.statusCode).toBe(200);
    expect(res.body.done).toBe(true);
  });

  test('PUT /api/tasks/:id → task шинэчилнэ (priority)', async () => {
    const res = await request(app)
      .put(`/api/tasks/${createdTaskId}`)
      .send({ priority: 'low' });
    expect(res.statusCode).toBe(200);
    expect(res.body.priority).toBe('low');
  });

  test('PUT /api/tasks/999999 → 404 алдаа', async () => {
    const res = await request(app)
      .put('/api/tasks/999999')
      .send({ done: true });
    expect(res.statusCode).toBe(404);
  });

  test('DELETE /api/tasks/:id → task устгана', async () => {
    const res = await request(app)
      .delete(`/api/tasks/${createdTaskId}`);
    expect(res.statusCode).toBe(204);
  });

  test('DELETE /api/tasks/999999 → 404 алдаа', async () => {
    const res = await request(app)
      .delete('/api/tasks/999999');
    expect(res.statusCode).toBe(404);
  });

});
