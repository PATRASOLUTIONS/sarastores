import { type NextRequest, NextResponse } from "next/server"
import { getCollection, createObjectId } from "@/lib/db-service"
import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params

    if (!id) {
      return NextResponse.json({ error: "Order ID is required" }, { status: 400 })
    }

    const collection = await getCollection("orders")

    let orderId
    try {
      orderId = createObjectId(id)
    } catch (error) {
      return NextResponse.json({ error: "Invalid Order ID format" }, { status: 400 })
    }

    const order = await collection.findOne({ _id: orderId })

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()

    // Header Section with Company Branding
    doc.setFillColor(220, 53, 69) // Red brand color
    doc.rect(0, 0, pageWidth, 40, "F")

    doc.setFontSize(32)
    doc.setTextColor(255, 255, 255)
    doc.setFont("helvetica", "bold")
    doc.text("Sara Mobiles and Electronics ", 20, 25)

    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")
    doc.text("Your Trusted E-Commerce Partner", 20, 32)

    // Invoice Title and Number
    doc.setFontSize(24)
    doc.setTextColor(220, 53, 69)
    doc.setFont("helvetica", "bold")
    doc.text("INVOICE", pageWidth - 20, 25, { align: "right" })

    doc.setFontSize(11)
    doc.setTextColor(0, 0, 0)
    doc.setFont("helvetica", "normal")
    doc.text(`#${order._id.toString().slice(-8).toUpperCase()}`, pageWidth - 20, 32, { align: "right" })

    // Company Details Section
    doc.setFontSize(9)
    doc.setTextColor(60, 60, 60)
    doc.text("Sara Mobiles and Electronics Private Limited", 20, 50)
    doc.text("#23/1, 1st Floor, J.C. 1st Cross, JC Road", 20, 55)
    doc.text("Bengaluru, Karnataka 560027", 20, 60)
    doc.text("Email: info@saramobiles.com", 20, 65)
    doc.text("Phone: +91 78920 51553", 20, 70)
    doc.text("GST: 27AABCU9603R1ZM", 20, 75)

    // Invoice Details Box
    doc.setDrawColor(220, 53, 69)
    doc.setLineWidth(0.5)
    doc.rect(pageWidth - 75, 48, 55, 32)

    doc.setFontSize(9)
    doc.setTextColor(0, 0, 0)
    doc.setFont("helvetica", "bold")
    doc.text("Invoice Date:", pageWidth - 72, 55)
    doc.text("Order Date:", pageWidth - 72, 62)
    doc.text("Payment:", pageWidth - 72, 69)
    doc.text("Status:", pageWidth - 72, 76)

    doc.setFont("helvetica", "normal")
    const invoiceDate = new Date().toLocaleDateString("en-IN")
    const orderDate = new Date(order.date || order.createdAt).toLocaleDateString("en-IN")
    doc.text(invoiceDate, pageWidth - 22, 55, { align: "right" })
    doc.text(orderDate, pageWidth - 22, 62, { align: "right" })
    doc.text(order.paymentMethod === "cod" ? "COD" : "Paid", pageWidth - 22, 69, { align: "right" })
    doc.text(order.status || "Pending", pageWidth - 22, 76, { align: "right" })

    // Bill To Section
    doc.setFillColor(245, 245, 245)
    doc.rect(20, 88, 85, 35, "F")
    doc.setDrawColor(200, 200, 200)
    doc.rect(20, 88, 85, 35)

    doc.setFontSize(11)
    doc.setTextColor(220, 53, 69)
    doc.setFont("helvetica", "bold")
    doc.text("BILL TO:", 25, 95)

    doc.setFontSize(10)
    doc.setTextColor(0, 0, 0)
    doc.setFont("helvetica", "bold")
    const customerName = order.customer?.name || order.shippingAddress?.name || "N/A"
    doc.text(customerName, 25, 103)

    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    const customerEmail = order.customer?.email || "N/A"
    const customerPhone = order.customer?.phone || "N/A"
    doc.text(customerEmail, 25, 109)
    doc.text(customerPhone, 25, 115)

    // Ship To Section
    doc.setFillColor(245, 245, 245)
    doc.rect(110, 88, 85, 35, "F")
    doc.setDrawColor(200, 200, 200)
    doc.rect(110, 88, 85, 35)

    doc.setFontSize(11)
    doc.setTextColor(220, 53, 69)
    doc.setFont("helvetica", "bold")
    doc.text("SHIP TO:", 115, 95)

    doc.setFontSize(9)
    doc.setTextColor(0, 0, 0)
    doc.setFont("helvetica", "normal")
    const address = order.shippingAddress || {}
    doc.text(address.name || customerName, 115, 103)
    doc.text(address.street || address.address || "", 115, 109)
    doc.text(`${address.city || ""}, ${address.state || ""}`, 115, 115)
    doc.text(`${address.zip || address.pincode || ""}, ${address.country || "India"}`, 115, 121)

    // Tracking Number (if available)
    if (order.trackingNumber) {
      doc.setFillColor(255, 243, 205)
      doc.rect(20, 128, pageWidth - 40, 8, "F")
      doc.setFontSize(9)
      doc.setFont("helvetica", "bold")
      doc.text("Tracking Number: ", 25, 133)
      doc.setFont("helvetica", "normal")
      doc.text(order.trackingNumber, 60, 133)
    }

    // Items Table
    const items = order.items || []
    const tableData = items.map((item: any, index: number) => [
      (index + 1).toString(),
      item.name || "N/A",
      item.sku || "-",
      item.quantity?.toString() || "1",
      `₹${(item.price || 0).toLocaleString("en-IN")}`,
      `₹${((item.price || 0) * (item.quantity || 1)).toLocaleString("en-IN")}`,
    ])

    const tableStartY = order.trackingNumber ? 143 : 133

    autoTable(doc, {
      startY: tableStartY,
      head: [["#", "Product Description", "SKU", "Qty", "Unit Price", "Amount"]],
      body: tableData,
      theme: "striped",
      headStyles: {
        fillColor: [220, 53, 69],
        textColor: [255, 255, 255],
        fontSize: 10,
        fontStyle: "bold",
        halign: "center",
      },
      bodyStyles: {
        fontSize: 9,
        textColor: [0, 0, 0],
      },
      columnStyles: {
        0: { halign: "center", cellWidth: 10 },
        1: { halign: "left", cellWidth: 70 },
        2: { halign: "center", cellWidth: 25 },
        3: { halign: "center", cellWidth: 15 },
        4: { halign: "right", cellWidth: 30 },
        5: { halign: "right", cellWidth: 30 },
      },
      alternateRowStyles: {
        fillColor: [250, 250, 250],
      },
    })

    // Totals Section
    const finalY = (doc as any).lastAutoTable.finalY || tableStartY + 20
    const subtotal = order.total - (order.shipping || 0)
    const shipping = order.shipping || 0
    const tax = order.tax || 0
    const discount = order.discount || 0
    const total = order.total || 0

    const totalsX = pageWidth - 70
    let currentY = finalY + 15

    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(0, 0, 0)

    doc.text("Subtotal:", totalsX, currentY)
    doc.text(`₹${subtotal.toLocaleString("en-IN")}`, pageWidth - 20, currentY, { align: "right" })
    currentY += 7

    if (discount > 0) {
      doc.text("Discount:", totalsX, currentY)
      doc.text(`-₹${discount.toLocaleString("en-IN")}`, pageWidth - 20, currentY, { align: "right" })
      currentY += 7
    }

    if (tax > 0) {
      doc.text("Tax (GST):", totalsX, currentY)
      doc.text(`₹${tax.toLocaleString("en-IN")}`, pageWidth - 20, currentY, { align: "right" })
      currentY += 7
    }

    doc.text("Shipping:", totalsX, currentY)
    doc.text(`₹${shipping.toLocaleString("en-IN")}`, pageWidth - 20, currentY, { align: "right" })
    currentY += 10

    // Total with background
    doc.setFillColor(220, 53, 69)
    doc.rect(totalsX - 5, currentY - 6, 75, 10, "F")

    doc.setFontSize(12)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(255, 255, 255)
    doc.text("TOTAL:", totalsX, currentY)
    doc.text(`₹${total.toLocaleString("en-IN")}`, pageWidth - 20, currentY, { align: "right" })

    // Payment Terms and Notes
    currentY += 20
    if (currentY < pageHeight - 50) {
      doc.setFillColor(245, 245, 245)
      doc.rect(20, currentY, pageWidth - 40, 25, "F")

      doc.setFontSize(10)
      doc.setTextColor(220, 53, 69)
      doc.setFont("helvetica", "bold")
      doc.text("Payment Terms & Notes:", 25, currentY + 7)

      doc.setFontSize(8)
      doc.setTextColor(60, 60, 60)
      doc.setFont("helvetica", "normal")
      const paymentNote =
        order.paymentMethod === "cod"
          ? "Payment to be collected upon delivery. Please keep exact change ready."
          : "Payment has been received and confirmed. Thank you for your purchase."
      doc.text(paymentNote, 25, currentY + 13)
      doc.text("All sales are final. Returns accepted within 7 days with original packaging.", 25, currentY + 18)
    }

    // Footer
    doc.setFillColor(50, 50, 50)
    doc.rect(0, pageHeight - 25, pageWidth, 25, "F")

    doc.setFontSize(9)
    doc.setTextColor(255, 255, 255)
    doc.setFont("helvetica", "normal")
    doc.text("Thank you for shopping with Sara Mobiles and Electronics!", pageWidth / 2, pageHeight - 15, { align: "center" })

    doc.setFontSize(8)
    doc.text("For support: info@saramobiles.com | +91 78920 51553", pageWidth / 2, pageHeight - 9, {
      align: "center",
    })
    doc.text("This is a computer-generated invoice and does not require a signature.", pageWidth / 2, pageHeight - 4, {
      align: "center",
    })

    // Generate PDF buffer
    const pdfBuffer = doc.output("arraybuffer")

    // Return PDF as response
    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Sara Mobiles and Electronics -Invoice-${order._id.toString().slice(-8).toUpperCase()}.pdf"`,
      },
    })
  } catch (error) {
    console.error("Error generating invoice:", error)
    return NextResponse.json({ error: "Failed to generate invoice" }, { status: 500 })
  }
}
