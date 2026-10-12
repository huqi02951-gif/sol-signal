import {spawn} from 'node:child_process';
const processes=[spawn('pnpm',['api'],{stdio:'inherit'}),spawn('pnpm',['worker'],{stdio:'inherit'}),spawn('pnpm',['web'],{stdio:'inherit'})];
let stopping=false;function stop(){if(stopping)return;stopping=true;for(const p of processes)p.kill('SIGTERM');}
process.on('SIGINT',stop);process.on('SIGTERM',stop);for(const p of processes)p.on('exit',()=>{stop();});
