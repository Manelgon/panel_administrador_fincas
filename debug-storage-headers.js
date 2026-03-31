
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugSignedUrl() {
    const bucketName = 'FACTURAS';

    console.log("Listing items to find a PDF...");
    const { data: items, error: iError } = await supabase.storage.from(bucketName).list('', { limit: 5 });
    if (iError || !items) return console.error("List error:", iError);

    const pdf = items.find(i => i.name.toLowerCase().endsWith('.pdf'));
    if (!pdf) return console.log("No PDF found in root.");

    console.log(`Found PDF: ${pdf.name}`);

    console.log("Generating signed URL (view mode)...");
    const { data: viewData, error: vError } = await supabase.storage.from(bucketName).createSignedUrl(pdf.name, 60);
    if (vError) return console.error("View URL error:", vError);

    console.log("View URL:", viewData.signedUrl);

    try {
        console.log("Fetching headers of View URL...");
        const res = await axios.head(viewData.signedUrl);
        console.log("Headers:", res.headers);
    } catch (e) {
        console.error("Fetch error:", e.message);
        if (e.response) console.log("Response body:", e.response.data);
    }
}

debugSignedUrl();
