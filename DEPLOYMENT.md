
# Public deployment

Gatherly can run as one Render Web Service with a single public HTTPS URL. The included render.yaml is a deployment template; it does not deploy anything by itself. Production frontend requests use the current website origin by default, so no localhost URL is sent to visitors. Direct meeting links are served by the backend.

1. Push this project root to a GitHub repository. Exclude backend/.env, frontend/.env, node_modules, build, .cache, and backup archives (covered by .gitignore).
2. In Render, create a Blueprint from the repository. The template selects the free prototype plan; no paid resource is created by preparing these files.
3. Set MONGODB_URI in Render's environment settings using your own MongoDB Atlas database user and rotated credentials. The template uses database gatherly; change MONGODB_DB deliberately if you want an existing database. Allow Render's documented outbound IPs in Atlas network access.
4. Render builds the frontend and runs the backend, providing an HTTPS address. Its automatic RENDER_EXTERNAL_URL is accepted as a frontend origin.
5. For dependable cross-network calls, add REACT_APP_TURN_URL, REACT_APP_TURN_USERNAME, and REACT_APP_TURN_CREDENTIAL before the frontend build. Obtain scoped/short-lived TURN credentials from your chosen relay service; never put a provider master API key in frontend variables. Rebuild after changing frontend variables.
6. Test sign-up/sign-in and the same meeting link on two devices using different networks. Confirm audio, video, screen sharing, and reconnect behavior.

Do not set REACT_APP_API_URL to localhost for deployment. Leave it unset for this single-origin configuration. If you later host the frontend separately, set its HTTPS API URL and configure CLIENT_ORIGIN accordingly.

The free Render service sleeps after 15 minutes without inbound traffic and may take time to start on the next visit. Use one backend instance: room membership and chat are currently in memory. Scaling to multiple instances requires a shared Socket.IO adapter and shared room state.

Rotate the database credential exposed in the original source before deployment. The existing local .env must never be pushed. Preparing these files does not publish your code, purchase hosting, configure a TURN provider, or create a public address.

Official hosting references:
- https://render.com/docs/web-services
- https://render.com/docs/websocket
- https://render.com/docs/free
