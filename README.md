# CEA Task Board

A small full-stack app built for the CEA WebOps core application. Users sign up, log in, and manage their own tasks (create, read, update, delete).

- **Live link:** _add your Render URL here_
- **Author:** _Your Name, Roll No._

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | HTML, CSS, vanilla JS | No build step; served by the same Express app |
| Backend | Node.js + Express | Simple REST API |
| Database | MongoDB Atlas (Mongoose) | Free hosted tier, data survives redeploys |
| Auth | bcryptjs + JWT in an httpOnly cookie | Hashed passwords, session not readable by page JS |
| Hosting | Render (single web service) | Free tier, deploys from GitHub |

## Features

- Signup and login with **bcrypt-hashed passwords** (cost factor 12)
- Login session stored in an **httpOnly, SameSite=Lax** cookie (7 days, `Secure` in production)
- **CRUD on tasks**: title, description, status (todo / in-progress / done), due date
- Users only see and change **their own** tasks (every query filters by owner)
- **Validation** on client and server, with clear error messages
- Error handling: 400 validation, 401 not logged in, 404 not found, 409 duplicate email, 429 too many login attempts, 500 fallback
- Login/signup **rate limiting**; generic "Invalid email or password" message
- `GET /api/health` reports server and database status

## API

| Method | Route | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/signup` | no | Create account and log in |
| POST | `/api/auth/login` | no | Log in |
| POST | `/api/auth/logout` | no | Clear session cookie |
| GET | `/api/auth/me` | yes | Current user |
| POST | `/api/tasks` | yes | Create task |
| GET | `/api/tasks?status=todo` | yes | List tasks (optional filter) |
| GET | `/api/tasks/:id` | yes | Get one task |
| PUT | `/api/tasks/:id` | yes | Update task (send only changed fields) |
| DELETE | `/api/tasks/:id` | yes | Delete task |
| GET | `/api/health` | no | Health check |

## Run locally

Requirements: Node.js 18+ and a MongoDB connection string (a free MongoDB Atlas cluster works, or a local `mongodb://127.0.0.1:27017/taskboard`).

```bash
git clone <your-repo-url>
cd cea-task-board
npm install
cp .env.example .env        # then edit .env with your MONGO_URI and JWT_SECRET
npm start                   # or: npm run dev
```

Open http://localhost:3000.

## Environment variables

| Name | Description |
|---|---|
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Long random string used to sign login tokens |
| `NODE_ENV` | Set to `production` when deployed (turns on Secure cookies) |
| `PORT` | Set automatically by Render; defaults to 3000 locally |

## Deploy (Render + MongoDB Atlas)

1. Create a free MongoDB Atlas cluster, a database user, and allow network access from `0.0.0.0/0`.
2. Push this repo to GitHub.
3. On Render: New > Web Service > select the repo.
   - Build command: `npm install`
   - Start command: `npm start`
4. Add the environment variables above, then deploy.

## Project structure

```
server.js            Express app, DB connection, error handler
routes/auth.js       signup, login, logout, me
routes/tasks.js      task CRUD + validation
models/              Mongoose schemas (User, Task)
middleware/auth.js   verifies the login cookie
public/              frontend (index.html, style.css, app.js)
```

## Known limitations (kept simple on purpose)

- No email verification or password reset
- No pagination on the task list
- CSRF protection relies on SameSite cookies rather than tokens
