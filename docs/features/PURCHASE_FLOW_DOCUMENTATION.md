# Complete Purchase Flow Documentation

This document outlines the complete end-to-end purchase flows for the e-commerce application for both **Online Purchase** and **In-Store Purchase** scenarios.

---

## 1. ONLINE PURCHASE FLOW

### 1.1 Product Discovery & Cart Management

#### Step 1: Browse & Add to Cart
- **User Action**: Customer browses products on the website
  - View products on home page, category pages, or product detail pages
  - Filter and search for desired products
  
- **Add to Cart**: 
  - User must be **logged in** to add items to cart
  - If not logged in → redirected to login page with return URL
  - Click "Add to Cart" button on product card or product detail page
  - Select quantity (validated against stock availability)
  - For software products: packSize, validityYears, maxDevices are captured
  - For hardware products: color, size variants may be selected
  
- **Technical Details**:
  - Component: `AddToCartButton.tsx`, `CategoryProductCard.tsx`
  - Hook: `useCart()` from `hooks/useCart.ts`
  - Storage: Cart stored in localStorage as `cart_${userId}`
  - Cart items include: id, name, price, quantity, image, type (software/hardware), and product-specific attributes

#### Step 2: View Cart
- **Page**: `/cart` (`app/cart/page.tsx`)
- **User Actions**:
  - Review cart items with thumbnails, prices, quantities
  - Update quantities using +/- buttons
  - Remove items from cart
  - Clear entire cart
  
- **Price Calculations**:
  ```
  Subtotal = Sum of (item.price × item.quantity) for all items
  
  Software Tax = Subtotal of software items × 18% GST
  Hardware Tax = Subtotal of hardware items × 18% GST
  Total Tax = Software Tax + Hardware Tax
  
  Shipping = FREE if hardware subtotal > ₹1,000
            = ₹1,000 if hardware subtotal ≤ ₹1,000
            = ₹0 if only software items
  
  Total = Subtotal + Tax + Shipping
  ```

- **Technical Details**:
  - Real-time calculation using `useEffect` hook
  - Display: Items count, subtotal, tax (18% GST), shipping, total
  - Free shipping indicator shown when applicable

#### Step 3: Proceed to Checkout
- **User Action**: Click "Proceed to Checkout" button
- **Validation**: Cart must not be empty
- **Navigation**: User redirected to `/checkout`

---

### 1.2 Checkout Process

#### Step 1: Customer Details (Step 1/2)
- **Page**: `/checkout` (`app/checkout/page.tsx`)
- **User Input Required**:
  ```
  - First Name *
  - Last Name *
  - Email *
  - Phone *
  - Address *
  - City * (dropdown with Indian cities)
  - State * (dropdown with Indian states)
  - Pincode * (6-digit Indian pincode)
  - Country (default: India)
  ```

- **Auto-fill**: If user profile exists, pre-populate fields from user data
- **Validation**:
  - All required fields must be filled
  - Pincode validation: Check delivery availability via `/api/pincode/check`
  - If pincode not serviceable → error toast displayed
  
- **Technical Details**:
  - Form state managed in `customerData` state object
  - Real-time validation on "Continue to Payment" button click
  - Progress indicator shows Step 1 of 2

#### Step 2: Payment Method Selection (Step 2/2)
- **Available Payment Methods**:

  **Option A: Online Payment (Razorpay)**
  - Radio button selection: "Online Payment"
  - Description: "Pay securely using UPI, Cards, or Net Banking"
  - Icon: 💳

  **Option B: Cash on Delivery (COD)**
  - Radio button selection: "Cash on Delivery"  
  - Description: "Pay when you receive your order"
  - Icon: 💵
  - Status: Marked as "pending" payment

  **Option C: In-Store Purchase**
  - See Section 2 below for complete flow
  
- **Order Summary (Right Sidebar)**:
  - Cart items with thumbnails, names, quantities, prices
  - Coupon code input field
    - Enter coupon code
    - Click "Apply" to validate
    - API: `/api/coupons/validate` (POST)
    - If valid: Discount applied, shown in summary
    - Coupon data stored with order for tracking
  - Subtotal
  - Tax (18% GST)
  - Shipping
  - Coupon discount (if applied)
  - **Total Amount**

---

### 1.3 Payment Processing

#### For Online Payment (Razorpay):

1. **Payment Gateway Integration** (`components/PaymentGateway.tsx`):
   - Razorpay script loaded dynamically
   - User clicks payment method → Razorpay modal opens
   
2. **Create Razorpay Order**:
   - API: `/api/payment/create-order` (POST)
   - Request Body:
     ```json
     {
       "amount": 15000,
       "currency": "INR",
       "receipt": "order_1704123456789",
       "notes": {
         "customer_name": "John Doe",
         "customer_email": "john@example.com",
         "customer_phone": "9876543210",
         "customer_address": "123 Street Name",
         "customer_city": "Mumbai",
         "customer_state": "Maharashtra",
         "customer_zipcode": "400001",
         "order_amount": "15000",
         "order_items_count": "2",
         "item_names": "Product A, Product B",
         "item_types": "hardware, software"
       }
     }
     ```
   - Response: Razorpay order ID, key ID, amount

3. **Razorpay Checkout Modal**:
   - User selects payment method (UPI, Card, Net Banking, etc.)
   - Enters payment details
   - Completes payment

4. **Payment Verification**:
   - On success, Razorpay returns:
     - `razorpay_order_id`
     - `razorpay_payment_id`
     - `razorpay_signature`
   - API: `/api/payment/verify` (POST)
   - Server verifies signature using Razorpay secret
   - Updates payment notes with customer details
   
5. **Payment Success Callback**:
   - `handlePaymentSuccess()` triggered
   - Payment details passed to order creation:
     ```json
     {
       "method": "razorpay",
       "status": "completed",
       "paymentId": "pay_xxx",
       "orderId": "order_xxx",
       "transactionId": "razorpay_payment_id"
     }
     ```

#### For Cash on Delivery:

1. **COD Processing**:
   - Simulated 1-second processing delay
   - Payment details created:
     ```json
     {
       "method": "cash-on-delivery",
       "status": "pending",
       "transactionId": "COD1704123456789"
     }
     ```
   - No Razorpay integration required

---

### 1.4 Order Creation

**API**: `/api/orders` (POST) (`app/api/orders/route.ts`)

**Request Body**:
```json
{
  "userId": "user123",
  "items": [
    {
      "id": "prod123",
      "name": "Product Name",
      "price": 5000,
      "quantity": 1,
      "image": "/image.jpg",
      "type": "hardware",
      "provider": null,
      "source": null,
      "category": "Electronics"
    }
  ],
  "customer": {
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "phone": "9876543210",
    "address": "123 Street",
    "city": "Mumbai",
    "state": "Maharashtra",
    "zipCode": "400001",
    "country": "India"
  },
  "shippingAddress": {
    "name": "John Doe",
    "street": "123 Street",
    "city": "Mumbai",
    "state": "Maharashtra",
    "zip": "400001",
    "country": "India"
  },
  "paymentMethod": "razorpay",
  "paymentDetails": {
    "method": "razorpay",
    "status": "completed",
    "paymentId": "pay_xxx",
    "orderId": "order_xxx",
    "transactionId": "xxx"
  },
  "subtotal": 5000,
  "tax": 900,
  "shipping": 1000,
  "total": 6900,
  "status": "confirmed",
  "coupon": {
    "code": "SAVE10",
    "name": "10% Off",
    "discount": 500
  }
}
```

**Order Processing**:

1. **Validation**:
   - Verify required fields: userId, items, total, customer
   - Validate items array is non-empty
   - Normalize item fields

2. **Order Document Creation**:
   - Generate comprehensive order notes with all details
   - Create order timeline with initial "Order Placed" status
   - Store coupon information if applied
   - Insert into MongoDB `orders` collection

3. **Software License Assignment** (if applicable):
   - Filter software items from order
   - For each software item (without external provider):
     - Call `/api/orders/{orderId}/assign-license` (POST)
     - Payload includes: softwareId, validity, validityYears, maxDevices, quantity
     - Fire-and-forget async call
     - Licenses assigned from inventory

4. **Integration Provider Orders** (if applicable):
   - Group items by provider (e.g., KGen, exlr8)
   - For each provider:
     - Call `/api/integrations/{provider}/place-order` (POST)
     - Send orderId, userId, items to external system
     - Track queued/placed status

5. **Order Confirmation Email**:
   - Template: `emailTemplates.ORDER_PENDING`
   - Sent to customer email
   - Contains: Order ID, items, total, delivery address

6. **Coupon Redemption**:
   - If coupon was applied, mark as redeemed
   - API: `/api/coupons/redeem` (POST)
   - Prevents reuse (if single-use coupon)

7. **Cart Clearing**:
   - Cart items removed from localStorage
   - `clearCart()` function called

**Response**:
```json
{
  "success": true,
  "orderId": "67890abcdef123456",
  "message": "Order placed successfully"
}
```

---

### 1.5 Order Confirmation

**Page**: `/checkout` (order placed view)

**Display**:
- ✅ Green checkmark icon
- "Order Confirmed!" heading
- Thank you message
- Order details in card:
  - **Order ID**: `ORD1704123456789`
  - **Total Amount**: ₹6,900
  - **Payment Method**: Online Payment / COD
  - **Delivery Address**: Full address
  - **Consumer Name**: John Doe

**Order Status Icons**:
- 📦 **Order Processing**: "Your order is being prepared"
- 🚚 **Shipping**: "Expected delivery in 7-8 days"
- 🛡️ **Secure Payment**: "Your payment is protected"

**Action Buttons**:
- "View Order Details" → `/dashboard/orders/{orderId}`
- "Download Invoice" → `/api/orders/{orderId}/invoice`
- "Track Your Order" → Order tracking page
- "Continue Shopping" → Home page

---

### 1.6 Post-Order Processing

**Timeline Updates**:
Orders go through the following statuses:
1. **Order Placed** - Initial creation
2. **Processing** - Order being prepared
3. **Shipped** - Out for delivery (tracking number assigned)
4. **Delivered** - Successfully delivered
5. **Cancelled** - If cancelled (before shipment)

**Admin Actions** (via `/admin/orders`):
- Update order status
- Assign tracking number
- Process refunds
- Manage customer inquiries

**Customer Access** (via `/dashboard/orders`):
- View all orders
- Track order status
- Download invoices
- Request cancellations (before shipment)

---

## 2. IN-STORE PURCHASE FLOW

### 2.1 Prerequisites
- Customer visits physical store
- Employee has access to website/POS system
- Employee is registered in system with:
  - Employee ID
  - Email address
  - Active status

---

### 2.2 Cart Management (Same as Online)
- Employee logs in with their account
- Adds customer's desired items to cart
- Reviews cart totals
- Proceeds to checkout

---

### 2.3 Checkout Process

#### Step 1: Customer Details
- Employee enters customer's delivery/billing information
- Same validation as online purchase
- Continues to payment step

#### Step 2: Payment Method Selection
- **Select**: "In-store Purchase" radio button
- Icon: 🏪
- Description: "Verify with employee ID and email"

**Note**: After successful in-store purchase processing, employees can view all their processed orders in their dashboard under the "In-Store Purchases Processed" section.

---

### 2.4 Employee Verification Process

**Component**: `InStorePurchase.tsx`

#### Phase 1: Employee Validation

1. **Employee Enters Credentials**:
   - Email address
   - Employee ID
   
2. **Real-time Validation**:
   - **API**: `/api/employees/validate` (POST)
   - **Debounced**: 500ms delay after typing
   - **Request**:
     ```json
     {
       "employeeId": "EMP001",
       "email": "employee@company.com"
     }
     ```
   
3. **Validation Logic**:
   - Check if employee exists in `employees` collection
   - Verify `status === "active"`
   - Match email with employeeId
   - **Response (Valid)**:
     ```json
     {
       "valid": true,
       "message": "Valid employee",
       "employee": {
         "id": "xxx",
         "employeeId": "EMP001",
         "name": "John Smith"
       }
     }
     ```
   - **Response (Invalid)**:
     ```json
     {
       "valid": false,
       "message": "Invalid employee ID"
     }
     ```

4. **UI Feedback**:
   - ✅ Green border if valid
   - ❌ Red border if invalid
   - Validation message displayed below inputs
   - "Send OTP" button enabled only when valid

#### Phase 2: OTP Generation & Verification

5. **Send OTP**:
   - Employee clicks "Send OTP" button
   - **API**: `/api/auth/store-purchase` (POST)
   - **Request**:
     ```json
     {
       "email": "employee@company.com",
       "employeeId": "EMP001",
       "action": "verify"
     }
     ```

6. **OTP Generation**:
   - 6-digit random OTP generated
   - Stored in memory with 5-minute expiry
   - **Email sent via Nodemailer** (Gmail SMTP):
     - Subject: "In-store Purchase Verification"
     - Body: OTP code, employee ID, expiry notice
     - Template: HTML formatted email

7. **OTP Input**:
   - Input field revealed for OTP entry
   - Employee receives email and enters OTP
   - "Verify OTP" button enabled when OTP entered

8. **OTP Validation**:
   - Employee clicks "Verify OTP"
   - **API**: `/api/auth/store-purchase` (POST)
   - **Request**:
     ```json
     {
       "email": "employee@company.com",
       "employeeId": "EMP001",
       "otp": "123456",
       "action": "validate"
     }
     ```

9. **Validation Logic**:
   - Check if OTP exists for email
   - Verify OTP hasn't expired (5-minute window)
   - Match provided OTP with stored OTP
   - **Response (Success)**:
     ```json
     {
       "success": true,
       "message": "Verified successfully"
     }
     ```
   - **Response (Failure)**:
     ```json
     {
       "success": false,
       "message": "Invalid or expired OTP"
     }
     ```

10. **Verification Success**:
    - Success toast: "Verified successfully"
    - `onVerified()` callback triggered with:
      ```json
      {
        "employeeId": "EMP001",
        "email": "employee@company.com"
      }
      ```

---

### 2.5 Order Creation (In-Store)

**Automatic Trigger**: After OTP verification success

**Payment Details Passed**:
```json
{
  "method": "instore",
  "status": "completed",
  "employeeId": "EMP001",
  "verifiedEmail": "employee@company.com"
}
```

**Order Processing**:

1. **Processing Loader Displayed**:
   - Full-page loader shown
   - Message: "Processing the order"
   - Sub-message: "We're verifying your in-store purchase and finalizing the order"

2. **Order API Call**: `/api/orders` (POST)
   - Same structure as online purchase
   - Additional fields:
     ```json
     {
       "paymentMethod": "instore",
       "employeeId": "EMP001",
       "paymentDetails": {
         "method": "instore",
         "status": "completed",
         "employeeId": "EMP001",
         "verifiedEmail": "employee@company.com",
         "verifiedAt": "2024-01-03T10:30:00.000Z"
       }
     }
     ```

3. **Order Stored**:
   - Status: "confirmed" (already paid in-store)
   - Employee details recorded for audit trail
   - Same post-processing as online orders:
     - Software license assignment
     - Order confirmation email
     - Coupon redemption
     - Cart clearing

4. **Success Confirmation**:
   - Same confirmation page as online purchase
   - Order ID generated and displayed
   - Customer can download invoice immediately
   - Employee can print receipt for customer

---

### 2.6 In-Store Purchase Benefits

**For Store**:
- Digital record of all in-store transactions
- Employee accountability with OTP verification
- Automatic inventory management
- Integrated with online order system

**For Customer**:
- Digital invoice and order tracking
- Access to order history in customer dashboard
- Same warranty and support as online orders
- Option to track shipping if items need delivery

**For Employee**:
- Simple verification process
- Secure with OTP authentication
- Can view their processed orders via employee dashboard
- Order linked to their employee ID for commission/tracking
- **Dashboard Access**: In their `/dashboard` page, a dedicated "In-Store Purchases Processed" section shows:
  - Total number of orders processed
  - Total amount of sales processed
  - Detailed list of all in-store orders they've handled
  - Customer information for each order
  - Order status and timeline
  - Quick access to view order details and download invoices

---

## 3. COMMON FEATURES (Both Flows)

### Employee Dashboard**: `/dashboard` (for store employees)
  - **In-Store Purchases Processed** section (appears if employee has processed any in-store orders)
  - Shows all orders processed using their verified email
  - Statistics: Total orders processed, total sales amount
  - Order details with customer information
  - Quick actions: View details, download invoice
  - Real-time order status updates

- **3.1 Order Management
- **Customer Dashboard**: `/dashboard/orders`
  - View all orders (online + in-store)
  - Filter by status
  - Download invoices
  - Track shipments

- **Admin Dashboard**: `/admin/orders`
  - View all orders
  - Update order status
  - Assign tracking numbers
  - Process refunds
  - View employee-processed orders

### 3.2 Software License Management
- Automatic license assignment for software products
- Licenses sent via email
- Stored in order details
- Customer can view in dashboard

### 3.3 Invoice Generation
- **API**: `/api/orders/{orderId}/invoice` (GET)
- PDF invoice with:
  - Company branding
  - Order details
  - Itemized list
  - Tax breakdown
  - Payment information
  - QR code for verification

### 3.4 Email Notifications
- Order confirmation
- Payment confirmation
- Shipping updates
- Delivery confirmation
- Software license delivery

### 3.5 Integration Support
- External provider integration (KGen, exlr8)
- Automatic order forwarding
- Queue management for async processing
- Status tracking from providers

---page.tsx` - User dashboard (includes in-store purchases section for employees)
  - `/app/dashboard/

## 4. TECHNICAL ARCHITECTURE

### 4.1 Frontend Components
- **Pages**:
  - `/app/cart/page.tsx` - Shopping cart
  - `/app/checkout/page.tsx` - Checkout flow
  - `/app/dashboard/orders/page.tsx` - Order history
  
- **Components**:
  - `AddToCartButton.tsx` - Add to cart functionality
  - `PaymentGateway.tsx` - Razorpay integration
  - `InStorePurchase.tsx` - Employee verification

- **Hooks**:
  - `useCart.ts` - Cart state management
  - `useAuth.ts` - Authentication

### 4.2 Backend APIs (supports `employeeId` query parameter)
- `/api/payment/create-order` - Razorpay order creation
- `/api/payment/verify` - Payment verification
- `/api/employees/validate` - Employee validation
- `/api/auth/store-purchase` - OTP generation & validation
- `/api/coupons/validate` - Coupon validation
- `/api/coupons/redeem` - Coupon redemption
- `/api/pincode/check` - Delivery availability

**Special Query Parameters**:
- `/api/orders?userId={userId}` - Get orders for specific user
- `/api/orders?employeeId={email}` - Get orders processed by employee email
- `/api/orders?limit={number}` - Limit number of results
- `/api/pincode/check` - Delivery availability

### 4.3 Database Collections
- **orders**: Order documents
- **employees**: Employee records
- **carts**: User cart data
- **coupons**: Coupon definitions
- **software**: Software licenses inventory
- **products**: Product catalog

### 4.4 External Integrations
- **Razorpay**: Payment gateway
- **Nodemailer**: Email service (Gmail SMTP)
- **MongoDB**: Database
- **KGen/exlr8**: Product providers (optional)

---

## 5. SECURITY CONSIDERATIONS

### 5.1 Authentication
- User must be logged in for cart and checkout
- JWT token-based authentication
- Session management

### 5.2 Payment Security
- Razorpay PCI-DSS compliant
- Signature verification for payments
- HTTPS for all transactions

### 5.3 In-Store Purchase Security
- OTP-based employee verification
- 5-minute OTP expiry
- Email verification required
- Employee status validation (must be active)
- Audit trail with employee ID stored

### 5.4 Data Protection
- Customer data encrypted in transit
- Secure password storage
- Order data audit trail
- GDPR compliance considerations

---

## 6. ERROR HANDLING

### 6.1 Common Error Scenarios

**Cart Issues**:
- Empty cart → Redirect to cart page
- Stock unavailable → Display error, prevent checkout
- Invalid quantity → Auto-correct or show error

**Checkout Issues**:
- Missing required fields → Inline validation errors
- Invalid pincode → Toast error message
- Payment failure → Retry option, error message
- Network error → Retry mechanism

**In-Store Issues**:
- Invalid employee ID → Validation error shown
- Email mismatch → Validation error shown
- OTP not received → Resend option
- Expired OTP → Request new OTP
- Invalid OTP → Error message, retry

**Order Creation Issues**:
- Database error → Error toast, retry option
- Email send failure → Order still created, email queued
- License assignment failure → Order created, manual assignment

---

## 7. TESTING SCENARIOS

### 7.1 Online Purchase Testing
1. Add items to cart (software + hardware)
2. Verify cart calculations
3. Proceed to checkout
4. Fill customer details
5. Test pincode validation
6. Apply coupon code
7. Select payment method (Razorpay)
8. Complete payment
9. Verify order creation
10. Check email confirmation
11. View order in dashboard

### 7.2 In-Store Purchase Testing
1. Employee login
2. Add items to cart
3. Proceed to checkout
4. Fill customer details
5. Select in-store purchase
6. Enter valid employee credentials
7. Verify validation feedback
14. **Navigate to employee dashboard (`/dashboard`)**
15. **Verify "In-Store Purchases Processed" section appears**
16. **Confirm order is listed with correct details**
17. **Test statistics display (total processed, total amount)**
18. **Test action buttons (View Details, Download Invoice)**
8. Send OTP
9. Check email received
10. Enter OTP
11. Verify OTP
12. Confirm order creation
13. Check order linked to employee ID

---

## 8. FUTURE ENHANCEMENTS

### 8.1 Planned Features
- **Online Purchase**:
  - Multiple payment methods (Wallet, EMI)
  - Employee performance reports based on processed orders
  - Commission calculation for employees
    - Saved addresses
  - Gift wrapping options
  - Scheduled delivery
  
- **In-Store Purchase**:
  - Barcode scanning for products
  - Tablet/mobile POS interface
  - Print receipt directly
  - Split payment options
  - Loyalty points integration

- **General**:
  - Order modification before shipment
  - Return/exchange flow
  - Real-time order tracking
  - WhatsApp notifications
  - Multi-language support

---

## Document Version
- **Version**: 1.0
- **Last Updated**: January 3, 2026
- **Author**: System Documentation
- **Status**: Current Production Flow
