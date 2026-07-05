import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function run() {
  const { data: messages } = await supabase.from('ai_messages').select('*').order('created_at', { ascending: false }).limit(6);
  console.log('--- LATEST MESSAGES ---');
  console.log(JSON.stringify(messages, null, 2));
}

run();
