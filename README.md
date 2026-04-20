# Quiz Platform

This workspace now contains a dynamic React/Vite frontend and an Express backend for the quiz application.

## Project structure

- `frontend/` — React app with student, teacher, and admin panels
- `backend/` — Express API server with quiz CRUD and reset endpoints
- `backend/quizzes.json` — stored quiz data for persistence

## Run locally

1. Start the backend API:
   - Open a terminal in `backend`
   - Run `npm install`
   - Run `npm start`

2. Start the frontend app:
   - Open a terminal in `frontend`
   - Run `npm install`
   - Run `npm run dev`

3. Open the frontend in your browser:
   - Navigate to `http://localhost:3000`

## Features

- Student panel: fetches quizzes from the backend API, presents quiz cards, navigates questions, and shows scores
- Teacher panel: creates quizzes dynamically via the backend API
- Admin panel: deletes quizzes and resets backend data to defaults
- Backend API endpoints:
  - `GET /api/quizzes`
  - `GET /api/quizzes/:id`
  - `POST /api/quizzes`
  - `DELETE /api/quizzes/:id`
  - `POST /api/reset`
