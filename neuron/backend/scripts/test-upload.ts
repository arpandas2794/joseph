import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function testUpload() {
  const content = Buffer.from('fake jpeg');
  const { data, error } = await supabase.storage.from('uploads').upload('test.jpg', content, { contentType: 'image/jpeg' });
  console.log('Data:', data);
  console.log('Error:', error);
}

testUpload().catch(console.error);
