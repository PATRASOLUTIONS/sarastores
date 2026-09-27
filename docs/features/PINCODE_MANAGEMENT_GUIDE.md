# Pincode Management System

## Overview
The pincode management system allows you to control which pincodes can place orders on your e-commerce platform. You can choose between three modes:

1. **Blocked List Mode**: Block specific pincodes from ordering
2. **Allowed List Mode**: Only allow specific pincodes to order
3. **Both Lists Mode**: Use both lists together (pincode must be in allowed list AND not in blocked list)

## Admin Interface

### Location
Navigate to `/admin/blocked-pincodes` in your admin panel.

### Features

#### 1. Mode Selection (Radio Buttons)
- **Blocked List**: Prevents customers from blocked pincodes from placing orders
- **Allowed List**: Only allows customers from allowed pincodes to place orders
- **Both Lists**: Combines both lists - pincode must be in allowed list AND not in blocked list
- Switch between modes instantly with radio buttons
- Current mode is saved and applied to all checkout validations

#### 2. Blocked Pincodes Section (Left Panel)
- Add pincodes to block from ordering
- Include area/locality name and state for better organization
- View all blocked pincodes with their details and count badge
- Remove pincodes individually
- Red-themed UI for clarity

#### 3. Allowed Pincodes Section (Right Panel)
- Add pincodes that are allowed to order
- Include area/locality name and state for better organization
- View all allowed pincodes with their details and count badge
- Remove pincodes individually
- Green-themed UI for clarity

#### 4. Additional Information Fields
- **Pincode**: Required 6-digit pincode
- **Area/Locality Name**: Optional field to identify the location (e.g., "Churchgate", "Connaught Place")
- **State**: Optional field to specify the state (e.g., "Maharashtra", "Delhi")
- **Added At**: Automatically recorded timestamp when pincode is added

### How to Use

#### Adding Pincodes
1. Enter a 6-digit pincode in the first input field (required)
2. Optionally enter the area/locality name in the second field
3. Optionally enter the state in the third field
4. Click "Add to Blocked List" or "Add to Allowed List" button
5. Pincode is added to the respective list with all provided details
6. Success message confirms the action
7. All input fields are cleared for the next entry

#### Removing Pincodes
1. Click "Remove" next to any pincode in the list
2. Pincode is removed immediately
3. Success message confirms the action

#### Switching Modes
1. Click the radio button for your desired mode
2. Mode changes instantly
3. Success message confirms the change
4. New mode is applied to all future checkouts

## Technical Implementation

### Database Structure
Collection: `blocked_pincodes`

Documents:
```javascript
// Blocked list
{
  key: "blocked_list",
  pincodes: [
    {
      pincode: "400001",
      name: "Churchgate",
      state: "Maharashtra",
      addedAt: "2025-01-21T16:30:00.000Z"
    },
    {
      pincode: "400002",
      name: "Kalbadevi",
      state: "Maharashtra",
      addedAt: "2025-01-21T16:35:00.000Z"
    }
  ]
}

// Allowed list
{
  key: "allowed_list",
  pincodes: [
    {
      pincode: "110001",
      name: "Connaught Place",
      state: "Delhi",
      addedAt: "2025-01-21T16:40:00.000Z"
    }
  ]
}

// Active mode
{
  key: "mode",
  value: "blocked" // or "allowed" or "both"
}
```

### API Endpoints

#### GET `/api/blocked-pincodes`
Returns all lists and current mode:
```json
{
  "blockedPincodes": ["400001", "400002"],
  "allowedPincodes": ["110001", "110002"],
  "mode": "blocked" // or "allowed" or "both"
}
```

#### POST `/api/blocked-pincodes`
Add pincode or update mode:
```json
// Add pincode with details
{
  "pincode": "400001",
  "name": "Churchgate",
  "state": "Maharashtra",
  "listType": "blocked" // or "allowed"
}

// Update mode
{
  "mode": "blocked" // or "allowed" or "both"
}
```

**Note:** `name` and `state` fields are optional but recommended for better record-keeping.

#### DELETE `/api/blocked-pincodes`
Remove pincode:
```json
{
  "pincode": "400001",
  "listType": "blocked" // or "allowed"
}
```

### Checkout Validation

The checkout page (`/app/checkout/page.tsx`) validates pincodes based on the active mode:

**Blocked Mode:**
- Checks if customer's pincode is in `blockedPincodes` array
- If found, shows error: "Sorry, we do not deliver to this pincode."
- If not found, allows checkout to proceed

**Allowed Mode:**
- Checks if customer's pincode is in `allowedPincodes` array
- If NOT found, shows error: "Sorry, we do not deliver to this pincode."
- If found, allows checkout to proceed

**Both Mode:**
- Checks if customer's pincode is in `allowedPincodes` array AND not in `blockedPincodes` array
- Pincode must pass BOTH conditions:
  1. Must be in allowed list
  2. Must NOT be in blocked list
- Error messages:
  - If pincode is blocked: "Sorry, we cannot deliver to this pincode. Many orders from this area have been returned, so delivery is currently unavailable."
  - If pincode is not in allowed list: "Sorry, we do not deliver to this pincode."
- If both conditions pass, allows checkout to proceed

### Files Modified

1. **API Route**: `/app/api/blocked-pincodes/route.ts`
   - Updated to handle both lists
   - Added mode management
   - Supports list-specific operations

2. **Admin Page**: `/app/admin/blocked-pincodes/page.tsx`
   - Complete redesign with dual-panel layout
   - Radio button mode selection
   - Separate sections for blocked and allowed lists
   - Real-time success/error messages

3. **Checkout Page**: `/app/checkout/page.tsx`
   - Updated validation logic
   - Supports blocked, allowed, and both modes
   - Maintains backward compatibility

## Use Cases

### Scenario 1: Block Specific Regions
**Mode**: Blocked List
- Add pincodes of regions where you don't deliver
- All other pincodes can place orders
- Useful when you deliver to most areas

### Scenario 2: Limit to Specific Regions
**Mode**: Allowed List
- Add pincodes of regions where you deliver
- Only these pincodes can place orders
- Useful for pilot launches or limited service areas

### Scenario 3: Temporary Restrictions
- Switch to Blocked mode during peak seasons
- Add pincodes with delivery delays
- Switch back when capacity improves

### Scenario 4: Granular Control (Both Mode)
**Mode**: Both Lists
- Add all serviceable pincodes to allowed list
- Add problematic pincodes (within serviceable areas) to blocked list
- Example: Deliver to entire city (allowed list) but exclude specific problematic localities (blocked list)
- Useful for fine-grained control over delivery areas
- Best for managing exceptions within allowed regions
- **Special Feature**: Customers from blocked pincodes see a specific message explaining that many orders from their area have been returned, providing transparency about why delivery is unavailable

## Best Practices

1. **Start with Blocked Mode**: If you deliver to most areas, use blocked mode and add exceptions
2. **Use Allowed Mode for New Launches**: Start with specific pincodes and expand gradually
3. **Use Both Mode for Granular Control**: When you need to allow specific regions but block problematic areas within them
4. **Keep Lists Updated**: Regularly review and update pincode lists
5. **Test Before Switching**: Verify your lists before changing modes
6. **Monitor Checkout Errors**: Track which pincodes are being blocked to adjust strategy
7. **Avoid Empty Lists in Both Mode**: Ensure allowed list has entries when using both mode, otherwise all pincodes will be blocked

## UI Features

- **Responsive Design**: Works on desktop and mobile
- **Real-time Updates**: Changes reflect immediately
- **Visual Feedback**: Success/error messages for all actions
- **Count Badges**: Shows number of pincodes in each list
- **Scrollable Lists**: Handles large numbers of pincodes
- **Keyboard Support**: Press Enter to add pincodes
- **Color-Coded**: Red for blocked, green for allowed, purple for both mode
- **Three Radio Options**: Easy mode switching with clear descriptions

## Migration Notes

If you had pincodes in the old system (stored with key "list"), you'll need to:
1. Export existing pincodes
2. Add them to either blocked or allowed list
3. Set the appropriate mode

The system defaults to "blocked" mode for backward compatibility.
