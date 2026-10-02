import { createFileRoute } from '@tanstack/react-router';
export const Route=createFileRoute('/health')({server:{handlers:{GET:async()=>{try {const {pool}=await import('../server/db'); await pool.query('SELECT 1'); return Response.json({status:'ok'});}catch{return Response.json({status:'unavailable'},{status:503});}}}}});
