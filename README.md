# Quiz Platform

This workspace contains a React/Vite frontend and an Express backend for a role-based quiz platform.

## Project structure

- `frontend/` - React app with student, teacher, and admin dashboards
- `backend/` - Express API server with authentication, quiz management, and user management
- `backend/users.json` / `backend/quizzes.json` - legacy seed files kept in the repo for reference

## MongoDB setup

The backend now uses MongoDB instead of JSON files for live data storage.

1. Make sure MongoDB is running locally or use a hosted MongoDB URI.
2. Set these environment variables before starting the backend:
   - `MONGODB_URI`
   - `MONGODB_DB`

Example values:

```powershell
$env:MONGODB_URI="mongodb://127.0.0.1:27017"
$env:MONGODB_DB="quiz_platform"
```

If you do not set them, the backend defaults to:

- `MONGODB_URI=mongodb://127.0.0.1:27017`
- `MONGODB_DB=quiz_platform`

On first run, the backend seeds default users and quizzes into MongoDB if the collections are empty.

## Run locally

1. Start the backend API:
   - Open a terminal in `backend`
   - Run `npm install`
   - Make sure MongoDB is available
   - Run `npm start`

2. Start the frontend app:
   - Open a terminal in `frontend`
   - Run `npm install`
   - Run `npm run dev`

3. Open the frontend in your browser:
   - Navigate to `http://localhost:3000`

## Features

- Student dashboard: fetches quizzes from the backend API, presents quiz cards, navigates questions, and shows scores
- Teacher dashboard: creates quizzes through the backend API
- Admin dashboard: manages users, deletes quizzes, and resets quiz data
- Role-based authentication: student, teacher, and admin access control
- MongoDB persistence for quizzes and users

## Starter accounts

- Student: `student1` / `student123`
- Teacher: `teacher1` / `teacher123`
- Admin: `admin1` / `admin123`

## Backend API

- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET /api/users`
- `POST /api/users`
- `DELETE /api/users/:id`
- `GET /api/quizzes`
- `GET /api/quizzes/:id`
- `POST /api/quizzes`
- `DELETE /api/quizzes/:id`
- `POST /api/reset`
