// Development-only generated tracks for repeatable browser testing without hardware.
// Enabled only by REACT_APP_TEST_MEDIA=true; production builds always use real devices.
export function createTestDevices() {
  const makeVideo = label => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 360;
    const ctx = canvas.getContext('2d');
    let frame = 0;
    const draw = () => {
      ctx.fillStyle = label === 'Screen' ? '#164e63' : '#172554';
      ctx.fillRect(0, 0, 640, 360);
      ctx.fillStyle = '#fb923c';
      ctx.font = '32px sans-serif';
      ctx.fillText(`Gatherly ${label} test`, 30, 90);
      ctx.fillText(`Frame ${frame++}`, 30, 150);
    };
    draw();
    const timer = setInterval(draw, 100);
    const stream = canvas.captureStream(10),
      track = stream.getVideoTracks()[0],
      stop = track.stop.bind(track);
    track.stop = () => {
      clearInterval(timer);
      stop();
    };
    return stream;
  };
  return {
    getUserMedia: async options => {
      if (options.video) return makeVideo('Camera');
      const context = new AudioContext(),
        oscillator = context.createOscillator(),
        gain = context.createGain(),
        destination = context.createMediaStreamDestination();
      gain.gain.value = 0.00001;
      oscillator.connect(gain);
      gain.connect(destination);
      oscillator.start();
      context.resume().catch(() => {});
      const track = destination.stream.getAudioTracks()[0],
        stop = track.stop.bind(track);
      track.stop = () => {
        oscillator.stop();
        context.close();
        stop();
      };
      return destination.stream;
    },
    getDisplayMedia: async () => makeVideo('Screen')
  };
}
