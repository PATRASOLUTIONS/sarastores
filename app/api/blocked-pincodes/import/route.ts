import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { handleApiError } from "@/lib/api-error"
import { PincodeListTypeSchema } from "@/lib/validation"
import { MAX_PINCODE_IMPORT_BYTES, readPincodeSpreadsheet } from "@/lib/pincode-import"
import { mergePincodes } from "@/lib/pincode-store"

export async function POST(request: Request) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response
  try {
    let form: FormData
    try { form = await request.formData() } catch {
      return NextResponse.json({ error: "Upload an Excel file using multipart form data" }, { status: 400 })
    }
    const list = PincodeListTypeSchema.safeParse(form.get("listType"))
    const file = form.get("file")
    if (!list.success) return NextResponse.json({ error: "Choose the allowed or blocked list" }, { status: 400 })
    if (!(file instanceof Blob) || !("name" in file) || typeof file.name !== "string" || !/\.xlsx?$/i.test(file.name)) {
      return NextResponse.json({ error: "Choose an .xlsx or .xls Excel file" }, { status: 400 })
    }
    if (file.size > MAX_PINCODE_IMPORT_BYTES) return NextResponse.json({ error: "Excel file exceeds 3 MB" }, { status: 413 })
    let parsed: ReturnType<typeof readPincodeSpreadsheet>
    try { parsed = readPincodeSpreadsheet(await file.arrayBuffer()) } catch (error) {
      console.warn("[Pincode Import] Invalid spreadsheet:", error)
      return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid Excel file" }, { status: 400 })
    }
    await mergePincodes(list.data, parsed.entries)
    return NextResponse.json({ success: true, listType: list.data, imported: parsed.entries.length, duplicateRows: parsed.duplicateRows })
  } catch (error) {
    return handleApiError(error, "Pincodes could not be imported")
  }
}
