'use server';

import { getEmisor } from "@/lib/getEmisor";

export async function fetchEmisorName(): Promise<string> {
    const emisor = await getEmisor();
    return emisor.nombre;
}
