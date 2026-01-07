# Installment Default Notifications Implementation

## Overview
Implemented automatic detection and notification of overdue/missed installment payments. When data is loaded (admin view only), the system checks for any installments past their due date without a receipt number and creates system notifications.

## How It Works

### 1. Detection Logic (`utils/notificationHelpers.ts`)
- **Function**: `detectOverdueInstallments()`
- Filters installments where:
  - Due date is in the past
  - Receipt number is empty (not paid)
  - Links them with loan and customer data
- Calculates days overdue for severity determination

### 2. Notification Creation (`utils/notificationHelpers.ts`)
- **Function**: `checkAndNotifyOverdueInstallments()`
- Runs during data load (admin-only, not for scoped customers)
- Checks if a notification for the same installment exists in the last 24 hours
- Only creates notification if it's the first detection or older than 24 hours
- Prevents duplicate notifications

### 3. Severity Levels
Notifications are created with different status levels based on days overdue:

| Days Overdue | Status | Icon | Color |
|-------------|--------|------|-------|
| 1-7 days | `pending` | 📋 | Blue |
| 8-30 days | `warning` | ⚠️ | Amber |
| 30+ days | `error` | ❌ | Red |

### 4. Notification Message Format
```
⚠️ {Customer Name} - Installment #{Number} ({Amount}) is {Days} days overdue
```

Example:
```
⚠️ URGENT: John Doe - Installment #5 (5000) is 45 days overdue
```

## Integration Points

### DataContext (`context/DataContext.tsx`)
- Import: `checkAndNotifyOverdueInstallments` from `notificationHelpers`
- Runs after all data is fetched in the admin view
- Only executes for admin users (not scoped customers)
- Non-blocking: failures don't interrupt data loading

### ProfileHeader (`components/ProfileHeader.tsx`)
- Updated status styling to support `warning` status (amber color)
- Updated icon display to show ⚠️ for warning notifications
- Notifications appear in the system notifications modal with:
  - Color-coded background based on status
  - Swipe-to-delete functionality
  - Timestamp of when notification was created
  - Delete button (admin only)

## Database
- Stored in `system_notifications` table
- Status field supports: `pending`, `success`, `warning`, `error`
- Metadata includes:
  - `customerId`: Customer experiencing default
  - `loanId`: Associated loan
  - `installmentId`: Specific installment
  - `installmentNumber`: Position in sequence
  - `amount`: Installment amount
  - `daysOverdue`: Number of days past due
  - `dueDate`: Original due date

## User Experience

### Admin View
1. On app load or data refresh, system automatically detects overdue installments
2. Notifications appear in the system notifications modal
3. Admin can:
   - Click the delete button to dismiss
   - Swipe left/right to delete (mobile)
   - See timestamp of when issue was detected
   - View customer name and installment details

### Scoped Customer View
- Installment default notifications are NOT shown to scoped customers
- Only admins see these alerts

## Benefits
- **Proactive Management**: Admins are immediately notified of payment issues
- **No Spam**: 24-hour deduplication prevents duplicate notifications
- **Severity Indication**: Color-coded warnings help prioritize urgent issues
- **Audit Trail**: Notifications are stored with full metadata for tracking
- **Easy Dismissal**: Swipe or click to clear notifications

## Future Enhancements
- Email/SMS notifications for critical defaults (30+ days)
- Automatic follow-up scheduling
- Payment history tracking per installment
- Custom escalation rules
- Reports on default trends
