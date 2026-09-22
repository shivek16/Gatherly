// Deployed builds use their own HTTPS origin unless an explicit API URL is supplied.
const defaultServer = process.env.NODE_ENV === 'production' ? window.location.origin : 'http://localhost:8000';
const server = (process.env.REACT_APP_API_URL || defaultServer).replace(/\/$/, '');
export default server;
