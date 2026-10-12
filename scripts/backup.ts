import 'dotenv/config';
import {DatabaseSync} from 'node:sqlite';
import {resolve} from 'node:path';
const db=new DatabaseSync(process.env.DB_PATH||'data/sol-signal.sqlite');const destination=resolve(process.argv[2]||`data/backup-${Date.now()}.sqlite`);
db.exec(`VACUUM INTO '${destination.replaceAll("'","''")}'`);db.close();console.log('SQLite consistent backup created: '+destination);
