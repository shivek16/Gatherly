import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@mui/material';
import { createMeetingCode } from '../utils/meetings';
import '../App.css';
export default function LandingPage() {
  const navigate = useNavigate();
  return <div className='landingPageContainer'><nav><div className='navHeader'><h2>Gatherly</h2></div><div className='navlist'>
 <Button color='inherit' onClick={() => navigate(`/${createMeetingCode()}`)}>Join as Guest</Button><Button color='inherit' component={Link} to='/auth?mode=signup'>Register</Button><Button color='inherit' component={Link} to='/auth'>Login</Button>
 </div></nav><div className='landingMainContainer'><div><h1><span style={{
            color: '#FF9839'
          }}>Connect</span> with your loved ones</h1><p>Closer, wherever you are.</p><div role='button'><Link to='/auth'>Get Started</Link></div></div><div><img src='/mobile.png' alt='Video calls bring people together' /></div></div></div>;
}
