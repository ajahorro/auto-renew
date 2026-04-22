# Auto-Renew Status/Payment/Service/Audit Implementation TODO

## Progress Tracker ✅
- [ ] 1. Update Prisma Schema & Migrate
- [ ] 2. Backend Controllers (bookings/payment)
- [ ] 3. Backend Routes & Audit Integration
- [ ] 4. Frontend Badges & New ServiceStatusBadge
- [ ] 5. Frontend Pages (AdminBookings, MyBookings, StaffTasks, AdminBookingView)
- [ ] 6. UI Global Search/Replace Labels
- [ ] 7. Audit Viewer Components
- [ ] 8. Test Flows & Seed Data
- [ ] 9. Final Verification

**Current Step: 1/9**

## Detailed Steps

### 1. Prisma Schema & Migrate (DB)
- Update enums, add serviceStatus/auditLogs to Booking
- `npx prisma migrate dev --name status-overhaul`
- `npx prisma generate`

### 2. Backend Controllers
- bookings.controller.js: New statuses, service_status functions
- payment.controller.js: Verification → Partially Paid/Paid logic
- Add audit calls everywhere

### 3. Routes
- Add staff service endpoints

### 4-5. Frontend
- Badges for 3 statuses
- Separate displays/buttons per role

### 6. Global Fixes
- Labels: Request to Cancel / Cancel Booking / Start Service / Finish Service

### 7. Audit UI

### 8-9. Test & Complete
