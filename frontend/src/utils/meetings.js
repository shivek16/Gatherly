export const validMeetingCode = code => /^[a-zA-Z0-9_-]{3,64}$/.test(code) && !['auth', 'home', 'history'].includes(code.toLowerCase());
export const createMeetingCode = () => crypto.randomUUID().slice(0, 8);
