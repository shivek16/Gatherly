import { MeetingMedia } from './media';
const track = kind => ({
  kind,
  enabled: true,
  readyState: 'live',
  stop: vi.fn(),
  onended: null
});
class FakeStream {
  constructor(tracks = []) {
    this.tracks = tracks;
  }
  getTracks() {
    return this.tracks;
  }
  getVideoTracks() {
    return this.tracks.filter(t => t.kind === 'video');
  }
}
beforeEach(() => {
  global.MediaStream = FakeStream;
});
test('mute/camera toggles reuse tracks, sharing restores camera, cleanup stops all streams', async () => {
  const audio = track('audio'),
    video = track('video'),
    screen = track('video'),
    onChange = vi.fn(),
    onError = vi.fn();
  const devices = {
    getUserMedia: vi.fn(async options => new FakeStream([options.audio ? audio : video])),
    getDisplayMedia: vi.fn(async () => new FakeStream([screen]))
  };
  const media = new MeetingMedia(onChange, onError, devices);
  await media.init();
  expect(devices.getUserMedia).toHaveBeenCalledTimes(2);
  await media.toggle('audio');
  expect(audio.enabled).toBe(false);
  await media.toggle('video');
  expect(video.enabled).toBe(false);
  expect(devices.getUserMedia).toHaveBeenCalledTimes(2);
  await media.share();
  expect(media.outgoing.video).toBe(screen);
  await media.share();
  expect(screen.stop).toHaveBeenCalled();
  expect(media.outgoing.video).toBe(video);
  expect(video.enabled).toBe(false);
  media.close();
  expect(audio.stop).toHaveBeenCalled();
  expect(video.stop).toHaveBeenCalled();
  expect(onError).not.toHaveBeenCalled();
});
test('browser stop-sharing action restores camera', async () => {
  const camera = track('video'),
    screen = track('video');
  const media = new MeetingMedia(vi.fn(), vi.fn(), {
    getUserMedia: async () => new FakeStream([camera]),
    getDisplayMedia: async () => new FakeStream([screen])
  });
  await media.acquire('video');
  await media.share();
  screen.onended();
  expect(media.display).toBeNull();
  expect(media.outgoing.video).toBe(camera);
  media.close();
});
test('permission denial still permits audio and late acquisition is stopped after unmount', async () => {
  const audio = track('audio'),
    onError = vi.fn();
  let finish;
  const devices = {
    getUserMedia: vi.fn(options => options.audio ? Promise.resolve(new FakeStream([audio])) : Promise.reject(new Error('Camera denied')))
  };
  const media = new MeetingMedia(vi.fn(), onError, devices);
  await media.init();
  expect(media.outgoing.audio).toBe(audio);
  expect(media.outgoing.video).toBeNull();
  expect(onError).toHaveBeenCalled();
  const video = track('video');
  devices.getUserMedia = () => new Promise(resolve => {
    finish = resolve;
  });
  const pending = media.acquire('video');
  media.close();
  finish(new FakeStream([video]));
  await pending;
  expect(video.stop).toHaveBeenCalled();
});
