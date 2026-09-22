import 'dotenv/config';
import mongoose from 'mongoose';
import { createAppServer } from './server.js';
try {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI required');
  await mongoose.connect(process.env.MONGODB_URI, {
    dbName: process.env.MONGODB_DB || 'gatherly',
    serverSelectionTimeoutMS: 10000
  });
  const {
    server,
    io
  } = createAppServer();
  const port = Number(process.env.PORT || 8000);
  server.on('error', error => {
    console.error(`Server could not start: ${error.message}`);
    process.exit(1);
  });
  server.listen(port, () => console.log(`Gatherly API listening on http://localhost:${port}`));
  const stop = async () => {
    io.close();
    server.close();
    await mongoose.disconnect();
    process.exit(0);
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
} catch (error) {
  console.error(`Gatherly startup failed (${error.name}). Check MONGODB_URI in backend/.env, database credentials and network access.`);
  process.exitCode = 1;
}
