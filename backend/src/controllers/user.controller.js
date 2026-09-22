import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import { User } from '../models/user.model.js';
import { Meeting } from '../models/meeting.model.js';
const clean = value => typeof value === 'string' ? value.trim() : '';
export const validMeetingCode = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{3,64}$/.test(value) && !['auth', 'home', 'history'].includes(value.toLowerCase());
const publicUser = user => ({
  name: user.name,
  username: user.username
});
export async function requireUser(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token || !/^[a-f0-9]{40}$/.test(token)) return res.status(401).json({
    message: 'Please sign in again.'
  });
  try {
    const user = await User.findOne({
      token,
      tokenExpiresAt: {
        $gt: new Date()
      }
    });
    if (!user) return res.status(401).json({
      message: 'Your session has expired. Please sign in again.'
    });
    req.user = user;
    next();
  } catch {
    res.status(503).json({
      message: 'Database unavailable. Please try again.'
    });
  }
}
export async function register(req, res) {
  const name = clean(req.body.name),
    username = clean(req.body.username).toLowerCase(),
    password = req.body.password;
  if (!name || name.length > 80 || !/^[a-z0-9_.-]{3,40}$/.test(username) || typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) return res.status(400).json({
    message: 'Use a name, a 3–40 character username (letters, numbers, . _ -), and an 8–72 byte password.'
  });
  try {
    const user = await User.create({
      name,
      username,
      password: await bcrypt.hash(password, 10)
    });
    res.status(201).json({
      message: 'Account created. You can now sign in.',
      user: publicUser(user)
    });
  } catch (error) {
    res.status(error.code === 11000 ? 409 : 503).json({
      message: error.code === 11000 ? 'That username is already taken.' : 'Unable to create account. Please try again.'
    });
  }
}
export async function login(req, res) {
  const enteredUsername = clean(req.body.username),
    username = enteredUsername.toLowerCase(),
    password = req.body.password;
  if (!username || typeof password !== 'string' || !password || Buffer.byteLength(password, 'utf8') > 72) return res.status(400).json({
    message: 'Enter your username and password.'
  });
  try {
    const user = (await User.findOne({
      username: enteredUsername
    })) || (await User.findOne({
      username
    }));
    if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({
      message: 'Invalid username or password.'
    });
    user.token = crypto.randomBytes(20).toString('hex');
    user.tokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await user.save();
    res.json({
      token: user.token,
      user: publicUser(user)
    });
  } catch {
    res.status(503).json({
      message: 'Unable to sign in. Please try again.'
    });
  }
}
export const me = (req, res) => res.json(publicUser(req.user));
export async function logout(req, res) {
  try {
    req.user.token = undefined;
    req.user.tokenExpiresAt = undefined;
    await req.user.save();
    res.sendStatus(204);
  } catch {
    res.status(503).json({
      message: 'Unable to sign out. Please try again.'
    });
  }
}
export async function getUserHistory(req, res) {
  try {
    res.json(await Meeting.find({
      user_id: req.user.username
    }).sort({
      date: -1
    }).limit(100));
  } catch {
    res.status(503).json({
      message: 'Unable to load meeting history.'
    });
  }
}
export async function addToHistory(req, res) {
  const meetingCode = clean(req.body.meeting_code);
  if (!validMeetingCode(meetingCode)) return res.status(400).json({
    message: 'Use a meeting code of 3–64 letters, numbers, hyphens or underscores.'
  });
  try {
    await Meeting.create({
      user_id: req.user.username,
      meetingCode
    });
    res.status(201).json({
      message: 'Meeting saved to history.'
    });
  } catch {
    res.status(503).json({
      message: 'Unable to save meeting history.'
    });
  }
}
