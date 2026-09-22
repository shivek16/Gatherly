import { Server } from 'socket.io';
import { randomUUID } from 'node:crypto';
import { validMeetingCode } from './user.controller.js';
export function connectToSocket(server, cors = {
  origin: 'http://localhost:3000'
}) {
  const io = new Server(server, {
    cors,
    maxHttpBufferSize: 100000
  });
  const rooms = new Map();
  io.on('connection', socket => {
    const leave = () => {
      const code = socket.data.code;
      if (!code) return;
      socket.to(`meeting:${code}`).emit('user-left', socket.id);
      const room = rooms.get(code);
      room?.members.delete(socket.id);
      if (room?.members.size === 0) rooms.delete(code);
      socket.leave(`meeting:${code}`);
      socket.data.code = null;
    };
    socket.on('join-call', async (payload, callback) => {
      const ack = typeof callback === 'function' ? callback : () => {};
      const {
        code,
        username
      } = payload || {};
      if (!validMeetingCode(code) || typeof username !== 'string' || !username.trim() || username.trim().length > 80) return ack({
        error: 'Enter a valid meeting code and name.'
      });
      if (socket.data.code === code) return ack({
        error: 'Already in this meeting.'
      });
      if ((rooms.get(code)?.members.size || 0) >= 8) return ack({
        error: 'This meeting is full (8 participants).'
      });
      leave();
      if (!rooms.has(code)) rooms.set(code, {
        members: new Map(),
        messages: []
      });
      const room = rooms.get(code),
        peers = [...room.members].map(([id, name]) => ({
          id,
          name
        }));
      socket.data.code = code;
      socket.data.username = username.trim();
      room.members.set(socket.id, socket.data.username);
      await socket.join(`meeting:${code}`);
      socket.to(`meeting:${code}`).emit('user-joined', {
        id: socket.id,
        name: socket.data.username
      });
      ack({
        peers,
        messages: room.messages
      });
    });
    socket.on('signal', (target, signal) => {
      const room = rooms.get(socket.data.code);
      if (!room?.members.has(target) || target === socket.id || !signal || typeof signal !== 'object') return;
      if (signal.description && !['offer', 'answer'].includes(signal.description.type)) return;
      io.to(target).emit('signal', socket.id, signal);
    });
    socket.on('chat-message', (text, callback) => {
      const ack = typeof callback === 'function' ? callback : () => {},
        room = rooms.get(socket.data.code);
      if (!room) return ack({
        error: 'Join a meeting before sending a message.'
      });
      if (typeof text !== 'string' || !text.trim() || text.trim().length > 2000) return ack({
        error: 'Messages must contain 1–2000 characters.'
      });
      const now = Date.now();
      if (now - (socket.data.lastMessageAt || 0) < 300) return ack({
        error: 'Please wait a moment before sending another message.'
      });
      socket.data.lastMessageAt = now;
      const message = {
        id: randomUUID(),
        sender: socket.data.username,
        senderId: socket.id,
        text: text.trim(),
        sentAt: now
      };
      room.messages.push(message);
      if (room.messages.length > 100) room.messages.shift();
      io.to(`meeting:${socket.data.code}`).emit('chat-message', message);
      ack({
        ok: true
      });
    });
    socket.on('leave-call', leave);
    socket.on('disconnect', leave);
  });
  return io;
}
