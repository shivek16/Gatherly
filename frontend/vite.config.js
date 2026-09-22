import {defineConfig,loadEnv} from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({mode})=>{
 const env=loadEnv(mode,process.cwd(),'REACT_APP_');
 const keys=['REACT_APP_API_URL','REACT_APP_TURN_URL','REACT_APP_TURN_USERNAME','REACT_APP_TURN_CREDENTIAL','REACT_APP_TEST_MEDIA'];
 return {plugins:[react()],define:Object.fromEntries(keys.map(key=>[`process.env.${key}`,JSON.stringify(process.env[key]||env[key]||'')])),build:{outDir:'build'},test:{environment:'jsdom',globals:true,setupFiles:['./src/setupTests.js'],restoreMocks:true}};
});
