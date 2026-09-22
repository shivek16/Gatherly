import { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Button, Card, CardContent, Typography } from '@mui/material';
import { AuthContext } from '../contexts/AuthContext';
import withAuth from '../utils/withAuth';
function History() {
  const {
      getHistoryOfUser
    } = useContext(AuthContext),
    [meetings, setMeetings] = useState([]),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    getHistoryOfUser().then(data => {
      if (active) setMeetings(data);
    }).catch(e => {
      if (active) setError(e.message);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [getHistoryOfUser, attempt]);
  return <main style={{
    maxWidth: 800,
    margin: 'auto',
    padding: 24
  }}><Button component={Link} to='/home'>Back to home</Button><h1>Meeting history</h1>
 {loading && <p role='status'>Loading history…</p>}{error && <Alert severity='error'>{error}<Button onClick={() => setAttempt(n => n + 1)}>Retry</Button></Alert>}
 {!loading && !error && meetings.length === 0 && <p>No meetings yet. Join or start a meeting to see it here.</p>}
 {meetings.map(meeting => <Card key={meeting._id} variant='outlined' sx={{
      mb: 2
    }}><CardContent><Typography>Code: {meeting.meetingCode}</Typography><Typography color='text.secondary'>{new Date(meeting.date).toLocaleString()}</Typography><Button component={Link} to={`/${meeting.meetingCode}`}>Join again</Button></CardContent></Card>)}
 </main>;
}
export default withAuth(History);
