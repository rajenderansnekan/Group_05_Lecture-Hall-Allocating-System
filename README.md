[README.md](https://github.com/user-attachments/files/34240778/README.md)
# Lecturer Hall Allocation System (LHAS) v2

Express + MySQL backend that also serves the frontend. Group 05, Web Systems and Technologies.

This version combines the team project (frontend + backend + database) with the extra features from the
localStorage prototype: lecturer hall booking, stronger password rules, login lockout and per-user notifications.
Everything now runs through the backend.

## Run it

1. Open a terminal in `BackEnd`.
2. Copy `.env.example` to `.env` and fill in your database details (use your existing values) and a `JWT_SECRET`.
3. `npm install`
4. `npm start` (or `npm run dev`)
5. Open http://localhost:3000

The server creates any missing tables and adds the new `booking_requests` table and `notifications.user_email` column
by itself. It never deletes existing data.

Do not commit `.env` to GitHub (the included `.gitignore` already skips it).

## What each version contributed

| Area | Team project (backend) | Prototype (localStorage) | In this version |
|---|---|---|---|
| Data | MySQL | Browser only | MySQL |
| Halls, classes, users, reports, history | Full | Partial | Kept from the team project |
| Hall suggestions | Server | Browser | Server (one shared rule module) |
| Login | Browser compared the password | Browser | Server checks it, bcrypt hashes, signed token |
| Lockout after 5 failures | No | Yes | Yes (server, 15 minutes) |
| Change password | Length 8 only | Full rules | Full rules on the server |
| Lecturer hall request | Pending allocation, any class, no reasons | Booking page | Booking page backed by `booking_requests` |
| Admin review | Confirm or cancel | Approve or reject with reason | Approve or reject with reason, rules re-checked |
| Notifications | One shared list | Per user | Per user |

## New and changed behaviour

* Lecturer: **Book a Hall** page. Only their own classes, hall list for the slot, "Any suitable hall" option,
  edit or cancel a request (cancelling an approved one needs a reason), 24 hour / 30 day booking window.
* Admin: **Booking Requests** page. Approve (all rules are checked again, then an allocation is created) or reject
  (reason required). Dashboard shows available halls and pending requests.
* Every create or confirm of an allocation is checked on the server for capacity, equipment, hall status, hall clash
  and lecturer/class clash. Before this, allocation always saved hall 1 and the first lecturer found; that is fixed.
* Lecturers can no longer see all allocations or request any subject.
* Passwords: stored as bcrypt hashes. Existing plain-text passwords are converted the first time that user signs in.
  The login response never contains a password. New passwords need 8+ characters with upper case, lower case and a digit.
* Pages and API calls need a signed-in token. Admin routes need the admin role.

## API summary

| Route | Who | Purpose |
|---|---|---|
| `POST /api/login` | public | Sign in, returns token and profile |
| `POST /api/auth/change-password` | any user | Change own password |
| `GET /api/timetable`, `GET /api/notifications`, `POST /api/readnotifications` | any user | Own timetable and notifications |
| `GET /api/bookings/my-subjects`, `POST /api/bookings/suggest` | lecturer | Own classes, halls for a slot |
| `GET/POST /api/bookings`, `PUT /api/bookings/:id`, `POST /api/bookings/:id/cancel` | lecturer | Own booking requests |
| `GET /api/admin/bookings`, `POST /api/admin/bookings/:id/approve`, `.../reject` | admin | Review requests |
| `/api/admin/*` (halls, subjects, users, allocations, reports, history, stats) | admin | As before |

## Tests

`npm test` runs an end-to-end check of the API (66 checks). It empties the tables, so it refuses to run unless
`DB_NAME` contains "test". Use a separate empty database:

```
DB_HOST=127.0.0.1 DB_USER=... DB_PASSWORD=... DB_NAME=lhas_test DB_SSL=false npm test
```

## Important notes

* **Rotate your database password.** The old `app.js` contained the Aiven password in plain text. If that file was
  ever pushed to GitHub, change the password in the Aiven console and keep the new one only in `.env`.
* The `ca.pem` file is a public certificate and is safe to keep.
* The demo buttons on the login page contain demo passwords. Remove them before a real deployment.
* The default password for users created by an administrator is `LHAS@1234`. Ask them to change it at first login.
* The login lockout counter is kept in memory, so it resets when the server restarts.
* Not done yet: forgetting-password reset by email, server-side session revocation after a password change, and a
  `must change password` flag for new users.
