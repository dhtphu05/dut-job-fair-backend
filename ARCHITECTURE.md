# DUT Job Fair 2025 - System Architecture & Data Model

## System Overview

The DUT Job Fair platform is a comprehensive job fair management system connecting schools, students, and businesses through seamless interactions, QR-based check-ins, and intelligent matching algorithms.

## Core Entities & Relationships

```
┌─────────────────────────────────────────────────────────────────┐
│                     SYSTEM ARCHITECTURE                          │
└─────────────────────────────────────────────────────────────────┘

┌──────────────┐          ┌──────────────┐          ┌──────────────┐
│   SCHOOL     │          │   STUDENT    │          │  BUSINESS    │
├──────────────┤          ├──────────────┤          ├──────────────┤
│ id           │          │ id           │          │ id           │
│ name         │◄────────►│ mssv         │◄────────►│ name         │
│ contact      │          │ profile      │          │ industry     │
│ admin        │          │ preferences  │          │ contact      │
└──────────────┘          └──────────────┘          └──────────────┘
       │                         │                         │
       │                         │                         │
       ├─────────────────────────┼─────────────────────────┤
       │                         │                         │
       ▼                         ▼                         ▼
  ┌─────────────┐        ┌──────────────┐        ┌────────────────┐
  │  JOB FAIR   │        │ CHECK-IN     │        │     BOOTH      │
  │   EVENT     │        │              │        │                │
  └─────────────┘        └──────────────┘        ├────────────────┤
       │                  Student → Booth        │ id             │
       │                  Timestamp              │ businessId     │
       │                  Duration               │ location       │
       │                  Status                 │ positions      │
       │                                         │ staff          │
       ▼                                         └────────────────┘
  ┌─────────────┐
  │ SCHEDULE &  │
  │ ALLOCATION  │
  └─────────────┘
```

## 1. Core Data Models

### 1.1 School Entity
Represents educational institutions participating in the job fair.

```typescript
School {
  id: UUID
  name: string
  code: string
  address: string
  contact: {
    name: string
    email: string
    phone: string
  }
  studentCount: number
  registeredStudents: number
  createdAt: Date
}
```

**Business Logic:**
- Schools register students before the event
- Schools manage event details and sponsor communications
- Schools can view event analytics and reports
- Schools manage prizes and awards

### 1.2 Student Entity
Represents individual students participating in the job fair.

```typescript
StudentProfile {
  id: UUID
  mssv: string (unique student ID)
  fullName: string
  email: string
  phone: string
  dateOfBirth: Date
  gender: enum
  schoolId: FK → School
  major: string
  year: number (1-4)
  gpa: number (optional)
  skills: string[]
  resume: {
    url: string
    uploadedAt: Date
  }
  interests: string[] // Job fields of interest
  createdAt: Date
}
```

**Business Logic:**
- Students create profiles and express interests
- Students scan QR codes at booths (check-in)
- Students receive matching recommendations
- Students apply to positions directly
- Students track applications and communications

### 1.3 Business Entity
Represents companies participating in the job fair.

```typescript
BusinessProfile {
  id: UUID
  name: string
  industry: string
  website: string
  description: string
  contact: {
    name: string
    email: string
    phone: string
  }
  registeredBooths: number
  createdAt: Date
}
```

**Business Logic:**
- Businesses register and set up booths
- Businesses post job positions
- Businesses track visitor analytics
- Businesses manage applications
- Businesses export visitor lists for follow-up

### 1.4 Booth Entity
Represents physical/virtual booths operated by businesses.

```typescript
Booth {
  id: UUID
  businessId: FK → Business
  boothName: string
  location: string
  capacity: number
  positions: JobPosition[]
  staffs: BoothStaff[]
  scheduleStart: Date
  scheduleEnd: Date
  qrCode: string (unique identifier)
  createdAt: Date
}
```

**Business Logic:**
- Each booth has a unique QR code for check-ins
- Booth capacity can be tracked in real-time
- Booth staff can be assigned multiple shifts
- Booths post available positions

### 1.5 Job Position Entity
Represents job openings at booths.

```typescript
JobPosition {
  id: UUID
  boothId: FK → Booth
  title: string
  description: string
  requirements: string[]
  quantity: number
  level: enum (entry, junior, mid, senior)
  salary: {
    min: number
    max: number
    currency: string
  }
  createdAt: Date
}
```

## 2. Core Interactions

### 2.1 Student Check-In Flow

```
Student scans QR code at Booth
  ↓
System validates QR code
  ↓
System retrieves Student & Booth info
  ↓
Booth staff confirms student info
  ↓
CheckIn record created with:
  - studentId
  - boothId
  - timestamp
  - duration (calculated on check-out)
  ↓
Event logged for analytics
```

**Database Operations:**
```sql
INSERT INTO student_checkins (student_id, booth_id, check_in_time, status)
VALUES (?, ?, NOW(), 'active')

-- Later, when student leaves:
UPDATE student_checkins 
SET duration = EXTRACT(EPOCH FROM (NOW() - check_in_time)) / 60
WHERE id = ? AND status = 'active'
```

### 2.2 Student Application Flow

```
Student browses available positions
  ↓
Student selects position and applies
  ↓
Application record created with:
  - studentId
  - businessId
  - positionId
  - status: 'submitted'
  ↓
Business receives notification
  ↓
Business can:
  - Accept → Interview scheduled
  - Reject
  - Request more info
```

### 2.3 Matching Algorithm

```typescript
calculateMatchScore(student: Student, booth: Booth): number {
  let score = 0
  
  // Skill matching (40%)
  const skillOverlap = student.skills.filter(s => 
    booth.positions[0].requirements.includes(s)
  ).length / booth.positions[0].requirements.length
  score += skillOverlap * 40
  
  // Interest matching (30%)
  const interestMatch = student.interests.some(i => 
    booth.industry.includes(i)
  ) ? 30 : 0
  score += interestMatch
  
  // Experience level matching (20%)
  const levelMatch = student.year >= 3 ? 20 : 10
  score += levelMatch
  
  // GPA matching (10%)
  const gpaMatch = student.gpa >= 3.5 ? 10 : 5
  score += gpaMatch
  
  return Math.round(score)
}
```

## 3. User Roles & Permissions

### 3.1 Role Hierarchy

```typescript
enum UserRole {
  STUDENT,           // Can check-in, apply, message
  BOOTH_STAFF,       // Can scan QR, track visitors, message
  BUSINESS_ADMIN,    // Can manage booth, view analytics, export
  SCHOOL_ADMIN,      // Can view all events, manage prizes, generate reports
  SYSTEM_ADMIN,      // Full access
}
```

### 3.2 Permission Matrix

| Action | Student | Booth Staff | Business Admin | School Admin | System Admin |
|--------|---------|-------------|----------------|--------------|-------------|
| Scan QR Code | ✓ | ✓ | - | - | ✓ |
| View Profile | ✓ | - | - | - | ✓ |
| Apply Position | ✓ | - | - | - | ✓ |
| View Analytics | - | ✓ | ✓ | ✓ | ✓ |
| Export Data | - | - | ✓ | ✓ | ✓ |
| Manage Booth | - | - | ✓ | - | ✓ |
| Manage Event | - | - | - | ✓ | ✓ |
| Manage Prizes | - | - | - | ✓ | ✓ |
| System Settings | - | - | - | - | ✓ |

## 4. Data Flow Diagrams

### 4.1 Check-In System

```
Mobile (Scanner App)
  ├─ QR Code Reader
  ├─ Camera Permission Handler
  └─ Offline Mode Support
       │
       ▼
   HTTP Request
   POST /api/scans
   {
     "studentId": "uuid",
     "boothId": "uuid",
     "timestamp": "ISO-8601"
   }
       │
       ▼
   Backend API
   ├─ Validate student & booth
   ├─ Check duplicate recent scan
   ├─ Record check-in
   └─ Update booth analytics
       │
       ▼
   Database
   ├─ student_checkins (insert)
   ├─ booth_statistics (update)
   └─ interaction_logs (insert)
       │
       ▼
   Response to Mobile
   {
     "success": true,
     "student": {...},
     "booth": {...},
     "duration": null
   }
```

### 4.2 Report Generation

```
Admin Dashboard
  └─ Click "Export Report"
       │
       ▼
   Report Generator
   ├─ Generate student check-in report
   ├─ Generate booth performance report
   ├─ Calculate summary statistics
   └─ Generate hourly/major distribution
       │
       ▼
   Export Formatter
   ├─ CSV format
   ├─ XLSX format
   └─ PDF format
       │
       ▼
   Browser Download
   └─ student-checkins-2025-03-03.csv
```

## 5. Database Schema

### 5.1 Key Tables

```sql
-- Core entities
CREATE TABLE schools (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) UNIQUE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE students (
  id UUID PRIMARY KEY,
  mssv VARCHAR(50) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE,
  school_id UUID REFERENCES schools(id),
  major VARCHAR(100),
  year INT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE businesses (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  industry VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE booths (
  id UUID PRIMARY KEY,
  business_id UUID REFERENCES businesses(id),
  booth_name VARCHAR(255),
  location VARCHAR(255),
  qr_code VARCHAR(255) UNIQUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Interactions
CREATE TABLE student_checkins (
  id UUID PRIMARY KEY,
  student_id UUID REFERENCES students(id),
  booth_id UUID REFERENCES booths(id),
  check_in_time TIMESTAMP DEFAULT NOW(),
  duration INT, -- Minutes
  status ENUM('active', 'completed'),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(student_id, booth_id, DATE(check_in_time))
);

CREATE TABLE student_applications (
  id UUID PRIMARY KEY,
  student_id UUID REFERENCES students(id),
  booth_id UUID REFERENCES booths(id),
  position_id UUID,
  status ENUM('submitted', 'reviewed', 'interview', 'rejected', 'offered'),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Analytics
CREATE TABLE interaction_logs (
  id UUID PRIMARY KEY,
  student_id UUID REFERENCES students(id),
  booth_id UUID REFERENCES booths(id),
  interaction_type ENUM('check_in', 'message', 'application', 'interview'),
  timestamp TIMESTAMP DEFAULT NOW()
);

-- Reports
CREATE TABLE generated_reports (
  id UUID PRIMARY KEY,
  report_type VARCHAR(100),
  generated_by UUID,
  data JSON,
  format ENUM('csv', 'xlsx', 'pdf'),
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP
);
```

### 5.2 Indexes for Performance

```sql
CREATE INDEX idx_students_school ON students(school_id);
CREATE INDEX idx_checkins_student ON student_checkins(student_id);
CREATE INDEX idx_checkins_booth ON student_checkins(booth_id);
CREATE INDEX idx_checkins_timestamp ON student_checkins(check_in_time);
CREATE INDEX idx_applications_student ON student_applications(student_id);
CREATE INDEX idx_logs_booth ON interaction_logs(booth_id);
CREATE INDEX idx_logs_timestamp ON interaction_logs(timestamp);
```

## 6. API Endpoints

### 6.1 Check-In API

```
POST /api/scans
Request: {
  "studentId": "uuid",
  "boothId": "uuid"
}
Response: {
  "success": boolean,
  "checkInId": "uuid",
  "student": {...},
  "booth": {...}
}

GET /api/checkins/:studentId
Response: CheckinRecord[]

GET /api/checkins/booth/:boothId
Response: {
  "total": number,
  "unique": number,
  "checkins": CheckinRecord[]
}
```

### 6.2 Reporting API

```
GET /api/reports/checkins?eventId=uuid&format=csv
Response: CSV file download

GET /api/reports/booth/:boothId?format=xlsx
Response: Excel file download

GET /api/reports/summary?eventId=uuid
Response: {
  "totalStudents": number,
  "totalCheckins": number,
  "majorDistribution": {...},
  "hourlyDistribution": {...}
}

POST /api/reports/generate
Request: {
  "type": "checkin|booth|summary",
  "eventId": "uuid",
  "format": "csv|xlsx|pdf"
}
Response: {
  "reportId": "uuid",
  "downloadUrl": "string",
  "expiresAt": "ISO-8601"
}
```

## 7. Real-World Data Considerations

### 7.1 Data Validation

- Student MSSV must be unique and match university records
- Email addresses must be valid and verified
- Phone numbers must follow international format
- Salary ranges must be positive numbers
- GPA must be between 0 and 4.0

### 7.2 Privacy & Security

- Personally identifiable information encrypted at rest
- API endpoints require authentication
- Role-based access control enforced
- Audit logs for all data modifications
- Data retention policies (reports deleted after 90 days)

### 7.3 Data Integrity

- Check-in timestamps must be sequential
- No duplicate check-ins within 5 minutes
- Student must be registered before check-in
- Booth must be active and scheduled

## 8. Analytics & Reporting

### 8.1 Key Metrics

- **Student Metrics**: Total checked-in, unique visitors, repeat visits, major distribution
- **Booth Metrics**: Visitor count, interaction duration, application rate, staff performance
- **Event Metrics**: Peak hours, most visited booths, engagement rate, conversion rate

### 8.2 Report Types

1. **Student Check-in Report**: List of all students with times, durations, booths
2. **Booth Performance Report**: Visitor counts, engagement metrics per booth
3. **Summary Report**: Event-wide statistics and key performance indicators
4. **Major Distribution**: Student breakdown by academic major
5. **Hourly Distribution**: Time-based analytics for capacity planning

## 9. Scalability Considerations

- Database sharding by school_id for large student populations
- Caching layer (Redis) for frequently accessed data
- Async job queue for report generation
- CDN for file downloads
- Real-time WebSocket for live analytics updates

## 10. Future Enhancements

- AI-powered student-business matching algorithm
- Video interview scheduling integration
- Virtual booth support
- Multi-language support
- Mobile app (React Native)
- Real-time notifications
- Post-event feedback surveys
- Resume parsing and skill extraction
