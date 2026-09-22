import { MeetingConnection } from './connection';
vi.mock('socket.io-client', () => ({
  io: () => ({
    on: vi.fn(),
    io: {
      on: vi.fn()
    },
    emit: vi.fn(),
    removeAllListeners: vi.fn(),
    disconnect: vi.fn()
  })
}));
beforeEach(() => {
  global.MediaStream = class {
    getTracks() {
      return [];
    }
    addTrack() {}
  };
  global.RTCPeerConnection = class {
    constructor() {
      this.transceivers = [];
      this.connectionState = 'new';
      this.signalingState = 'stable';
    }
    addTransceiver(kind) {
      const t = {
        receiver: {
          track: {
            kind: typeof kind === 'string' ? kind : kind.kind
          }
        },
        sender: {
          replaceTrack: vi.fn(async () => {})
        }
      };
      this.transceivers.push(t);
      return t;
    }
    async setRemoteDescription(description) {
      this.remoteDescription = description;
      if (description.type === 'offer') for (const kind of ['audio', 'video']) this.addTransceiver(kind);
    }
    getTransceivers() {
      return this.transceivers;
    }
    async createAnswer() {
      return {
        type: 'answer',
        sdp: 'answer'
      };
    }
    async setLocalDescription(description) {
      this.localDescription = description;
    }
    close() {}
  };
});
test('answering a caller attaches media to offered transceivers, avoiding one-way video', async () => {
  const tracks = {
    audio: {
      kind: 'audio'
    },
    video: {
      kind: 'video'
    }
  };
  const call = new MeetingConnection({
    code: 'test-room',
    username: 'Alice',
    tracks,
    onPeers: vi.fn(),
    onMessage: vi.fn(),
    onStatus: vi.fn(),
    onError: vi.fn(),
    onJoined: vi.fn()
  });
  const peer = call.createPeer({
    id: 'bob',
    name: 'Bob'
  });
  expect(peer.pc.getTransceivers()).toHaveLength(0);
  await call.handleSignal(peer, {
    description: {
      type: 'offer',
      sdp: 'offer'
    }
  });
  expect(peer.pc.getTransceivers()).toHaveLength(2);
  expect(peer.senders.audio.replaceTrack).toHaveBeenCalledWith(tracks.audio);
  expect(peer.senders.video.replaceTrack).toHaveBeenCalledWith(tracks.video);
  const screen = {
    kind: 'video'
  };
  await call.replaceTracks({
    ...tracks,
    video: screen
  });
  expect(peer.senders.video.replaceTrack).toHaveBeenLastCalledWith(screen);
  expect(call.socket.emit).toHaveBeenCalledWith('signal', 'bob', {
    description: {
      type: 'answer',
      sdp: 'answer'
    }
  });
  call.close();
});

test('a server connection failure reports an error so the lobby can enable retry', () => {
  const onError = vi.fn();
  const call = new MeetingConnection({code:'test-room',username:'Alice',tracks:{},onPeers:vi.fn(),onMessage:vi.fn(),onStatus:vi.fn(),onError,onJoined:vi.fn()});
  const handler = call.socket.on.mock.calls.find(([event]) => event === 'connect_error')[1];
  handler();
  expect(onError).toHaveBeenCalledWith(expect.stringContaining('retry'));
  call.close();
});
