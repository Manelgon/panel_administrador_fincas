
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugStorage() {
    console.log("Checking buckets...");
    const { data: buckets, error: bError } = await supabase.storage.listBuckets();
    if (bError) return console.error("Buckets error:", bError);
    console.log("Buckets:", buckets.map(b => b.name));

    const bucketName = 'FACTURAS';
    console.log(`Listing root of ${bucketName}...`);
    const { data: items, error: iError } = await supabase.storage.from(bucketName).list('', { limit: 10 });
    if (iError) return console.error("List error:", iError);
    console.log("Items in root:", items.map(i => i.name));
}

debugStorage();
