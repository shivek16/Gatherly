export class MeetingMedia {
  constructor(onChange, onError, devices = navigator.mediaDevices) {
    this.devices = devices;
    this.onChange = onChange;
    this.onError = onError;
    this.tracks = {
      audio: null,
      video: null
    };
    this.display = null;
    this.closed = false;
    this.busy = new Set();
  }
  get outgoing() {
    return {
      audio: this.tracks.audio,
      video: this.display?.getVideoTracks()[0] || this.tracks.video
    };
  }
  get preview() {
    return new MediaStream(Object.values(this.outgoing).filter(Boolean));
  }
  notify() {
    if (!this.closed) this.onChange({
      stream: this.preview,
      audio: !!this.tracks.audio?.enabled,
      video: !!this.tracks.video?.enabled,
      screen: !!this.display
    });
  }
  async acquire(kind) {
    if (this.closed || this.busy.has(kind)) return;
    this.busy.add(kind);
    try {
      if (!this.devices?.getUserMedia) throw new Error('Camera and microphone need HTTPS or localhost in a supported browser.');
      const stream = await this.devices.getUserMedia({
        [kind]: true
      });
      if (this.closed) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      const track = stream.getTracks()[0];
      this.tracks[kind]?.stop();
      this.tracks[kind] = track;
      track.onended = () => {
        if (this.tracks[kind] === track) {
          this.tracks[kind] = null;
          this.notify();
        }
      };
      this.notify();
    } catch (error) {
      if (!this.closed) this.onError(error.message || `Cannot access your ${kind === 'video' ? 'camera' : 'microphone'}. You can still join.`);
    } finally {
      this.busy.delete(kind);
    }
  }
  async init() {
    await Promise.all(['audio', 'video'].map(kind => this.acquire(kind)));
  }
  async toggle(kind) {
    const track = this.tracks[kind];
    if (!track || track.readyState === 'ended') return this.acquire(kind);
    track.enabled = !track.enabled;
    this.notify();
  }
  async share() {
    if (this.display) {
      this.stopSharing();
      return;
    }
    if (this.closed || this.busy.has('screen')) return;
    this.busy.add('screen');
    try {
      if (!this.devices?.getDisplayMedia) throw new Error('Screen sharing is not supported by this browser.');
      const stream = await this.devices.getDisplayMedia({
        video: true,
        audio: false
      });
      if (this.closed) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      this.display = stream;
      stream.getVideoTracks()[0].onended = () => this.stopSharing();
      this.notify();
    } catch (error) {
      if (!this.closed && error.name !== 'NotAllowedError') this.onError(error.message || 'Unable to share your screen.');
    } finally {
      this.busy.delete('screen');
    }
  }
  stopSharing() {
    const display = this.display;
    this.display = null;
    display?.getTracks().forEach(track => {
      track.onended = null;
      track.stop();
    });
    this.notify();
  }
  close() {
    this.closed = true;
    [...Object.values(this.tracks), ...(this.display?.getTracks() || [])].filter(Boolean).forEach(track => {
      track.onended = null;
      track.stop();
    });
    this.tracks = {
      audio: null,
      video: null
    };
    this.display = null;
  }
}
