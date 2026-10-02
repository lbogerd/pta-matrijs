import { pool, schema } from '../src/server/db'
import { createAccount } from '../src/server/accounts'
import { DEFAULT_TEMPLATE } from '../src/lib/domain'
try {
 await pool.query(schema)
 await pool.query('INSERT INTO templates(id,version,published,payload) VALUES($1,$2,true,$3) ON CONFLICT DO NOTHING',[DEFAULT_TEMPLATE.id,DEFAULT_TEMPLATE.version,DEFAULT_TEMPLATE])
 if(process.env.BOOTSTRAP_ADMIN_EMAIL&&process.env.BOOTSTRAP_ADMIN_PASSWORD) {
   const existing=await pool.query('SELECT 1 FROM "user" WHERE email=$1',[process.env.BOOTSTRAP_ADMIN_EMAIL.toLowerCase()])
   if(!existing.rowCount) await createAccount('Platformbeheer',process.env.BOOTSTRAP_ADMIN_EMAIL,process.env.BOOTSTRAP_ADMIN_PASSWORD,'admin')
 }
 console.log('Database schema and bootstrap complete.')
} finally {await pool.end()}
