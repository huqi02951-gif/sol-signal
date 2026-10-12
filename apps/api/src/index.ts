import 'dotenv/config';
import {Store} from '../../../packages/storage/src/index';
import {createServer} from './server';
const store=new Store();const port=Number(process.env.API_PORT||8787);const app=createServer(store,port);
await app.listen({port,host:process.env.API_HOST||'127.0.0.1'});console.log(`SOL SIGNAL PAPER API: http://127.0.0.1:${port}`);
async function shutdown(){await app.close();store.close();}
process.on('SIGINT',()=>void shutdown());process.on('SIGTERM',()=>void shutdown());
