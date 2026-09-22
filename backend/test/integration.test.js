import { fileURLToPath } from 'node:url';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { io as client } from 'socket.io-client';
import { createAppServer } from '../src/server.js';
import { User } from '../src/models/user.model.js';
let db, server, io, base;
before(async () => {
  db = await MongoMemoryServer.create({binary:{downloadDir:fileURLToPath(new URL('../node_modules/.cache/mongodb-memory-server/',import.meta.url))}});
  await mongoose.connect(db.getUri(), {
    dbName: 'gatherly-test'
  });
  await User.init();
  ({
    server,
    io
  } = createAppServer());
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  if (io) await new Promise(resolve => io.close(resolve));
  await mongoose.disconnect();
  await db?.stop();
});
async function request(path, method = 'GET', body, token) {
  const response = await fetch(base + '/api/v1/users' + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? {
        Authorization: `Bearer ${token}`
      } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  return {
    status: response.status,
    data: response.status === 204 ? null : await response.json()
  };
}
test('registration, login, protected history, isolation, expiry and logout', async () => {
  assert.equal((await request('/register', 'POST', {})).status, 400);
  assert.equal((await request('/register', 'POST', {
    name: 'Test User',
    username: 'testuser',
    password: 'testing123'
  })).status, 201);
  assert.equal((await request('/register', 'POST', {
    name: 'Test User',
    username: 'testuser',
    password: 'testing123'
  })).status, 409);
  assert.equal((await request('/login', 'POST', {
    username: 'testuser',
    password: 'wrong'
  })).status, 401);
  assert.equal((await request('/login', 'POST', {})).status, 400);
  const login = await request('/login', 'POST', {
    username: 'TESTUSER',
    password: 'testing123'
  });
  assert.equal(login.status, 200);
  const token = login.data.token;
  assert.equal((await request('/me', 'GET', undefined, token)).data.name, 'Test User');
  assert.equal((await request('/get_all_activity')).status, 401);
  assert.equal((await request('/get_all_activity?token=bad')).status, 401);
  assert.equal((await request('/get_all_activity', 'GET', undefined, 'a'.repeat(40))).status, 401);
  assert.equal((await request('/add_to_activity', 'POST', {
    meeting_code: 'bad code'
  }, token)).status, 400);
  assert.equal((await request('/add_to_activity', 'POST', {
    meeting_code: 'room-test'
  }, token)).status, 201);
  const history = await request('/get_all_activity', 'GET', undefined, token);
  assert.equal(history.status, 200);
  assert.equal(history.data.length, 1);
  assert.equal(history.data[0].meetingCode, 'room-test');
  await request('/register', 'POST', {
    name: 'Second',
    username: 'second',
    password: 'testing123'
  });
  const other = (await request('/login', 'POST', {
    username: 'second',
    password: 'testing123'
  })).data.token;
  assert.deepEqual((await request('/get_all_activity', 'GET', undefined, other)).data, []);
  await User.updateOne({
    username: 'second'
  }, {
    $set: {
      tokenExpiresAt: new Date(0)
    }
  });
  assert.equal((await request('/me', 'GET', undefined, other)).status, 401);
  assert.equal((await request('/logout', 'POST', {}, token)).status, 204);
  assert.equal((await request('/me', 'GET', undefined, token)).status, 401);
});
const event = (socket, name) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('Timeout: ' + name)), 4000);
  socket.once(name, (...args) => {
    clearTimeout(timer);
    resolve(args);
  });
});
const ack = (socket, name, ...args) => new Promise((resolve, reject) => socket.timeout(4000).emit(name, ...args, (error, result) => error ? reject(error) : resolve(result)));
test('meeting participants, scoped signaling/chat, reconnect and room cleanup', async () => {
  const sockets = [];
  try {
    for (let n = 0; n < 3; n++) {
      const socket = client(base, {
        autoConnect: false
      });
      sockets.push(socket);
      const connected = event(socket, 'connect');
      socket.connect();
      await connected;
    }
    const [a, b, c] = sockets;
    assert.ok((await ack(a, 'join-call', {
      code: 'bad code',
      username: 'Alice'
    })).error);
    assert.deepEqual((await ack(a, 'join-call', {
      code: 'room-one',
      username: 'Alice'
    })).peers, []);
    const joined = event(a, 'user-joined');
    const state = await ack(b, 'join-call', {
      code: 'room-one',
      username: 'Bob'
    });
    assert.equal(state.peers[0].id, a.id);
    assert.equal((await joined)[0].name, 'Bob');
    await ack(c, 'join-call', {
      code: 'room-two',
      username: 'Other'
    });
    let leaked = false;
    c.on('signal', () => {
      leaked = true;
    });
    c.on('chat-message', () => {
      leaked = true;
    });
    const signal = event(b, 'signal');
    a.emit('signal', b.id, {
      description: {
        type: 'offer',
        sdp: 'test'
      }
    });
    assert.equal((await signal)[1].description.sdp, 'test');
    a.emit('signal', c.id, {
      description: {
        type: 'offer',
        sdp: 'must not leak'
      }
    });
    const message = event(b, 'chat-message');
    assert.equal((await ack(a, 'chat-message', 'hello')).ok, true);
    assert.equal((await message)[0].sender, 'Alice');
    assert.ok((await ack(b, 'chat-message', ' ')).error);
    const left = event(a, 'user-left');
    b.disconnect();
    await left;
    const connected = event(b, 'connect');
    b.connect();
    await connected;
    const rejoined = await ack(b, 'join-call', {
      code: 'room-one',
      username: 'Bob'
    });
    assert.equal(rejoined.messages.length, 1);
    assert.equal(rejoined.peers.length, 1);
    await new Promise(resolve => setTimeout(resolve, 100));
    assert.equal(leaked, false);
    a.emit('leave-call');
    const departure = event(b, 'user-left');
    await departure;
    b.emit('leave-call');
    // Acknowledged rejoin is queued after leave, proving empty-room history was removed.
    const fresh = await ack(b, 'join-call', {
      code: 'room-one',
      username: 'Bob'
    });
    assert.deepEqual(fresh.messages, []);
    assert.deepEqual(fresh.peers, []);
  } finally {
    sockets.forEach(socket => socket.disconnect());
  }
});


test('production hosting serves meeting links and keeps API/asset errors separate', async () => {
  const hosted = createAppServer({frontendDir:fileURLToPath(new URL('./fixtures/', import.meta.url))});
  await new Promise(resolve => hosted.server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${hosted.server.address().port}`;
  try {
    for (const route of ['/', '/auth', '/home', '/history', '/shared-meeting']) {
      const response = await fetch(origin + route);
      assert.equal(response.status, 200);
      assert.match(await response.text(), /Gatherly deployment test/);
    }
    const api = await fetch(origin + '/api/does-not-exist');
    assert.equal(api.status, 404);
    assert.match(api.headers.get('content-type'), /application\/json/);
    assert.equal((await fetch(origin + '/assets/missing.js')).status, 404);
    assert.equal((await fetch(origin + '/missing.js')).status, 404);
  } finally { await new Promise(resolve => hosted.io.close(resolve)); }
});
