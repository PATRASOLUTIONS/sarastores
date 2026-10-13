# Bulk Order Status Update Guide

## Overview
The bulk order status update feature allows administrators to update multiple order statuses simultaneously by uploading an Excel file. Customers automatically receive email notifications for each status change.

## Features

### 1. Excel Template Download
- **Purple "Download Template" button** provides a pre-formatted Excel file
- Template includes sample data showing the correct format
- Three columns: Order ID, Status, Tracking Number

### 2. File Upload
- Supports `.xlsx`, `.xls`, and `.csv` formats
- Flexible column name recognition (case-insensitive)
- Accepts variations like "Order ID", "orderid", "order", "id"
- Real-time preview of uploaded data

### 3. Automatic Email Notifications
- Customers receive professional HTML emails for each status change
- Email templates match the order status:
  - **Pending**: Order confirmation email
  - **Processing**: Order being prepared email
  - **Shipped**: Shipping notification with tracking number
  - **Delivered**: Delivery confirmation email
  - **Cancelled**: Cancellation notice with refund information

### 4. Validation & Error Handling
- Validates Order ID format (MongoDB ObjectId)
- Checks if orders exist in database
- Validates status values
- Provides detailed success/failure reports

## How to Use

### Step 1: Download Template
1. Click the **"⬇️ Download Template"** button (purple)
2. An Excel file named `bulk_order_update_template.xlsx` will download
3. The template contains sample data showing the correct format

### Step 2: Fill in the Excel File
Open the downloaded template and fill in your data:

| Order ID | Status | Tracking Number |
|----------|--------|-----------------|
| 67890abcdef12345 | shipped | TRACK123456 |
| 12345abcdef67890 | delivered | |
| abcdef1234567890 | processing | |

**Required Fields:**
- **Order ID**: The MongoDB ObjectId of the order (24-character hexadecimal string)
- **Status**: One of: `pending`, `processing`, `shipped`, `delivered`, `cancelled`

**Optional Fields:**
- **Tracking Number**: Required only for `shipped` status, optional for others

### Step 3: Upload the File
1. Click **"📁 Choose Excel File"** button (blue)
2. Select your filled Excel file
3. Preview the data to verify it's correct
4. Click **"✅ Upload & Update"** button (green)

### Step 4: Review Results
After upload, you'll see a summary:
- ✅ Number of successfully updated orders
- ❌ Number of failed updates (if any)
- 📧 Confirmation that email notifications were sent

## Valid Status Values

| Status | Description | Email Sent |
|--------|-------------|------------|
| `pending` | Order confirmed and awaiting processing | ORDER_PENDING |
| `processing` | Order is being prepared | ORDER_PROCESSING |
| `shipped` | Order has been shipped (requires tracking number) | ORDER_SHIPPED |
| `delivered` | Order has been delivered | ORDER_DELIVERED |
| `cancelled` | Order has been cancelled | ORDER_CANCELLED |

## Excel File Format

### Column Names (Case-Insensitive)
The system recognizes multiple variations:

**Order ID Column:**
- "Order ID"
- "orderid"
- "order"
- "id"

**Status Column:**
- "status"
- "order status"
- "order_status"

**Tracking Number Column:**
- "tracking number"
- "tracking"
- "tracking_no"
- "tracking_number"

### Sample Excel Content
```
Order ID                 | Status      | Tracking Number
67890abcdef12345        | shipped     | TRACK123456
12345abcdef67890        | delivered   | 
abcdef1234567890        | processing  |
```

## Email Notifications

### What Customers Receive
When an order status is updated, customers automatically receive:

1. **Professional HTML Email** with:
   - Status-specific header with emoji and gradient
   - Order summary with order number and total
   - List of items in the order
   - Shipping address
   - Status-specific information (tracking for shipped, refund info for cancelled)
   - Support contact information

2. **Email Subject Examples:**
   - "Order Confirmed! #67890abcdef12345 ✅"
   - "Your Order #67890abcdef12345 is Being Processed! 📦"
   - "Your Order #67890abcdef12345 Has Shipped! 🚚"
   - "Order #67890abcdef12345 Delivered Successfully! 🎉"
   - "Order #67890abcdef12345 Cancelled ❌"

### Email Content Highlights

**Pending Email:**
- Green gradient header
- Order confirmation message
- What happens next section
- Estimated processing time

**Processing Email:**
- Blue gradient header
- Items being prepared list
- Quality check information
- Estimated processing time: 1-2 business days

**Shipped Email:**
- Purple gradient header
- Tracking number prominently displayed
- Estimated delivery: 7-8 business days
- Delivery instructions

**Delivered Email:**
- Green gradient header with celebration emoji
- Delivery confirmation
- Request for feedback/review
- Thank you message

**Cancelled Email:**
- Red gradient header
- Cancellation reason (if provided)
- Refund information
- Support contact for questions

## Technical Details

### API Endpoint
**POST** `/api/orders/bulk-update`

**Request Body:**
```json
{
  "rows": [
    {
      "orderId": "67890abcdef12345",
      "status": "shipped",
      "trackingNumber": "TRACK123456"
    }
  ]
}
```

**Response:**
```json
{
  "success": [
    {
      "orderId": "67890abcdef12345",
      "status": "shipped",
      "trackingNumber": "TRACK123456"
    }
  ],
  "failed": [
    {
      "row": {
        "orderId": "invalid_id",
        "status": "shipped"
      },
      "error": "Invalid order ID format"
    }
  ],
  "message": "Processed 1 orders successfully, 1 failed"
}
```

### Database Updates
For each order, the system:
1. Validates the order ID format
2. Checks if order exists
3. Updates the order status
4. Adds tracking number (if provided and status is shipped)
5. Updates the order timeline with new status entry
6. Sets `updatedAt` timestamp

### Timeline Entry Format
```javascript
{
  date: "2025-01-21T16:30:00.000Z",
  status: "Shipped",
  description: "Your order has been shipped"
}
```

### Email Sending Process
1. Order is updated in database
2. System retrieves updated order with customer email
3. Determines appropriate email template based on status
4. Sends email via `/api/notifications/email` endpoint
5. Email failures are logged but don't block the order update

## Error Handling

### Common Errors

**"No rows to upload"**
- Solution: Make sure you've selected and loaded an Excel file

**"Each row must include Order ID and Status"**
- Solution: Ensure all rows have both Order ID and Status filled in

**"Invalid order ID format"**
- Solution: Order IDs must be 24-character hexadecimal strings (MongoDB ObjectId)

**"Order not found"**
- Solution: Verify the Order ID exists in your database

**"Invalid status: [status]"**
- Solution: Use only valid statuses: pending, processing, shipped, delivered, cancelled

### Partial Success
If some orders update successfully and others fail:
- Successful orders are updated and emails are sent
- Failed orders are reported with specific error messages
- You can re-upload only the failed orders after fixing issues

## Best Practices

1. **Always Download Template First**
   - Ensures correct format
   - Provides example data

2. **Verify Order IDs**
   - Copy Order IDs directly from your orders page
   - Don't manually type them to avoid errors

3. **Use Tracking Numbers for Shipped Orders**
   - Customers appreciate tracking information
   - Include tracking numbers when marking orders as shipped

4. **Test with Small Batches**
   - Start with 5-10 orders to verify everything works
   - Then process larger batches

5. **Keep Backup of Excel File**
   - Save your Excel file before uploading
   - Useful if you need to retry failed orders

6. **Check Email Notifications**
   - Verify customers are receiving emails
   - Check spam folders if emails aren't arriving

## Troubleshooting

### Emails Not Sending
- Check SMTP configuration in environment variables
- Verify customer email addresses are valid
- Check server logs for email errors

### Excel File Not Parsing
- Ensure file is in .xlsx, .xls, or .csv format
- Check that column headers match expected names
- Verify no special characters in data

### Orders Not Updating
- Confirm Order IDs are valid MongoDB ObjectIds
- Check that orders exist in database
- Verify status values are lowercase and valid

## Support

For issues or questions:
- **Email**: sales.systechdigital@gmail.com
- **Phone**: +91 78920 51553

## Files Modified

1. **Frontend**: `/app/admin/orders/bulk-update/page.tsx`
   - Added download template button
   - Improved UI with instructions
   - Enhanced error messages
   - Added success notifications

2. **Backend**: `/app/api/orders/bulk-update/route.ts`
   - Handles bulk order updates
   - Sends email notifications
   - Returns detailed success/failure reports

3. **Email Templates**: `/lib/emailTemplates.ts`
   - Professional HTML email templates
   - Status-specific designs
   - Responsive layouts

## Example Workflow

1. Admin downloads template
2. Admin fills in 50 order IDs with "shipped" status and tracking numbers
3. Admin uploads the Excel file
4. System processes all 50 orders:
   - Updates order status to "shipped"
   - Adds tracking numbers
   - Updates order timeline
   - Sends 50 shipping notification emails to customers
5. Admin sees: "✅ Successfully updated 50 order(s) 📧 Email notifications sent to customers"
6. Customers receive professional shipping notification emails with tracking information
