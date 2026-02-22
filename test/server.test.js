const request = require('supertest');
const app = require('../src/server');

describe('Deployment Dashboard API', () => {

  test('GET /health → 200 ok', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  test('GET /api/deployment → version info байна', async () => {
    const res = await request(app).get('/api/deployment');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('version');
    expect(res.body).toHaveProperty('buildNumber');
    expect(res.body).toHaveProperty('gitBranch');
  });

  test('GET /api/pipeline → stages байна', async () => {
    const res = await request(app).get('/api/pipeline');
    expect(res.statusCode).toBe(200);
    expect(res.body.stages).toHaveLength(7);
  });

  test('GET /api/metrics → cpu, memory, disk байна', async () => {
    const res = await request(app).get('/api/metrics');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('cpu');
    expect(res.body).toHaveProperty('memory');
    expect(res.body).toHaveProperty('disk');
  });

});
