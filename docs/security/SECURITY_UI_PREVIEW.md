# 🎨 Security UI Preview

This document shows what users will see with the new security features.

## Login Page States

### 1️⃣ Normal State (No Failed Attempts)
```
┌────────────────────────────────────────────────┐
│           Sign in to your account              │
│      Or create a new account                   │
├────────────────────────────────────────────────┤
│                                                │
│  Email Address                                 │
│  📧 [___________________________]              │
│                                                │
│  Password                                      │
│  🔒 [___________________________] 👁           │
│                                                │
│  ☐ Remember me      Forgot your password?     │
│                                                │
│  [       Sign in       ]                       │
│                                                │
│  ← Back to Home                                │
└────────────────────────────────────────────────┘
```

### 2️⃣ After 1 Failed Attempt
```
┌────────────────────────────────────────────────┐
│           Sign in to your account              │
│      Or create a new account                   │
├────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────┐ │
│  │ 🛡️ 2 attempts remaining before temporary │ │
│  │    lockout.                               │ │
│  └──────────────────────────────────────────┘ │
│                                                │
│  ┌──────────────────────────────────────────┐ │
│  │ ❌ Invalid credentials. 2 attempts        │ │
│  │    remaining before temporary lockout.    │ │
│  └──────────────────────────────────────────┘ │
│                                                │
│  Email Address                                 │
│  📧 [user@example.com_____________]            │
│                                                │
│  Password                                      │
│  🔒 [**********_______________] 👁             │
│                                                │
│  ☐ Remember me      Forgot your password?     │
│                                                │
│  [       Sign in       ]                       │
└────────────────────────────────────────────────┘
```

### 3️⃣ After 3 Failed Attempts (LOCKED)
```
┌────────────────────────────────────────────────┐
│           Sign in to your account              │
│      Or create a new account                   │
├────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────┐ │
│  │ ⚠️ Account Temporarily Locked            │ │
│  │                                           │ │
│  │ Too many failed login attempts. Please    │ │
│  │ try again in 4:58.                        │ │
│  └──────────────────────────────────────────┘ │
│                                                │
│  Email Address                                 │
│  📧 [user@example.com_____________]            │
│                                                │
│  Password                                      │
│  🔒 [**********_______________] 👁             │
│                                                │
│  ☐ Remember me      Forgot your password?     │
│                                                │
│  [ 🔒 Locked (4:58) ] ← DISABLED               │
└────────────────────────────────────────────────┘
```

### 4️⃣ Countdown Updates (Every Second)
```
First second:    🔒 Locked (4:59)
After 1 min:     🔒 Locked (3:59)
After 2 mins:    🔒 Locked (2:59)
After 4 mins:    🔒 Locked (0:59)
After 4:30 mins: 🔒 Locked (0:30)
After 4:59 mins: 🔒 Locked (0:01)
After 5 mins:    [    Sign in    ] ← RE-ENABLED
```

## Register Page States

### 1️⃣ Normal State
```
┌────────────────────────────────────────────────┐
│          Create your account                   │
│    Already have an account? Sign in here       │
├────────────────────────────────────────────────┤
│                                                │
│  Full Name                                     │
│  👤 [___________________________]              │
│                                                │
│  Email Address                                 │
│  📧 [___________________________]              │
│                                                │
│  Password                                      │
│  🔒 [___________________________] 👁           │
│                                                │
│  Confirm Password                              │
│  🔒 [___________________________] 👁           │
│                                                │
│  ☐ I agree to the Terms and Conditions        │
│     and Privacy Policy                         │
│                                                │
│  [    Create account    ]                      │
│                                                │
│  ← Back to Home                                │
└────────────────────────────────────────────────┘
```

### 2️⃣ Password Validation Errors
```
┌────────────────────────────────────────────────┐
│  Password                                      │
│  🔒 [Pass123__________________] 👁             │
│  ❌ Password must be at least 8 characters    │
│                                                │
│  🔒 [password1________________] 👁             │
│  ❌ Password must contain at least one        │
│     uppercase letter, one lowercase letter,   │
│     and one number                             │
│                                                │
│  🔒 [Password1________________] 👁             │
│  ✅ Valid password                             │
└────────────────────────────────────────────────┘
```

### 3️⃣ After Failed Attempts (LOCKED)
```
┌────────────────────────────────────────────────┐
│          Create your account                   │
│    Already have an account? Sign in here       │
├────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────┐ │
│  │ ⚠️ Registration Temporarily Locked       │ │
│  │                                           │ │
│  │ Too many failed registration attempts.    │ │
│  │ Please try again in 3:42.                 │ │
│  └──────────────────────────────────────────┘ │
│                                                │
│  Full Name                                     │
│  👤 [John Doe__________________]               │
│                                                │
│  [ 🔒 Locked (3:42) ] ← DISABLED               │
└────────────────────────────────────────────────┘
```

## Color Scheme

### Warning Banner (Yellow)
```css
background: #FEF3C7  /* yellow-50 */
border: #FCD34D      /* yellow-200 */
text: #92400E        /* yellow-800 */
icon: #D97706        /* yellow-600 */
```

### Error Banner (Red)
```css
background: #FEE2E2  /* red-50 */
border: #FECACA      /* red-200 */
text: #991B1B        /* red-700 */
icon: #DC2626        /* red-600 */
```

### Locked Button
```css
background: #1E3A8A  /* blue-800 */
opacity: 50%
cursor: not-allowed
```

## Icons Used

- 🛡️ `Shield` - Security warning (yellow banner)
- ⚠️ `AlertTriangle` - Lockout alert (red banner)
- 🔒 `Lock` - Locked button
- 👁 `Eye` - Show password
- 🚫 `EyeOff` - Hide password
- 📧 `Mail` - Email input
- 👤 `User` - Name input
- ← `ArrowLeft` - Back navigation

## Responsive Behavior

### Desktop (> 768px)
```
┌──────────────────────────────────────────────────────┐
│                                                      │
│         ┌────────────────────────┐                  │
│         │   Login Form (400px)   │                  │
│         │                        │                  │
│         │  Full width alerts     │                  │
│         │  Standard inputs       │                  │
│         │  Large button          │                  │
│         └────────────────────────┘                  │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### Mobile (< 768px)
```
┌────────────────────┐
│                    │
│  Login Form (100%) │
│                    │
│  Full width alerts │
│  Touch-size inputs │
│  Touch-size button │
│                    │
└────────────────────┘
```

## User Flow Examples

### Scenario 1: Successful Login
```
1. User enters email & password
2. Clicks "Sign in"
3. ✅ Success → Redirects to dashboard
   Rate limit counter: 0 attempts (reset)
```

### Scenario 2: One Wrong Password
```
1. User enters wrong password
2. Clicks "Sign in"
3. ⚠️ Yellow banner appears:
   "🛡️ 2 attempts remaining before temporary lockout"
4. ❌ Red error message:
   "Invalid credentials. 2 attempts remaining..."
5. User tries again with correct password
6. ✅ Success → Redirects to dashboard
   Rate limit counter: 0 attempts (reset)
```

### Scenario 3: Locked Out
```
1. User enters wrong password 3 times
2. After 3rd attempt:
   ⚠️ Large red banner:
   "Account Temporarily Locked"
   "Too many failed login attempts. Please try again in 5:00"
3. Button shows: "🔒 Locked (5:00)"
4. Button is disabled (gray, not clickable)
5. Timer counts down: 4:59, 4:58, 4:57...
6. User waits (or closes browser - will reset)
7. At 0:00:
   - Banners disappear
   - Button re-enables: "Sign in"
   - User can try again
```

### Scenario 4: Input Sanitization (XSS Prevention)
```
1. User enters: <script>alert('hack')</script>
2. After typing, value becomes: scriptalert('hack')/script
3. HTML tags are stripped automatically
4. User sees clean text in input field
5. ✅ XSS attack prevented
```

## Browser DevTools View

### sessionStorage Contents (Locked State)
```json
{
  "login_attempts": {
    "attempts": 3,
    "isLocked": true,
    "lockoutEnd": 1703001234567,
    "remainingTime": 298
  }
}
```

### sessionStorage Contents (Normal State)
```json
{
  "login_attempts": {
    "attempts": 0,
    "isLocked": false,
    "lockoutEnd": null,
    "remainingTime": 0
  }
}
```

## Accessibility Features

- ✅ Clear error messages
- ✅ ARIA labels on all inputs
- ✅ Keyboard navigable
- ✅ Screen reader friendly
- ✅ High contrast colors
- ✅ Large touch targets (44x44px minimum)
- ✅ Focus indicators

## Animation & Transitions

- **Button Disable**: Smooth opacity transition (300ms)
- **Banner Appearance**: Slide down fade in (200ms)
- **Countdown Update**: No animation (instant update)
- **Input Focus**: Border color transition (150ms)

---

**Design System**: Tailwind CSS  
**Icons**: Lucide React  
**Color Palette**: Tailwind Default  
**Typography**: Default system fonts
