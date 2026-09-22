import React, { useContext, useState } from 'react';
import { Alert, Avatar, Box, Button, CssBaseline, Grid, Paper, TextField, Typography } from '@mui/material';
import { LockOutlined as LockOutlinedIcon } from '@mui/icons-material';
import { Link, useSearchParams } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';
export default function Authentication() {
  const [params] = useSearchParams();
  const [signUp, setSignUp] = useState(params.get('mode') === 'signup');
  const [username, setUsername] = useState(''),
    [password, setPassword] = useState(''),
    [name, setName] = useState('');
  const [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  const {
    handleRegister,
    handleLogin
  } = useContext(AuthContext);
  const submit = async event => {
    event.preventDefault();
    setError('');
    setMessage('');
    setBusy(true);
    try {
      if (signUp) {
        setMessage(await handleRegister(name, username, password));
        setSignUp(false);
        setPassword('');
      } else await handleLogin(username, password);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return <Grid container component='main' sx={{
    minHeight: '100vh'
  }}><CssBaseline />
  <Grid item xs={false} sm={4} md={7} sx={{
      backgroundImage: 'url(/background.png)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundColor: '#010430'
    }} />
  <Grid item xs={12} sm={8} md={5} component={Paper} elevation={6} square><Box sx={{
        my: 8,
        mx: 4,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}>
   <Typography component={Link} to='/' variant='h4' sx={{
          color: '#D97500',
          textDecoration: 'none',
          mb: 3
        }}>Gatherly</Typography>
   <Avatar sx={{
          m: 1,
          bgcolor: '#D97500'
        }}><LockOutlinedIcon /></Avatar>
   <Box><Button disabled={busy} variant={!signUp ? 'contained' : 'text'} onClick={() => {
            setSignUp(false);
            setError('');
          }}>Sign In</Button><Button disabled={busy} variant={signUp ? 'contained' : 'text'} onClick={() => {
            setSignUp(true);
            setError('');
          }}>Sign Up</Button></Box>
   <Box component='form' onSubmit={submit} sx={{
          mt: 2,
          width: '100%'
        }}>
    {message && <Alert severity='success'>{message}</Alert>}{error && <Alert severity='error'>{error}</Alert>}
    {signUp && <TextField margin='normal' required fullWidth id='full-name' label='Full Name' autoComplete='name' value={name} onChange={e => setName(e.target.value)} inputProps={{
            maxLength: 80
          }} />}
    <TextField margin='normal' required fullWidth id='username' label='Username' autoComplete='username' value={username} onChange={e => setUsername(e.target.value)} inputProps={{
            maxLength: 40
          }} />
    <TextField margin='normal' required fullWidth id='password' label='Password' type='password' autoComplete={signUp ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} inputProps={{
            minLength: signUp ? 8 : 1,
            maxLength: 72
          }} />
    <Button type='submit' fullWidth variant='contained' disabled={busy} sx={{
            mt: 3
          }}>{busy ? 'Please wait…' : signUp ? 'Register' : 'Login'}</Button>
   </Box>
  </Box></Grid>
 </Grid>;
}

