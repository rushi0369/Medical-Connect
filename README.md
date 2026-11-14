<div align="center">

# 🏥 CK Medical | Medical Store Order & Delivery Management System

**A modern, full-stack pharmacy order management and home delivery platform tailored for local chemists and medical shops.**

[![Live Demo](https://img.shields.io/badge/Live_Demo-Active_24%2F7-brightgreen?style=for-the-badge&logo=render)](https://medical-connect-pp2v.onrender.com)
[![React](https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js_22+-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express 5](https://img.shields.io/badge/Express_5-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![MongoDB Atlas](https://img.shields.io/badge/MongoDB_Atlas-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/atlas)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS_v4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

[**Live Demo**](https://medical-connect-pp2v.onrender.com) • [**Explore Features**](#-key-features) • [**Demo Credentials**](#-demo-login-credentials) • [**Quickstart**](#-local-development-setup) • [**Architecture**](#-system-architecture)

</div>

---

## 🌟 Overview

**CK Medical** bridges local neighborhood medical stores with home delivery. Unlike traditional e-commerce catalogs with rigid inventory databases, local chemists stock thousands of uncataloged medicines that change daily. 

With **CK Medical**:
1. **Customers** take a quick photo of their doctor's handwritten prescription or type medicine names and submit a request from home.
2. **Chemists & Pharmacists** review shelf availability, substitute missing items with suitable alternatives, draft professional GST invoices, and dispatch orders to riders.
3. **Delivery Riders** navigate real-time road routes via Google Maps, collect payments (Store UPI QR or Cash), and settle funds directly with the pharmacy.

---

## 🚀 Live Demo

* **Live URL**: **[https://medical-connect-pp2v.onrender.com](https://medical-connect-pp2v.onrender.com)**
* **Hosting**: Render (Cloud Web Service) + cron-job.org (24/7 Keep-Alive)
* **Database**: MongoDB Atlas Cloud Replica Set
* **SSL/TLS**: Automated Let's Encrypt HTTPS

---

## 🔑 Demo Login Credentials

Try all three role-based portals on the live website:

| Role | Portal Link | Mobile Number | Password | Key Responsibilities |
| :--- | :--- | :--- | :--- | :--- |
| 🏥 **Admin (Pharmacist)** | [/login](https://medical-connect-pp2v.onrender.com/login) | `9876543210` | `Admin@123` | Review prescriptions, generate PDF bills, assign riders, settle payments, send refill reminders |
| 🛒 **Customer** | [/login](https://medical-connect-pp2v.onrender.com/login) | `9876543211` | `Customer@123` | Upload prescriptions, approve invoices, track live delivery status, 1-click refill orders |
| 🛵 **Delivery Rider** | [/login](https://medical-connect-pp2v.onrender.com/login) | `9876543212` | `Rider@123` | View assigned orders, Google Maps navigation, doorstep cash & UPI QR collections |

*(Alternative test accounts: Customer `9023134390`, Rider Kishan `8401331317` / `Rider@123`)*

---

## ✨ Key Features

### 🛒 Customer Portal
- 📸 **Prescription Photo Upload**: Drag & drop doctor prescription images with secure cloud GridFS storage.
- 📝 **Custom Medicine Notes**: Request specific brands, dosages, or general health items in Gujarati or English.
- 🧾 **Digital Invoice Approval**: Review itemized pricing and doctor-suggested alternatives before confirming.
- 🔁 **1-Click Monthly Refill**: Easily reorder recurring medications with a single click from order history.
- 📍 **Saved Addresses**: Manage multiple delivery addresses (Home, Office, Parents) with GPS pins.
- 🔒 **Self-Service Password Recovery**: Instant 6-digit OTP verification code via WhatsApp or on-screen recovery badge.

### 🏥 Admin & Pharmacy Management Panel
- 🔍 **Prescription Review Station**: Side-by-side prescription viewer with item availability toggles and alternative medicine notes.
- 📄 **GST Invoice Generation**: Automated PDF generation with pharmacy GSTIN, FSSAI, itemized CGST/SGST, and batch numbers.
- 💬 **WhatsApp Bill Sharing**: 1-click formatted WhatsApp bills sent directly to the customer's phone (`wa.me`).
- 🛵 **Rider Dispatch & Route Calculation**: Road distance estimation from the physical store to calculate delivery tiers.
- 💵 **Payment Reconciliation**: Doorstep Cash On Delivery (COD) and direct Store UPI QR tracking with rider cash handover settlements.
- 🔔 **Bilingual Refill Reminders**: Culturally crafted monthly refill messages in Gujarati and English with sacred blessings.
- ⚙️ **Store Profile & Location Setup**: Custom Store UPI QR image uploader and GPS store coordinate editor.
- 🗑️ **Universal Bulk Actions**: Select-All checkboxes and bulk deletion across Invoices, Orders, Payments, Customers, and Riders.

### 🛵 Delivery Rider Mobile App
- 📦 **Order Queue**: Clean mobile-first interface optimized for drivers on two-wheelers.
- 🗺️ **Turn-by-Turn Navigation**: One-tap deep link to Google Maps with optimized road routing.
- 📲 **Doorstep UPI QR & Cash Collection**: Prompt customers to scan the store's static UPI QR code or collect exact cash.
- 🤝 **Rider Cash Settlement**: Track cash held in wallet until physical handover to the store cashier.

---

## 📍 Physical Store Location

The system is configured around the real-world location of **CK Medical**:

* **Store Name**: CK Medical
* **Address**: Mandvi Road, Near Mandvi Bus Depot, Char Rasta, Kim, Gujarat 394110
* **Area / City**: Char Rasta, Kim, Gujarat
* **GPS Coordinates**: `21.4035° N, 72.9274° E`
* **Delivery Engine**: Road distance calculations use this store location as the starting origin for delivery tiers.

---

## 🛠️ Tech Stack & Architecture

```
┌────────────────────────────────────────────────────────┐
│                   Vite + React 19 SPA                  │
│       Tailwind CSS v4 • Lucide Icons • React Router    │
└───────────────────────────┬────────────────────────────┘
                            │ REST API + JSON
                            ▼
┌────────────────────────────────────────────────────────┐
│                  Node.js + Express 5.3                 │
│   JWT Auth • Multer • PDFKit • GridFS • Zod Validation │
└───────────────────────────┬────────────────────────────┘
                            │ Mongoose ODM
                            ▼
┌────────────────────────────────────────────────────────┐
│                   MongoDB Atlas Cloud                  │
│   Transactions • Replica Sets • GridFS Binary Storage  │
└────────────────────────────────────────────────────────┘
```

### Backend
* **Runtime**: Node.js v22+
* **Framework**: Express 5.3 (featuring modern middleware routing and async error handling)
* **Database**: MongoDB Atlas with Mongoose ODM (utilizing ACID multi-document transactions)
* **Authentication**: HTTP-Only Secure JWT Cookies + SHA-256 OTP Password Reset
* **Document Generation**: PDFKit (custom invoice layouts)
* **File Storage**: MongoDB GridFS for prescription photos and payment QR codes
* **Validation**: Zod schema validation for all endpoints and queries

### Frontend
* **Core**: React 19 with TypeScript
* **Bundler**: Vite 8 with Rolldown optimizations
* **Styling**: Tailwind CSS v4 (Sage & Beige medical palette)
* **Routing**: React Router v7 with role-based route guards
* **Forms & State**: React Hook Form + Zod resolvers
* **Icons**: Lucide React

---

## 💻 Local Development Setup

### Prerequisites
* [Node.js](https://nodejs.org/) v22 or newer
* A free [MongoDB Atlas](https://www.mongodb.com/atlas) database cluster (or local MongoDB replica set)

### 1. Clone the Repository
```bash
git clone https://github.com/rushi0369/Medical-Connect.git
cd Medical-Connect
```

### 2. Configure Environment Variables
Create a `.env` file in the `backend/` folder:

```env
PORT=5000
NODE_ENV=development
MONGODB_URI=your_mongodb_atlas_connection_string/medicare?retryWrites=true&w=majority
JWT_SECRET=your_super_secret_key_minimum_32_characters_long
CLIENT_URL=http://localhost:5173
```

Create a `.env` file in the `frontend/` folder:

```env
VITE_API_URL=http://localhost:5000/api
```

### 3. Install Dependencies
```bash
# From project root
npm run build
```

### 4. Seed Initial Accounts
Populate your database with the default admin, customer, and rider accounts:
```bash
cd backend
node scripts/seed-all-roles.js
```

### 5. Start Development Servers
Open two terminal windows:

**Window 1 (Backend API):**
```bash
cd backend
npm run dev
# Server running at http://localhost:5000
```

**Window 2 (Frontend Client):**
```bash
cd frontend
npm run dev
# Client running at http://localhost:5173
```

Open your browser at **`http://localhost:5173`**!

---

## 🌐 Production Deployment (Render)

This repository includes unified deployment scripts so Express automatically serves the compiled Vite frontend in production on a single service:

1. **Deploy on [Render.com](https://render.com/)**:
   * Create a **New Web Service** connected to your repository.
   * **Runtime**: `Node`
   * **Region**: `Singapore` (or closest to your target audience)
   * **Build Command**: `npm run build`
   * **Start Command**: `npm start`
2. **Set Environment Variables on Render**:
   * `NODE_ENV`: `production`
   * `MONGODB_URI`: *Your Atlas connection string*
   * `JWT_SECRET`: *Your secret key*
   * `CLIENT_URL`: `https://your-app-name.onrender.com`
3. **24/7 Keep-Alive (Zero Sleep)**:
   * Setup a free ping job on [cron-job.org](https://cron-job.org/) pointing to `https://your-app-name.onrender.com/api/health` every 10 minutes.

---

## 📄 License

This project is licensed under the **ISC License**.

---

<div align="center">
Made with ❤️ for <b>CK Medical</b>, Kim Char Rasta, Gujarat.
</div>
