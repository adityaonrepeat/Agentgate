import { NextResponse } from "next/server";
import { namoid, namoidConfigured } from "@/lib/namoid";

export async function GET(): Promise<Response> {
  if (!namoidConfigured())
    return NextResponse.json({ error: "NamoID is not configured." }, { status: 503 });

  return namoid().login();
}
