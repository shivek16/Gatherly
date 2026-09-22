import { io } from 'socket.io-client';
import server from '../environment';
const iceServers = [{
  urls: 'stun:stun.l.google.com:19302'
}];
if (process.env.REACT_APP_TURN_URL) iceServers.push({
  urls: process.env.REACT_APP_TURN_URL.split(','),
  username: process.env.REACT_APP_TURN_USERNAME,
  credential: process.env.REACT_APP_TURN_CREDENTIAL
});
export class MeetingConnection {
  constructor({
    code,
    username,
    tracks,
    onPeers,
    onMessage,
    onStatus,
    onError,
    onJoined
  }) {
    Object.assign(this, {
      code,
      username,
      tracks,
      onPeers,
      onMessage,
      onStatus,
      onError,
      onJoined
    });
    this.peers = new Map();
    this.closed = false;
    this.socket = io(server, {
      autoConnect: false,
      reconnectionAttempts: 10
    });
    this.socket.on('connect', () => this.join());
    this.socket.on('disconnect', () => {
      this.clearPeers();
      if (!this.closed) this.onStatus('Reconnecting…');
    });
    this.socket.on('connect_error', () => {
      this.onStatus('Cannot reach the meeting server. Retrying…');
      this.onError('Cannot reach the meeting server. Check the backend and retry.');
    });
    this.socket.io.on('reconnect_failed', () => this.onStatus('Connection lost. Use Reconnect to try again.'));
    this.socket.on('user-joined', peer => this.createPeer(peer));
    this.socket.on('user-left', id => {
      this.removePeer(id);
      this.publish();
    });
    this.socket.on('chat-message', message => this.onMessage(message));
    this.socket.on('signal', (id, signal) => {
      const peer = this.peers.get(id);
      if (!peer) return;
      peer.queue = peer.queue.then(() => this.handleSignal(peer, signal)).catch(() => {
        if (!this.closed) this.onError('A participant could not connect. Try Reconnect.');
      });
    });
  }
  start() {
    this.socket.connect();
  }
  emit(event, ...args) {
    return new Promise((resolve, reject) => this.socket.timeout(10000).emit(event, ...args, (error, result) => error ? reject(new Error('The server did not respond. Please retry.')) : result?.error ? reject(new Error(result.error)) : resolve(result)));
  }
  async join() {
    this.clearPeers();
    this.onStatus('Joining…');
    try {
      const result = await this.emit('join-call', {
        code: this.code,
        username: this.username
      });
      if (this.closed || !this.socket.connected) return;
      result.messages.forEach(message => this.onMessage(message));
      for (const info of result.peers) {
        const peer = this.createPeer(info, true);
        await peer.pc.setLocalDescription(await peer.pc.createOffer());
        this.socket.emit('signal', info.id, {
          description: peer.pc.localDescription
        });
      }
      this.onStatus('Connected');
      this.onJoined();
    } catch (error) {
      if (!this.closed) {
        this.onStatus(error.message);
        this.onError(error.message);
      }
    }
  }
  createPeer({
    id,
    name
  }, initiator = false) {
    if (this.peers.has(id)) return this.peers.get(id);
    const pc = new RTCPeerConnection({
      iceServers
    });
    const peer = {
      id,
      name,
      pc,
      stream: new MediaStream(),
      candidates: [],
      queue: Promise.resolve(),
      senders: {}
    };
    this.peers.set(id, peer);
    if (initiator) for (const kind of ['audio', 'video']) peer.senders[kind] = pc.addTransceiver(this.tracks[kind] || kind, {
      direction: 'sendrecv'
    }).sender;
    pc.onicecandidate = event => {
      if (event.candidate) this.socket.emit('signal', id, {
        candidate: event.candidate.toJSON()
      });
    };
    pc.ontrack = event => {
      if (!peer.stream.getTracks().includes(event.track)) peer.stream.addTrack(event.track);
      this.publish();
    };
    pc.onconnectionstatechange = () => {
      this.publish();
      if (pc.connectionState === 'failed') this.onError('A media connection failed. Try Reconnect; some networks require a configured TURN relay.');
    };
    this.publish();
    return peer;
  }
  async handleSignal(peer, signal) {
    if (this.closed || peer.pc.signalingState === 'closed') return;
    if (signal.description) {
      await peer.pc.setRemoteDescription(signal.description);
      for (const candidate of peer.candidates.splice(0)) await peer.pc.addIceCandidate(candidate);
      if (signal.description.type === 'offer') {
        for (const transceiver of peer.pc.getTransceivers()) {
          const kind = transceiver.receiver.track.kind;
          transceiver.direction = 'sendrecv';
          peer.senders[kind] = transceiver.sender;
          await transceiver.sender.replaceTrack(this.tracks[kind] || null);
        }
        await peer.pc.setLocalDescription(await peer.pc.createAnswer());
        this.socket.emit('signal', peer.id, {
          description: peer.pc.localDescription
        });
      }
    } else if (signal.candidate) {
      if (peer.pc.remoteDescription) await peer.pc.addIceCandidate(signal.candidate);else peer.candidates.push(signal.candidate);
    }
  }
  async replaceTracks(tracks) {
    this.tracks = tracks;
    await Promise.all([...this.peers.values()].flatMap(peer => ['audio', 'video'].map(kind => peer.senders[kind]?.replaceTrack(tracks[kind] || null))));
  }
  publish() {
    if (!this.closed) this.onPeers([...this.peers.values()].map(({
      id,
      name,
      stream,
      pc
    }) => ({
      id,
      name,
      stream,
      status: pc.connectionState
    })));
  }
  removePeer(id) {
    const peer = this.peers.get(id);
    if (peer) {
      peer.pc.ontrack = null;
      peer.pc.onicecandidate = null;
      peer.pc.onconnectionstatechange = null;
      peer.pc.close();
      this.peers.delete(id);
    }
  }
  clearPeers() {
    for (const id of this.peers.keys()) this.removePeer(id);
    this.publish();
  }
  reconnect() {
    this.socket.disconnect();
    this.socket.connect();
  }
  sendMessage(text) {
    return this.emit('chat-message', text);
  }
  close() {
    this.closed = true;
    this.socket.emit('leave-call');
    this.socket.removeAllListeners();
    this.socket.disconnect();
    this.clearPeers();
  }
}

