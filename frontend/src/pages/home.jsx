import { useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, TextField } from '@mui/material';
import { AuthContext } from '../contexts/AuthContext';
import withAuth from '../utils/withAuth';
import { createMeetingCode, validMeetingCode } from '../utils/meetings';
function Home() {
  const navigate = useNavigate(),
    {
      handleLogout
    } = useContext(AuthContext);
  const [code, setCode] = useState(''),
    [error, setError] = useState('');
  const join = event => {
    event.preventDefault();
    const value = code.trim();
    if (!validMeetingCode(value)) {
      setError('Enter 3–64 letters, numbers, hyphens or underscores.');
      return;
    }
    navigate(`/${value}`);
  };
  return <><div className='navBar'><h2>Gatherly</h2><div><Button onClick={() => navigate('/history')}>History</Button><Button onClick={() => handleLogout().catch(e => setError(e.message))}>Logout</Button></div></div>
 <div className='meetContainer'><div className='leftPanel'><div><h2>Connect with your loved ones</h2><p>Start a meeting or enter a code to join.</p>{error && <Alert severity='error'>{error}</Alert>}
 <form onSubmit={join} className='meetingActions'><TextField label='Meeting Code' value={code} onChange={e => setCode(e.target.value)} inputProps={{
              maxLength: 64
            }} /><Button type='submit' variant='contained'>Join</Button></form>
 <Button sx={{
            mt: 2
          }} variant='outlined' onClick={() => navigate(`/${createMeetingCode()}`)}>New meeting</Button></div></div><div className='rightPanel'><img src='/logo3.png' alt='People connecting by video' /></div></div></>;
}
export default withAuth(Home);
