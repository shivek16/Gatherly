import { useContext, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Alert, Badge, Button, IconButton, TextField } from '@mui/material';
import { Videocam as VideocamIcon } from '@mui/icons-material';
import { VideocamOff as VideocamOffIcon } from '@mui/icons-material';
import { Mic as MicIcon } from '@mui/icons-material';
import { MicOff as MicOffIcon } from '@mui/icons-material';
import { CallEnd as CallEndIcon } from '@mui/icons-material';
import { ScreenShare as ScreenShareIcon } from '@mui/icons-material';
import { StopScreenShare as StopScreenShareIcon } from '@mui/icons-material';
import { Chat as ChatIcon } from '@mui/icons-material';
import styles from '../styles/videoComponent.module.css';
import { AuthContext, apiRequest } from '../contexts/AuthContext';
import { validMeetingCode } from '../utils/meetings';
import { MeetingMedia } from '../meeting/media';
import { createTestDevices } from '../meeting/testMedia';
import { MeetingConnection } from '../meeting/connection';
function VideoTile({
  stream,
  muted = false,
  name,
  status
}) {
  const ref = useRef();
  const [needsPlay, setNeedsPlay] = useState(false);
  useEffect(() => {
    const video = ref.current;
    video.srcObject = stream || null;
    if (stream) {
      setNeedsPlay(false);
      video.play().catch(() => {
        if (video.paused && video.srcObject === stream) setNeedsPlay(true);
      });
    }
    return () => {
      video.srcObject = null;
    };
  }, [stream]);
  return <div className={styles.tile}><video ref={ref} onPlaying={() => setNeedsPlay(false)} autoPlay playsInline muted={muted} aria-label={`${name} video`} /><div className={styles.tileLabel}>{name}{status && status !== 'connected' ? ` · ${status}` : ''}</div>{needsPlay && <Button onClick={() => ref.current.play().then(() => setNeedsPlay(false)).catch(() => {})}>Play audio/video</Button>}</div>;
}
export default function VideoMeet() {
  const {
      url: code
    } = useParams(),
    navigate = useNavigate(),
    {
      userData
    } = useContext(AuthContext);
  const [username, setUsername] = useState(userData?.name || ''),
    [joined, setJoined] = useState(false),
    [joining, setJoining] = useState(false);
  const [media, setMedia] = useState({
      stream: null,
      audio: false,
      video: false,
      screen: false
    }),
    [peers, setPeers] = useState([]);
  const [error, setError] = useState(''),
    [status, setStatus] = useState(''),
    [messages, setMessages] = useState([]),
    [message, setMessage] = useState(''),
    [sending, setSending] = useState(false);
  const [showChat, setShowChat] = useState(true),
    [unread, setUnread] = useState(0),
    [copied, setCopied] = useState(false);
  const mediaRef = useRef(),
    callRef = useRef(),
    alive = useRef(false),
    historySaved = useRef(false),
    chatOpen = useRef(true),
    messagesEnd = useRef();
  const valid = validMeetingCode(code || '');
  useEffect(() => {
    alive.current = true;
    if (!valid) return () => {
      alive.current = false;
    };
    const controller = new MeetingMedia(next => {
      setMedia(next);
      callRef.current?.replaceTracks(controller.outgoing).catch(() => setError('Could not update media. Try Reconnect.'));
    }, setError, process.env.NODE_ENV !== 'production' && process.env.REACT_APP_TEST_MEDIA === 'true' ? createTestDevices() : navigator.mediaDevices);
    mediaRef.current = controller;
    controller.init();
    return () => {
      alive.current = false;
      callRef.current?.close();
      callRef.current = null;
      controller.close();
    };
  }, [valid, code]);
  useEffect(() => {
    chatOpen.current = showChat;
    if (showChat) setUnread(0);
  }, [showChat]);
  useEffect(() => {
    if (showChat) messagesEnd.current?.scrollIntoView({
      block: 'nearest'
    });
  }, [messages, showChat]);
  const connect = event => {
    event.preventDefault();
    if (!username.trim() || joining) return;
    setError('');
    setJoining(true);
    callRef.current?.close();
    const call = new MeetingConnection({
      code,
      username: username.trim(),
      tracks: mediaRef.current.outgoing,
      onPeers: setPeers,
      onStatus: setStatus,
      onError: message => {
        setError(message);
        setJoining(false);
      },
      onMessage: item => {
        setMessages(previous => previous.some(m => m.id === item.id) ? previous : [...previous, item].slice(-100));
        if (!chatOpen.current && item.senderId !== call.socket.id) setUnread(n => n + 1);
      },
      onJoined: () => {
        if (!alive.current) return;
        setJoined(true);
        setJoining(false);
        if (!historySaved.current && localStorage.getItem('token')) {
          historySaved.current = true;
          apiRequest('/add_to_activity', {
            method: 'POST',
            authenticated: true,
            body: {
              meeting_code: code
            }
          }).catch(e => {
            if (alive.current) setError(`Meeting connected, but history was not saved: ${e.message}`);
          });
        }
      }
    });
    callRef.current = call;
    call.start();
  };
  const leave = () => {
    callRef.current?.close();
    mediaRef.current?.close();
    navigate(localStorage.getItem('token') ? '/home' : '/');
  };
  const send = async event => {
    event.preventDefault();
    if (!message.trim() || sending) return;
    setSending(true);
    try {
      await callRef.current.sendMessage(message);
      setMessage('');
    } catch (e) {
      setError(e.message);
    } finally {
      if (alive.current) setSending(false);
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
    } catch {
      setError('Copy the meeting link from your browser address bar.');
    }
  };
  const controls = <><IconButton aria-label={media.video ? 'Turn camera off' : 'Turn camera on'} title={media.video ? 'Turn camera off' : 'Turn camera on'} onClick={() => mediaRef.current?.toggle('video')} color='inherit'>{media.video ? <VideocamIcon /> : <VideocamOffIcon />}</IconButton><IconButton aria-label={media.audio ? 'Mute microphone' : 'Unmute microphone'} title={media.audio ? 'Mute microphone' : 'Unmute microphone'} onClick={() => mediaRef.current?.toggle('audio')} color='inherit'>{media.audio ? <MicIcon /> : <MicOffIcon />}</IconButton></>;
  if (!valid) return <main className={styles.lobby}><h1>Invalid meeting code</h1><p>Use 3–64 letters, numbers, hyphens or underscores.</p><Button component={Link} to='/'>Back to Gatherly</Button></main>;
  if (!joined) return <main className={styles.lobby}><h1>Gatherly</h1><h2>Enter into Lobby</h2><p>Meeting code: <strong>{code}</strong></p><Button onClick={copy}>{copied ? 'Link copied' : 'Copy invite link'}</Button>{error && <Alert severity='warning' onClose={() => setError('')}>{error}</Alert>}
 <VideoTile stream={media.stream} muted name='You' /><div>{controls}</div><p>You can join with your camera and microphone off.</p>
 <form onSubmit={connect} className={styles.lobbyForm}><TextField label='Your name' value={username} onChange={e => setUsername(e.target.value)} required inputProps={{
        maxLength: 80
      }} /><Button type='submit' variant='contained' disabled={joining || !username.trim()}>{joining ? 'Connecting…' : 'Connect'}</Button></form>{status && <p role='status'>{status}</p>}<Button onClick={leave}>Back</Button></main>;
  return <main className={styles.meetVideoContainer}><header className={styles.header}><strong>Gatherly · {code}</strong><span role='status'>{status} · {peers.length + 1} participants</span><Button color='inherit' onClick={copy}>{copied ? 'Link copied' : 'Copy invite link'}</Button><Button color='inherit' onClick={() => callRef.current.reconnect()}>Reconnect</Button></header>
 {error && <Alert severity='warning' onClose={() => setError('')}>{error}</Alert>}
 <div className={styles.meetingBody}><section className={styles.conferenceView} aria-label='Meeting participants'><VideoTile stream={media.stream} muted name={username + ' (You)'} />{peers.map(peer => <VideoTile key={peer.id} stream={peer.stream} name={peer.name} status={peer.status} />)}{peers.length === 0 && <p className={styles.waiting}>Waiting for others. Share the invite link to bring them in.</p>}</section>
 {showChat && <aside className={styles.chatRoom}><h2>Chat</h2><div className={styles.chattingDisplay} aria-live='polite'>{messages.length === 0 ? <p>No messages yet</p> : messages.map(item => <div key={item.id} className={styles.message}><strong>{item.sender}</strong><p>{item.text}</p></div>)}<div ref={messagesEnd} /></div><form className={styles.chattingArea} onSubmit={send}><TextField size='small' label='Message' value={message} onChange={e => setMessage(e.target.value)} inputProps={{
            maxLength: 2000
          }} /><Button type='submit' disabled={sending || !message.trim() || status !== 'Connected'}>Send</Button></form></aside>}</div>
 <footer className={styles.buttonContainers}>{controls}{navigator.mediaDevices?.getDisplayMedia && <IconButton color='inherit' aria-label={media.screen ? 'Stop sharing screen' : 'Share screen'} title={media.screen ? 'Stop sharing screen' : 'Share screen'} onClick={() => mediaRef.current.share()}>{media.screen ? <StopScreenShareIcon /> : <ScreenShareIcon />}</IconButton>}<Badge badgeContent={unread} color='warning'><IconButton color='inherit' aria-label={showChat ? 'Hide chat' : 'Show chat'} onClick={() => setShowChat(value => !value)}><ChatIcon /></IconButton></Badge><IconButton aria-label='Leave call' title='Leave call' onClick={leave} sx={{
        color: '#ff625c'
      }}><CallEndIcon /></IconButton></footer>
 </main>;
}

