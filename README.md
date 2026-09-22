# Gatherly

Your full-stack video meeting app: guest calls, registration/sign-in, meeting codes, video/audio, screen sharing, room chat and personal meeting history. The existing React/Express/MongoDB/Socket.IO/WebRTC architecture and landing-page artwork are retained.

## Run on your laptop

Use Node.js 22.12 or later (verified with Node 24). In this folder:

```powershell
npm run setup
npm start
```

Open http://localhost:3000. The API runs on http://localhost:8000 and has a `/health` endpoint. Stop both with Ctrl+C. Dependencies are already installed on this laptop after the repair.

`backend/.env` contains the database connection configuration and is ignored by Git. An example is provided. The frontend defaults to the local API; change `REACT_APP_API_URL` in `frontend/.env` when deploying, then rebuild/restart. Backend `CLIENT_ORIGIN` supports comma-separated frontend origins.

## Use the app

- Register/sign in to access home and personal meeting history.
- Choose New meeting or enter a meeting code. Guests can start a meeting from the landing page.
- In the lobby, enter a display name and allow camera/microphone access, or join with devices off.
- Copy the invite link and open the same link for every participant. Room codes are case-sensitive and support 3–64 letters, digits, underscores and hyphens.
- Use camera, microphone, screen-sharing, chat and leave controls. Browser Stop sharing also restores the camera.
- Use Reconnect after a network failure. History records authenticated joins; guest meetings are not saved.

The app supports small peer-to-peer meetings, capped at eight participants. Chat is kept in memory for active rooms, capped at 100 messages; it disappears after everyone leaves or the server restarts. Screen sharing sends screen video with microphone audio, not desktop/system audio.

## Tests and build

```powershell
npm test
npm run build
```

Backend tests use a disposable local MongoDB instance (downloaded on first run); they never use `backend/.env` or your real database. They cover authentication, token expiry/logout, validation, private history, room membership, signaling/chat isolation, reconnection and cleanup. Frontend tests cover navigation, login failures/success and media lifecycle. Production files are written to `frontend/build`.

## Deployment prerequisites

Serve the frontend over HTTPS and the API over HTTPS/WSS. Configure the API URL and allowed frontend origin. For reliable calls across restrictive networks, supply a TURN relay using `REACT_APP_TURN_URL`, `REACT_APP_TURN_USERNAME`, and `REACT_APP_TURN_CREDENTIAL` before building. Only public STUN is enabled by default. Prefer short-lived TURN credentials in a production deployment; frontend environment values are included in the browser bundle.

The database credential previously embedded in source has been moved to the ignored local environment file. Because it was exposed in the original source, rotate it in your MongoDB account and update that file before public deployment. Existing sessions need a fresh login to receive an expiry timestamp. No database records are deleted by the repair.

For repeatable development browser tests without hardware, start the frontend with `REACT_APP_TEST_MEDIA=true`. This supplies generated camera, quiet audio, and screen test tracks. The flag is disabled by default and ignored in production builds. It does not verify real hardware permission dialogs or the native screen picker.

The frontend uses Vite and Vitest in place of the obsolete Create React App toolchain. The React UI and app flows are preserved.

