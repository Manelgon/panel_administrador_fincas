
const { createClient } = require('@supabase/supabase-js');
const https = require('https');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugContent() {
    const bucketName = 'FACTURAS';
    const { data: items } = await supabase.storage.from(bucketName).list('', { limit: 5 });
    const pdf = items.find(i => i.name.toLowerCase().endsWith('.pdf'));
    if (!pdf) return console.log("No PDF found.");

    console.log(`Checking PDF: ${pdf.name}`);
    const { data } = await supabase.storage.from(bucketName).createSignedUrl(pdf.name, 60);

    https.get(data.signedUrl, (res) => {
        console.log("Status Code:", res.statusCode);
        console.log("Headers:", res.headers);

        let rawData = '';
        res.on('data', (chunk) => { if (rawData.length < 100) rawData += chunk.toString('ascii'); });
        res.on('end', () => {
            console.log("Start of content (ASCII):", rawData.substring(0, 50));
            if (rawData.startsWith('%PDF-')) {
                console.log("SUCCESS: Content is a valid PDF.");
            } else {
                console.log("FAILURE: Content is NOT a PDF.");
            }
        });
    });
}

debugContent();
