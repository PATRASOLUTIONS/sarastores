# Software Sales System - Complete Guide

## Overview
A comprehensive software product sales system with license key management, inventory tracking, and automated email delivery.

## Features Implemented

### 1. **Software Product Management**
- Create and manage software products
- Set pricing for different pack sizes (1-5 licenses)
- Configure validity periods (1-5 years)
- Add product features and system requirements
- Track inventory (available vs assigned keys)

### 2. **License Key Management**
- Bulk import license keys
- Assign keys automatically during checkout
- Track key status (available, assigned, expired, revoked)
- View customer assignments
- Export keys to CSV
- Revoke keys when needed

### 3. **Customer Experience**
- Browse software products at `/software`
- Select pack size (1-5 licenses)
- Choose validity period (1-5 years)
- Dynamic pricing calculation
- Add to cart alongside hardware products
- Instant key delivery via email

### 4. **Admin Dashboard**
- Manage software products at `/admin/software`
- Add/edit/delete products
- Manage license keys at `/admin/software/[id]/keys`
- View statistics (total keys, available, assigned)
- Track which keys are assigned to which customers

### 5. **Automated Email Delivery**
- Order confirmation email
- Separate email with license keys
- Beautiful HTML templates with light mode enforcement
- Keys displayed in easy-to-copy format
- Activation instructions included

## File Structure

```
├── types/
│   └── software.ts                    # TypeScript interfaces
├── lib/
│   ├── software-service.ts            # Database operations
│   └── emailTemplates.ts              # Email templates (updated)
├── app/
│   ├── software/
│   │   └── page.tsx                   # Customer-facing software store
│   ├── admin/
│   │   └── software/
│   │       ├── page.tsx               # Software products list
│   │       ├── new/
│   │       │   └── page.tsx           # Add new software
│   │       └── [id]/
│   │           └── keys/
│   │               └── page.tsx       # License key management
│   └── api/
│       ├── software/
│       │   ├── route.ts               # CRUD operations
│       │   ├── [id]/
│       │   │   └── route.ts           # Single product operations
│       │   └── license-keys/
│       │       └── route.ts           # Key management API
│       └── orders/
│           └── route.ts               # Updated with key assignment
```

## Database Collections

### `software_products`
```javascript
{
  _id: ObjectId,
  name: String,
  description: String,
  shortDescription: String,
  category: String,
  image: String,
  features: [String],
  systemRequirements: {
    os: [String],
    processor: String,
    ram: String,
    storage: String
  },
  pricing: {
    pack1: Number,  // 1 license
    pack2: Number,  // 2 licenses
    pack3: Number,  // 3 licenses
    pack4: Number,  // 4 licenses
    pack5: Number   // 5 licenses
  },
  validityPeriods: {
    oneYear: Number,
    twoYear: Number,
    threeYear: Number,
    fourYear: Number,
    fiveYear: Number
  },
  status: String,  // 'active' | 'inactive' | 'out-of-stock'
  totalKeysAvailable: Number,
  totalKeysAssigned: Number,
  createdAt: Date,
  updatedAt: Date
}
```

### `license_keys`
```javascript
{
  _id: ObjectId,
  softwareId: String,
  softwareName: String,
  key: String,
  status: String,  // 'available' | 'assigned' | 'expired' | 'revoked'
  validityYears: Number,  // 1-5
  assignedTo: {
    customerId: String,
    customerEmail: String,
    customerName: String,
    orderId: String,
    orderNumber: String
  },
  assignedAt: Date,
  expiresAt: Date,
  activatedAt: Date,
  revokedAt: Date,
  revokedReason: String,
  createdAt: Date,
  updatedAt: Date
}
```

### `orders` (Updated)
```javascript
{
  // ... existing fields ...
  items: [{
    // ... existing fields ...
    type: String,  // 'software' | 'hardware'
    packSize: Number,  // For software only
    validityYears: Number  // For software only
  }],
  softwareLicenses: [{
    softwareName: String,
    keys: [{
      key: String,
      validityYears: Number,
      expiresAt: Date
    }]
  }]
}
```

## How It Works

### 1. Admin Creates Software Product
1. Go to `/admin/software`
2. Click "Add Software"
3. Fill in product details:
   - Name, description, category
   - Features and system requirements
   - Pack pricing (1-5 licenses)
   - Validity period pricing (1-5 years)
4. Save product

### 2. Admin Adds License Keys
1. Go to `/admin/software/[id]/keys`
2. Click "Add Keys"
3. Select validity period
4. Paste keys (one per line)
5. Keys are added to inventory

### 3. Customer Purchases Software
1. Visit `/software`
2. Browse available software
3. Click "Select Options"
4. Choose pack size (1-5 licenses)
5. Choose validity period (1-5 years)
6. Price calculated automatically
7. Add to cart
8. Proceed to checkout

### 4. Automatic Key Assignment
When order is placed:
1. System checks for available keys
2. Assigns required number of keys
3. Updates key status to "assigned"
4. Stores assignment details
5. Updates inventory counts
6. Sends confirmation email
7. Sends separate email with license keys

### 5. Customer Receives Keys
Customer gets two emails:
1. **Order Confirmation** - Standard order details
2. **License Keys** - Contains:
   - All license keys
   - Validity period for each
   - Expiration dates
   - Activation instructions
   - Support contact info

## API Endpoints

### Software Products
- `GET /api/software` - List all products
- `GET /api/software?status=active` - Filter by status
- `POST /api/software` - Create product
- `GET /api/software/[id]` - Get single product
- `PUT /api/software/[id]` - Update product
- `DELETE /api/software/[id]` - Delete product

### License Keys
- `GET /api/software/license-keys` - List all keys
- `GET /api/software/license-keys?softwareId=[id]` - Filter by software
- `GET /api/software/license-keys?status=available` - Filter by status
- `POST /api/software/license-keys` - Add keys
- `PATCH /api/software/license-keys` - Revoke key

## Pricing Calculation

Total Price = Pack Base Price + Validity Period Price

Example:
- Pack 1 (1 license): ₹5,000
- Pack 3 (3 licenses): ₹12,000
- 1 Year validity: ₹2,000
- 3 Year validity: ₹5,000

Customer selects: 3 licenses + 3 years
Total: ₹12,000 + ₹5,000 = ₹17,000

## Admin Features

### Dashboard Statistics
- Total products
- Active products
- Total available keys
- Total assigned keys

### Product Management
- Create/Edit/Delete products
- Set status (active/inactive)
- View key inventory
- Quick access to key management

### Key Management
- View all keys for a product
- Filter by status
- See customer assignments
- Copy keys to clipboard
- Revoke keys
- Export to CSV

### Key Tracking
- Which key assigned to which customer
- Order number reference
- Assignment date
- Expiration date
- Current status

## Customer Features

### Software Store Page
- Clean, modern UI
- Product cards with key info
- Feature highlights
- System requirements
- Real-time availability

### Product Selection Modal
- Pack size selector (1-5)
- Validity period selector (1-5 years)
- Live price calculation
- Feature list
- System requirements
- Add to cart

### Cart Integration
- Software items mixed with hardware
- Shows pack size and validity
- Correct pricing
- Same checkout flow

## Email Templates

### Order Confirmation
- Standard order details
- All items (hardware + software)
- Shipping address (if applicable)
- Payment details

### License Keys Email
- Separate dedicated email
- Beautiful purple gradient design
- Each software product listed
- All keys displayed in monospace font
- Copy-friendly format
- Validity and expiration info
- Activation instructions
- Important security notes
- Support contact info

## Security Features

1. **Key Protection**
   - Keys only sent to verified email
   - Stored securely in database
   - Assignment tracked with order ID

2. **Inventory Management**
   - Real-time availability checking
   - Prevents overselling
   - Automatic count updates

3. **Audit Trail**
   - Track all key assignments
   - Customer information stored
   - Order reference maintained
   - Revocation reasons logged

## Usage Tips

### For Admins

1. **Adding Products**
   - Use clear, descriptive names
   - Add comprehensive features list
   - Specify accurate system requirements
   - Set competitive pricing

2. **Managing Keys**
   - Add keys in bulk for efficiency
   - Use consistent key format
   - Regular inventory checks
   - Monitor expiring keys

3. **Customer Support**
   - Export keys for reference
   - Track customer assignments
   - Revoke keys if needed
   - Provide activation help

### For Customers

1. **Purchasing**
   - Check system requirements
   - Choose appropriate pack size
   - Consider longer validity for savings
   - Save license email

2. **Activation**
   - Keep keys secure
   - Follow activation instructions
   - Contact support if issues
   - Note expiration dates

## Future Enhancements

Potential additions:
- Key activation tracking
- Automatic expiry notifications
- Key renewal system
- Download links for software
- Multi-device license management
- License transfer between users
- Bulk purchase discounts
- Subscription-based licensing

## Troubleshooting

### Keys Not Assigned
- Check if keys are available in inventory
- Verify validity period matches
- Check console logs for errors
- Ensure database connection

### Email Not Received
- Check spam folder
- Verify SMTP configuration
- Check email logs
- Confirm customer email address

### Inventory Issues
- Verify key count in database
- Check for duplicate keys
- Ensure proper status updates
- Review assignment logs

## Support

For issues or questions:
- Email: sales.systechdigital@gmail.com
- Phone: +91 78920 51553

---

**System Status**: ✅ Fully Operational
**Last Updated**: October 2025
