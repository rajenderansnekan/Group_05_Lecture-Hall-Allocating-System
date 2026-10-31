# Lecturer Hall Allocation System (LHAS) – Frontend

Professional frontend prototype for the **Lecturer Hall Allocation System** based on the Software Requirements Specification (SRS) Version 1.0.

## Features Implemented

- **Login & Role-Based Access Control** (Admin, Lecturer, Student)
- **Admin Dashboard** with summary stats
- **Lecture Hall Management** (Create, Update, Search, Deactivate)
- **Classes & Lecturers** view
- **Hall Suggestion & Allocation** with:
  - Capacity check
  - Equipment check
  - Hall status check
  - Time-overlap conflict detection
  - Ranking by excess capacity
  - Final confirmation validation
- **Timetable views** (Admin, Lecturer, Student)
- **Usage Reports** & Allocation History / Audit
- **Responsive design** (desktop, tablet, mobile)
- Demo data and toast notifications

## How to Run

1. Extract the ZIP file.
2. Open `index.html` in a modern browser (Chrome, Edge, Firefox, Safari).
3. Use the demo accounts:

| Role      | Email               | Password  |
|-----------|---------------------|-----------|
| Admin     | admin001@lhas.example  | 12345678 |
| Lecturer  | lecturer001@lhas.example | EZzRpPO2TYAY |
| Student   | student001@students.lhas.example |LlUetPbmH3Xd |

No backend or server is required – this is a pure frontend demonstration with data stored in memory (JavaScript).

## Project Structure

```
lhas-frontend/
├── index.html              # Login page
├── css/
│   └── styles.css          # Main stylesheet
├── js/
│   ├── auth.js             # Authentication logic
│   └── app.js              # Shared data, suggestion engine, helpers
├── pages/
│   ├── dashboard.html      # Admin dashboard
│   ├── halls.html          # Hall management
│   ├── classes.html        # Classes & lecturers
│   ├── allocation.html     # Hall suggestion & allocation (core)
│   ├── timetable.html      # Admin timetable
│   ├── reports.html        # Usage reports
│   ├── history.html        # Allocation history / audit
│   ├── users.html          # User management (demo)
│   ├── lecturer-timetable.html
│   └── student-timetable.html
└── README.md
```

## Technology

- HTML5, CSS3 (custom professional design)
- Vanilla JavaScript (no frameworks required)
- Font Awesome 6 icons
- Google Fonts (Inter)

## Notes

- This is a **frontend prototype** for demonstration and academic purposes.
- All allocation rules follow the business rules defined in the SRS (BR-01 to BR-10).
- Data is not persisted after page reload (demo only).
- For a production system, integrate with a real backend API and database.

---

**Institution:** Sabaragamuwa University of Sri Lanka · Faculty of Computing · Department of Software Engineering  
**Document:** Software Requirements Specification – Lecturer Hall Allocation System v1.0  
**Date:** 14 October 2026
