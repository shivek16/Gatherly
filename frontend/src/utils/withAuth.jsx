import { useContext, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Alert, Button } from '@mui/material';
import { AuthContext } from '../contexts/AuthContext';
const withAuth = Wrapped => function ProtectedPage(props) {
  const {
      getCurrentUser
    } = useContext(AuthContext),
    [ready, setReady] = useState(false),
    [error, setError] = useState(''),
    [attempt, setAttempt] = useState(0);
  const token = localStorage.getItem('token');
  useEffect(() => {
    let active = true;
    if (token) {
      setError('');
      getCurrentUser().then(() => {
        if (active) setReady(true);
      }).catch(e => {
        if (active) setError(e.message);
      });
    }
    return () => {
      active = false;
    };
  }, [token, getCurrentUser, attempt]);
  if (!token) return <Navigate to='/auth' replace />;
  if (error) return <Alert severity='error'>{error} <Button onClick={() => setAttempt(n => n + 1)}>Retry</Button></Alert>;
  if (!ready) return <p role='status'>Checking your session…</p>;
  return <Wrapped {...props} />;
};
export default withAuth;
