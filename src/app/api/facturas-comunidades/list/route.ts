import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(req: Request) {
    const supabase = supabaseAdmin;

    const url = new URL(req.url);
    const path = url.searchParams.get("path") || "";

    console.log("Listing bucket 'FACTURAS' at path:", path);

    try {
        const { data, error } = await supabase.storage
            .from("FACTURAS")
            .list(path, {
                limit: 100,
                offset: 0,
                sortBy: { column: 'name', order: 'asc' },
            });

        if (error) {
            console.error("Supabase Storage Error:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // For folders, we want to count PDFs recursively for each
        const itemsWithCounts = await Promise.all((data || []).map(async (item) => {
            if (item.metadata) {
                // It's a file, we count it as 1 PDF (consistent with UI)
                // Filter out placeholders from individual file counts if necessary, 
                // but usually they aren't shown in the table anyway.
                return { ...item, file_count: 1 };
            } else {
                // It's a folder, count files recursively inside it
                const folderPath = path ? `${path}/${item.name}` : item.name;

                try {
                    const { data: folderFiles, error: folderError } = await supabase.storage
                        .from("FACTURAS")
                        .list(folderPath, {
                            recursive: true,
                            limit: 1000,
                        } as any);

                    if (folderError || !folderFiles) {
                        return { ...item, file_count: 0 };
                    }

                    const count = folderFiles.filter(f =>
                        f.metadata && // Must be a file
                        !f.name.endsWith('.emptyFolderPlaceholder') &&
                        !f.name.endsWith('.keep')
                    ).length;

                    return { ...item, file_count: count };
                } catch (err) {
                    console.error(`Error counting files for folder ${folderPath}:`, err);
                    return { ...item, file_count: 0 };
                }
            }
        }));

        console.log("Bucket items found:", itemsWithCounts?.length || 0);
        return NextResponse.json({ items: itemsWithCounts });
    } catch (error: any) {
        console.error("Error listing bucket contents:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
