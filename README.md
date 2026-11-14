# MediCare: Medical Store Order & Delivery Management System

A MERN application for a real medical store, with three role-based panels (Customer, Admin, Rider) sharing one backend and one MongoDB database.

The store has no online catalogue or stock system. Customers send photos or written requests, the admin checks the shelves in person, then types the available medicines and prices into that order's bill.

## Current status: Phase 2 (accounts and design system)

| Works now | Comes in later phases |
| --- | --- |
| One login page for all roles, with Remember me and Forgot password | Medicine requests and saved address editing (Phase 3) |
| Customer registration, and admin-only rider accounts | Order review, billing and invoices (Phase 4) |
| Role-based dashboards with live database figures | Google Maps and delivery pricing (Phase 5) |
| Rider management: add, edit, deactivate, reset password | Rider deliveries and tracking (Phase 6) |
| Notifications list and profile pages | UPI, cash and live updates (Phase 7) |
| Sage & Beige design system and all database models | Reports and going online (Phase 8) |

Menu items for later phases are shown as disabled and tagged with their phase.

## Run the app

Use this every time. You do not need the setup steps below again on this PC.

Open two PowerShell windows, one for each server, and keep both open.

**Window 1, backend** (runs at http://localhost:5000/api):

```powershell
cd D:\PROJECTS\invoice-generator-master\medical-management-system\backend
npm run dev
```

**Window 2, frontend** (runs at http://localhost:5173):

```powershell
cd D:\PROJECTS\invoice-generator-master\medical-management-system\frontend
npm run dev
```

Then open **http://localhost:5173** and log in. To check that every part is connected, open **http://localhost:5173/status**. To stop a server, press `Ctrl + C` in its window.

## Setting up on a new computer

**If the app already runs on this PC, skip this section.**

You need [Node.js](https://nodejs.org) version 22 or newer and a free [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register) account. From the `medical-management-system` folder:

```powershell
cd backend
npm install
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Open `backend/.env` and paste the long value that was printed as `JWT_SECRET`. Then set up the frontend:

```powershell
cd ..\frontend
npm install
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

The `if` part protects your settings. Never run `Copy-Item .env.example .env` on its own, because it replaces your real `.env` with the blank template and removes your database password.

### Connect MongoDB Atlas

1. Create a **free** cluster in Atlas, in the region closest to your store.
2. Open **Database Access** and add a database user with the role **Read and write to any database**.
3. Open https://checkip.amazonaws.com to see the address this computer uses. In Atlas, open **Network Access**, click **Add IP Address**, type that exact address and click **Confirm**. Avoid the **Add Current IP Address** button, because it can add a different address.
4. On your cluster, choose **Connect**, then **Drivers**, and copy the connection string.
5. In `backend/.env`, set `MONGODB_URI` to that string, with `medicare` added right after `.mongodb.net/`:

   ```text
   MONGODB_URI=mongodb+srv://USERNAME:PASSWORD@cluster0.xxxxx.mongodb.net/medicare?retryWrites=true&w=majority
   ```

6. From the `backend` folder, save your password without showing it on screen, and test the connection:

   ```powershell
   npm run db:set-password
   ```

   This should end with `Your database is ready.` If it fails, it explains what to fix.

### Create the admin account

There is no public admin sign-up. Run this once from the `backend` folder and answer the questions. Your password is hidden as you type.

```powershell
npm run seed:admin
```

Lost the admin password? Run `npm run seed:admin -- --reset-password`.

## Accounts

| Role | How the account is created | After login |
| --- | --- | --- |
| Customer | Signs up at `/register` | `/customer` |
| Admin | `npm run seed:admin` only | `/admin` |
| Rider | Admin adds them under Rider Management, and a temporary password is shown once | Must choose their own password, then `/rider` |

The role always comes from the database. Nothing sent by the browser can choose or change it.

## Password reset emails

Forgot password sends a reset link that works once and expires in 1 hour. During development, with `SMTP_HOST` left blank in `backend/.env`, the email is printed in the backend window instead of being sent. To send real emails, fill in the `SMTP_` settings shown in `backend/.env.example`.

## Run the checks

| Check | Folder | Command |
| --- | --- | --- |
| Backend tests (use a separate `medicare_test` database) | `backend` | `npm test` |
| Database connection | `backend` | `npm run db:check` |
| Frontend code quality | `frontend` | `npm run lint` |
| Frontend type check and production build | `frontend` | `npm run build` |

## Folder structure

```text
medical-management-system/
├── backend/
│   ├── scripts/
│   │   ├── check-database.js         Tests the database and explains any problem
│   │   ├── set-database-password.js  Saves your Atlas password without showing it
│   │   └── seed-admin.js             Creates or recovers the admin account
│   ├── tests/                        Automated tests for models, login and permissions
│   └── src/
│       ├── server.js                 Starts the server and connects the database
│       ├── app.js                    Security, CORS, cookies, routes, errors
│       ├── config/                   Settings check, database connection, status lists
│       ├── models/                   The database collections
│       ├── validators/               Rules for all incoming data
│       ├── middleware/               Login and role checks, rate limits, error handling
│       ├── services/                 Login, rider, dashboard, audit and email logic
│       ├── controllers/              Handles each request
│       └── routes/                   The API addresses
│
└── frontend/src/
    ├── index.css                     MediCare design tokens
    ├── context/                      Who is logged in, and toast messages
    ├── hooks/                        Reusable logic for loading data and notifications
    ├── services/                     Every call to the backend
    ├── routes/                       Pages, menus and role protection
    ├── layouts/                      Login layout and panel layout
    ├── components/
    │   ├── ui/                       Buttons, cards, tables, forms, dialogs and more
    │   ├── layout/                   Sidebar, top bar and rider bottom menu
    │   └── common/                   Logo and notifications
    └── pages/
        ├── auth/                     Login, sign-up and password screens
        ├── customer/                 Customer dashboard
        ├── admin/                    Admin dashboard and rider management
        ├── rider/                    Rider dashboard
        ├── account/                  Profile and notifications, for all roles
        └── system/                   Status, not found and access denied
```

## Design system

Colours live in `frontend/src/index.css`. Tailwind's default colours are switched off, so only these can be used.

| Token | Value | Token | Value |
| --- | --- | --- | --- |
| `primary` | `#64816A` | `text` | `#26352B` |
| `primary-dark` | `#354D40` | `text-muted` | `#718075` |
| `primary-light` | `#A5B99A` | `success` | `#32845B` |
| `background` | `#F5F4EC` | `warning` | `#B77932` |
| `surface` | `#FFFFFF` | `danger` | `#B94D4D` |
| `surface-muted` | `#E8EEE3` | `info` | `#557A8A` |
| `border` | `#E3E7DD` | | |

Headings use Manrope and everything else uses Inter.

Small text needs a contrast of at least 4.5:1 to stay readable. White on `primary` is 4.29:1, and `text-muted` is 4.16:1 on white and 3.77:1 on `background`. So buttons use `primary-dark` (9.18:1), small secondary text uses the `text-secondary` role (set to `primary-dark`), and `primary` and `text-muted` are kept for icons, highlights, borders and placeholders.

## API

Every endpoint answers in one of two shapes:

```json
{ "success": true, "message": "...", "data": {}, "meta": {} }
```

```json
{ "success": false, "error": { "code": "NOT_FOUND", "message": "...", "details": {} } }
```

| Route | Who | Purpose |
| --- | --- | --- |
| `GET /api/health` | Anyone | Whether the API and database are working |
| `GET /api/auth/session` | Anyone | Who is logged in |
| `POST /api/auth/register` | Anyone | Create a customer account |
| `POST /api/auth/login`, `/logout` | Anyone, logged in | Log in and out |
| `POST /api/auth/change-password` | Logged in | Change your password |
| `POST /api/auth/forgot-password`, `/reset-password` | Anyone | Reset a forgotten password |
| `GET /api/admin/summary` | Admin | Dashboard figures |
| `GET, POST /api/riders` | Admin | List and create riders |
| `GET, PATCH /api/riders/:id` | Admin | View and edit a rider |
| `PATCH /api/riders/:id/status` | Admin | Activate or deactivate a rider |
| `POST /api/riders/:id/reset-credentials` | Admin | Create a new temporary password |
| `GET /api/riders/me/summary` | Rider | Their own figures |
| `GET /api/customers/me/summary` | Customer | Their own figures |
| `GET /api/notifications` | Logged in | Their own notifications |
| `PATCH /api/notifications/:id/read`, `/read-all` | Logged in | Mark notifications as read |

## If something goes wrong

| What you see | What it means | How to fix it |
| --- | --- | --- |
| `npm.ps1 cannot be loaded because running scripts is disabled` | PowerShell is blocking the npm script | Use `npm.cmd` in place of `npm`, for example `npm.cmd run dev` |
| `Port 5000 is already in use` or `Port 5173 is already in use` | The server is already running somewhere | Close the other window, or press `Ctrl + C` in it |
| `The backend cannot start because backend/.env has a problem` | A setting is missing or wrong | Fix the setting named in the message |
| `JWT_SECRET: must be a random value` and `MONGODB_URI` is back to `127.0.0.1` | `.env` was replaced by the blank template | Set `MONGODB_URI` and `JWT_SECRET` again, then run `npm run db:set-password` in the `backend` folder |
| `must include the database name` | The Atlas address has no `/medicare` | Add `medicare` after `.mongodb.net/`, before the `?` |
| `bad auth` | Wrong database username or password | Use the Database Access user, not your Atlas login, and run `npm run db:set-password` |
| `Server selection timed out`, `isn't whitelisted` or `Could not connect to any servers` | Atlas is not allowing this computer's IP address | Open https://checkip.amazonaws.com to see your address. In **Network Access**, click **Add IP Address** and type that exact address. Wait until it shows **Active**, then give it a minute or two. It can change, especially on mobile data or a hotspot |
| `querySrv ENOTFOUND` or `querySrv ECONNREFUSED` | The cluster address could not be looked up | Check the address for typos. If it is correct, try another network or set your DNS to 8.8.8.8 |
| Website says **We cannot reach the server** | The website cannot talk to the backend | Start the backend. Open the site at `http://localhost:5173`, not `127.0.0.1` |
| Website says **We cannot reach the database** | The backend cannot reach Atlas | Run `npm run db:check` in the `backend` folder and follow what it says |
| You changed `.env` but nothing happened | Settings are only read at startup | Stop the server with `Ctrl + C` and start it again |

## Going online

The app runs online as three separate parts. Full step-by-step instructions come in Phase 8.

| Part | Service type | Notes |
| --- | --- | --- |
| Database | MongoDB Atlas | Already online |
| Backend | A Node.js host that supports WebSockets, such as Render or Railway | WebSockets are needed for live updates through Socket.IO |
| Frontend | A static site host, such as Vercel or Netlify | Set `VITE_API_URL` to the online backend address before building |

Before going live, the backend host needs `NODE_ENV=production`, its own `JWT_SECRET`, `CLIENT_URL` set to the online website address, SMTP settings for real emails, and Express `trust proxy` set to match the host. A custom domain with the website and API under it, such as `www.` and `api.`, is recommended so that login cookies work reliably in all browsers.

## Project rules

- No medicine catalogue, categories, inventory or stock management. Medicine line items belong only to an individual order or invoice.
- All permission checks happen on the backend. Hiding a button is never the only protection.
- Data is saved to MongoDB before any live update is sent.
- Payment status and delivery status are always tracked separately.
- A UPI payment is marked as paid only after the payment gateway verifies it.
