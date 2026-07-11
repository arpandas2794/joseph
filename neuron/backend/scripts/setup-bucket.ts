import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function setupBucket() {
  const bucketName = 'uploads';
  console.log(`Checking if bucket '${bucketName}' exists...`);
  
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    console.error('Failed to list buckets:', listError);
    process.exit(1);
  }

  const exists = buckets.find(b => b.name === bucketName);
  if (exists) {
    console.log(`Bucket '${bucketName}' already exists. Updating to public if necessary.`);
    const { error: updateError } = await supabase.storage.updateBucket(bucketName, {
      public: true,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    });
    if (updateError) {
       console.log('Update error (might already be public):', updateError.message);
    } else {
       console.log(`Bucket '${bucketName}' is configured as public.`);
    }
  } else {
    console.log(`Creating bucket '${bucketName}'...`);
    const { data, error } = await supabase.storage.createBucket(bucketName, {
      public: true,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      fileSizeLimit: 52428800, // 50MB
    });
    
    if (error) {
      console.error(`Failed to create bucket:`, error);
      process.exit(1);
    }
    console.log(`Successfully created public bucket '${bucketName}'.`);
  }
}

setupBucket().catch(console.error);
