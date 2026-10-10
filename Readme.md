# 🏭 WRL Tool Report Dashboard for Western Refrigeration Pvt. Ltd.

A comprehensive, full-stack **Manufacturing Reporting & Management Dashboard** built for industrial operations. This platform centralizes production tracking, quality assurance, dispatch logistics, compliance monitoring, visitor management, audit reporting, and task reminders into a single, unified tool.

---

## 🖼️ Screenshots

| ![Screenshot 1](https://github.com/user-attachments/assets/1f084f4d-cb74-41ee-8d02-3116addd459f) | ![Screenshot 2](https://github.com/user-attachments/assets/767895a2-cedf-4ce5-92f9-d6fb03e394c9) |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| ![Screenshot 4](https://github.com/user-attachments/assets/ab1b8d03-ceda-40f3-9f4e-8d676a502e76) | ![Screenshot 3](https://github.com/user-attachments/assets/09f1e360-fd1d-4199-87de-9bf827a913fd) |

---

## 📌 Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Architecture Overview](#architecture-overview)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Environment Variables](#environment-variables)
  - [Running Locally](#running-locally)
  - [Running with Docker](#running-with-docker)
- [Module Breakdown](#module-breakdown)
- [API Documentation](#api-documentation)
- [Team](#team)
- [License](#license)

---

## 🔍 Overview

**WRL Tool Report Dashboard** is an enterprise-grade internal tool designed for manufacturing plant (Western Refrigeration Pvt. Ltd.) to digitize and streamline their daily operations. It replaces fragmented spreadsheets, paper-based logs, and manual reporting with a centralized web application that provides real-time visibility into:

- Production output & hourly tracking
- Quality inspection results (FPA, LPT, EST, CPT, BIS, BEE)
- Dispatch & logistics performance
- Compliance & calibration schedules
- Visitor management with digital pass generation
- Audit trail management with dynamic templates

The system uses **role-based access control (RBAC)** to ensure that each department only sees and interacts with the modules relevant to them.

---

## ✨ Key Features

### 🏭 Production Module

- Real-time **hourly production reports** (line-wise and aggregate)
- **Stage history tracking** for individual components
- **NFC-based** component traceability reports
- **Component details** lookup and **model name management**
- **Total production** dashboards with shift-wise breakdowns
- **Line hourly reports** with category-specific views (Foaming, Post-Foaming, Final Line, Final Loading)

### ✅ Quality Module

- **FPA (Finish Product Audit)** entry, defect logging with image uploads, and reporting
- **LPT (Long Performance Test)** management, recipe configuration, and reporting
- **EST (Electrical Safety Test)** detailed reports with modal views
- **CPT (Cooling Performance Test)** report generation
- **Gas Charging** reports with detailed drill-downs
- **BIS (Bureau of Indian Standards)** report uploads and status tracking
- **BEE (Bureau of Energy Efficiency)** calculation tools
- **Rework** entry and reporting
- **Scrap & Brazing** reports
- **Dispatch hold** management and **hold cabinet details**
- **Tag update** utilities for quality labels

### 🚚 Dispatch Module

- **Dispatch reports** with date-range filtering
- **Gate entry** tracking with automated email alerts
- **FG Casting** reports
- **Error log** management
- **Performance reports** with KPI tracking
- **Logistics display** screens for shop-floor monitors

### 📋 Planning Module

- **Daily production plans** with target vs actual comparison
- **Production planning** with model-wise scheduling

### 📑 Audit Report Module

- **Dynamic template builder** — create custom audit templates without code
- **Audit entry** forms generated from templates
- **Audit list** and **audit view** for historical tracking
- Template versioning with **backup management**

### 📅 Compliance Module

- **Calibration tracking** with instrument-level schedules
- **Escalation workflows** — automated email reminders at multiple levels
- **History tables** for calibration records

### 🏢 Visitor Management Module

- **Digital visitor pass** generation with QR codes
- **Check-in/Check-out** tracking
- **Employee management** for host assignment
- **Dashboard** with real-time visitor statistics
- **History & Reports** with email export capabilities

### ⏰ Task Reminder Module

- **Task creation** with due dates and assignees
- **Email notifications** on task creation and completion
- **Cron-based reminders** for overdue tasks

### 🔐 Authentication & Authorization

- **JWT-based authentication** with HTTP-only cookies
- **Role-based access control** — different modules visible per user role
- **Protected routes** on both frontend and backend

### 📧 Email System

- **Templated emails** for each module (calibration alerts, visitor passes, task reminders, gate entry alerts)
- **Nodemailer** integration with configurable SMTP

### 📊 Data Export

- **Excel export** using ExcelJS for detailed reports
- **PDF generation** using jsPDF for visitor passes
- **Chart visualizations** using Chart.js with data labels

---

## 🛠 Tech Stack

| Layer             | Technology                                                                                    |
| ----------------- | --------------------------------------------------------------------------------------------- |
| **Frontend**      | React 19, Vite 6, Redux Toolkit, React Router 7, React Hot Toast, React Icons, Tailwind CSS 4 |
| **Backend**       | Node.js, Express 5, ES Modules                                                                |
| **Databases**     | Microsoft SQL Server (MSSQL)                                                                  |
| **Auth**          | JSON Web Tokens (JWT), Cookie-based sessions                                                  |
| **Email**         | Nodemailer with HTML templates                                                                |
| **Scheduling**    | node-cron for periodic tasks                                                                  |
| **File Handling** | Multer for file uploads                                                                       |
| **Charts**        | Chart.js + react-chartjs-2 + chartjs-plugin-datalabels                                        |
| **PDF/Excel**     | jsPDF, ExcelJS, file-saver, xlsx                                                              |
| **QR Code**       | qrcode (for visitor passes)                                                                   |
| **DevOps**        | Docker, Docker Compose                                                                        |

---

## 🏗 Architecture Overview

```
                ┌─────────────────┐        ┌─────────────────┐
                │                 │  HTTP  │                 │
                │    React SPA    │◄──────►│   Express API   │
                │   (Vite + TW)   │  REST  │     Server      │
                │                 │        │                 │
                └────────┬────────┘        └────────┬────────┘
                         │                          │
                         │                          │
                         │                ┌─────────┴─────────┐
                         │                │                   │
                         │          ┌─────▼─────┐       ┌─────▼─────┐
                         │          │   MSSQL   │       │   MSSQL   │
                         │          │     DB    │       │     DB    │
                         │          └───────────┘       └───────────┘
                         │
                ┌────────▼─────────┐
                │    Redux Store   │
                │    (Persisted)   │
                └──────────────────┘
```

The application follows a **modular monolith** architecture:

- **Frontend** communicates with the Backend via RESTful APIs using Axios
- **Backend** connects to both MSSQL and MySQL databases for different data domains
- **Cron jobs** run server-side for escalation emails and task reminders
- **State management** uses Redux Toolkit with persistence for session continuity

---

## 📂 Project Structure

```bash
WRL-Tool-Report-Dashboard/
├── Backend/
│   ├── config/
│   │   ├── db.config.js
│   │   ├── email.config.js
│   ├── controllers/
│   │   ├── auditReport/
│   │   │   ├── audit.controller.js
│   │   │   ├── template.controller.js
│   │   └── compliance/
│   │   │   ├── calibiration.controller.js
│   │   │   ├── calibirationUsers.controller.js
│   │   └── dispatch/
│   │   │   ├── dispatchReport.controller.js
│   │   │   ├── errorLog.controller.js
│   │   │   ├── fgCasting.controller.js
│   │   │   ├── gateEntry.controller.js
│   │   │   ├── performanceReport.controller.js
│   │   └── planing/
│   │   │   ├── productionPlaning.controller.js
│   │   └── production/
│   │   │   ├── componentDetails.controller.js
│   │   │   ├── componentTraceabilityReport.controller.js
│   │   │   ├── hourlyReport.controller.js
│   │   │   ├── lineHourlyReport.controller.js
│   │   │   ├── nfcReport.controller.js
│   │   │   ├── productionReport.controller.js
│   │   │   ├── stageHistoryReport.controller.js
│   │   │   ├── totalProduction.controller.js
│   │   └── quality/
│   │   │   ├── beeCalculation.controller.js
│   │   │   ├── cptReport.controller.js
│   │   │   ├── dispatchHold.controller.js
│   │   │   ├── estReport.controller.js
│   │   │   ├── fpa.controller.js
│   │   │   ├── fpaReport.controller.js
│   │   │   ├── gasCharging.controller.js
│   │   │   ├── holdCabinetDetails.controller.js
│   │   │   ├── lpt.controller.js
│   │   │   ├── lptRecipe.controller.js
│   │   │   ├── lptReport.controller.js
│   │   │   ├── rework.controller.js
│   │   │   ├── tagUpdate.controller.js
│   │   │   ├── uploadBISReport.controller.js
│   │   └── taskReminder/
│   │   │   ├── tasks.controller.js
│   │   └── visitor/
│   │   │   ├── dashboard.controller.js
│   │   │   ├── generatePass.controller.js
│   │   │   ├── history.controller.js
│   │   │   ├── inOut.controller.js
│   │   │   ├── manageEmployee.controller.js
│   │   │   ├── reports.controller.js
│   │   └── auth.controller.js
│   │   └── common.controller.js
│   ├── cron/
│   │   ├── calibrationEscalation.js
│   │   ├── taskReminder.js
│   ├── emailTemplates/
│   │   ├── Calibration_System
│   │   │   ├── calibrationAlert.template.js
│   │   │   ├── calibrationMail.template.js
│   │   ├── Dispatch_System
│   │   │   ├── gateEntryAlert.template.js
│   │   ├── Task_Reminder_System
│   │   │   ├── createTaskReminder.template.js
│   │   │   ├── taskCompleted.template.js
│   │   ├── Visitor_Management_System
│   │   │   ├── visitorPass.template.js
│   │   │   ├── visitorReport.template.js
│   ├── middlewares
│   │   ├── auth.js
│   │   ├── errorHandler.js
│   │   ├── uploadMiddleware.js
│   ├── node_modules/
│   ├── routes/
│   │   ├── auditReport.route.js
│   │   ├── auth.route.js
│   │   ├── common.route.js
│   │   ├── compliance.route.js
│   │   ├── dispatch.route.js
│   │   ├── estReport.route.js
│   │   ├── gasChargingReport.route.js
│   │   ├── index.js
│   │   ├── planing.route.js
│   │   ├── production.route.js
│   │   ├── quality.route.js
│   │   ├── taskReminder.route.js
│   │   ├── visitor.route.js
│   ├── services/
│   │   └── escalation.service.js
│   ├── uploads/
│   │   └── AuditTemplates
│   │   │   ├── backups/
│   │   └── BISReport
│   │   └── Calibration
│   │   └── FpaDefectImages
│   ├── utils/
│   │   └── AppError.js
│   │   └── convertToIST.js
│   │   └── escalation.js
│   │   └── generateCode.js
│   │   └── templateStorage.js
│   │   └── tryCatch.js
│   └── .dockerignore
│   └── .env
│   └── .gitignore
│   └── Dockerfile
│   └── package-lock.json
│   └── package.json
│   └── server.js
│
├── Frontend/
│   ├── node_modules/
│   ├── public/
│   │   ├── favicon.ico
│   ├── src/
│   │   ├── assets/
│   │   │   ├── assets.js
│   │   │   ├── industrialBg1.JPG
│   │   │   ├── industrialBg2.avif
│   │   │   ├── industrialBg3.avif
│   │   │   ├── logo.png
│   │   ├── components/
│   │   │   ├── graphs/
│   │   │   ├── lineHourly/
│   │   │   │   └── FinalLine
│   │   │   │   │   └── FinalCategoryCount.jsx
│   │   │   │   │   └── FinalChoc.jsx
│   │   │   │   │   └── FinalFreezer.jsx
│   │   │   │   │   └── FinalSUS.jsx
│   │   │   │   └── FinalLoading
│   │   │   │   │   └── FinalCategoryLoadingCount.jsx
│   │   │   │   │   └── FinalLoadingChoc.jsx
│   │   │   │   │   └── FinalLoadingFreezer.jsx
│   │   │   │   │   └── FinalLoadingSUS.jsx
│   │   │   │   └── Foaming
│   │   │   │   │   └── FoamingA.jsx
│   │   │   │   │   └── FoamingB.jsx
│   │   │   │   │   └── FoamingCategoryCount.jsx
│   │   │   │   └── PostFoaming
│   │   │   │   │   └── ManualPostFoaming.jsx
│   │   │   │   │   └── PostFoamingCategoryCount.jsx
│   │   │   │   │   └── PostFoamingFreezer.jsx
│   │   │   │   │   └── PostFoamingSUS.jsx
│   │   │   ├── ui/
│   │   │   │   └── Badge.jsx
│   │   │   │   └── Button.jsx
│   │   │   │   └── DateTimePicker.jsx
│   │   │   │   └── ExportButton.jsx
│   │   │   │   └── InputField.jsx
│   │   │   │   └── Loader.jsx
│   │   │   │   └── Pagination.jsx
│   │   │   │   └── PopupModal.jsx
│   │   │   │   └── RadioButton.jsx
│   │   │   │   └── ScrollToTop.jsx
│   │   │   │   └── SelectField.jsx
│   │   │   │   └── Title.jsx
│   │   │   └── ESTDetailModal.jsx
│   │   │   └── GasChargingDetailModal.jsx
│   │   │   └── Layout.jsx
│   │   │   └── Navbar.jsx
│   │   │   └── ProtectedRoute.jsx
│   │   │   └── Sidebar.jsx
│   │   ├── config/
│   │   │   └── routes.config.js
│   │   ├── hooks/
│   │   │   └── useAuditData.js
│   │   │   └── useEstReport.js
│   │   │   └── useRoleAccess.js
│   │   ├── pages/
│   │   │   ├── AuditReport/
│   │   │   ├── Audit/
│   │   │   │   └── AuditEntry.jsx
│   │   │   │   └── AuditList.jsx
│   │   │   │   └── AuditView.jsx
│   │   │   ├── Template/
│   │   │   │   └── TemplateBuilder.jsx
│   │   │   │   └── TemplateList.jsx
│   │   │   ├── Auth/
│   │   │   │   └── Login.jsx
│   │   │   ├── Compliance/
│   │   │   │   └── Calibration.jsx
│   │   │   │   └── HistoryTable.jsx
│   │   │   ├── Dispatch/
│   │   │   │   └── DispatchPerformanceReport.jsx
│   │   │   │   └── DispatchReport.jsx
│   │   │   │   └── DispatchUnloading.jsx
│   │   │   │   └── ErrorLog.jsx
│   │   │   │   └── FGCasting.jsx
│   │   │   │   └── GateEntry.jsx
│   │   │   ├── PerformanceDisplays/
│   │   │   │   └── LogisticsDisplay.jsx
│   │   │   ├── Planing/
│   │   │   │   └── ProductionPlaning.jsx
│   │   │   ├── Production/
│   │   │   │   └── ComponentDetails.jsx
│   │   │   │   └── ComponentTraceabilityReport.jsx
│   │   │   │   └── HourlyReport.jsx
│   │   │   │   └── LineHourlyReport.jsx
│   │   │   │   └── ModelNameUpload.jsx
│   │   │   │   └── NFCReport.jsx
│   │   │   │   └── Overview.jsx
│   │   │   │   └── StageHistoryReport.jsx
│   │   │   │   └── TotalProduction.jsx
│   │   │   ├── Quality/
│   │   │   │   └── BEECalculation.jsx
│   │   │   │   └── BISReports.jsx
│   │   │   │   └── BISStatus.jsx
│   │   │   │   └── BrazingReport.jsx
│   │   │   │   └── CPTReport.jsx
│   │   │   │   └── DispatchHold.jsx
│   │   │   │   └── ESTReport.jsx
│   │   │   │   └── FPA.jsx
│   │   │   │   └── FPAReports.jsx
│   │   │   │   └── GasChargingReport.jsx
│   │   │   │   └── HoldCabinetDetails.jsx
│   │   │   │   └── LPT.jsx
│   │   │   │   └── LPTRecipe.jsx
│   │   │   │   └── LPTReport.jsx
│   │   │   │   └── ProcessHistoryCard.jsx
│   │   │   │   └── ReworkEntry.jsx
│   │   │   │   └── ReworkReport.jsx
│   │   │   │   └── ScrapReport.jsx
│   │   │   │   └── TagUpdate.jsx
│   │   │   │   └── UploadBISReport.jsx
│   │   │   ├── TaskReminders/
│   │   │   │   └── ManageTasks.jsx
│   │   │   │   └── TaskOverview.jsx
│   │   │   ├── Visitor/
│   │   │   │   └── Dashboard.jsx
│   │   │   │   └── GeneratePass.jsx
│   │   │   │   └── History.jsx
│   │   │   │   └── InOut.jsx
│   │   │   │   └── ManageEmployee.jsx
│   │   │   │   └── Reports.jsx
│   │   │   │   └── VisitorPassDisplay.jsx
│   │   │   ├── Home.jsx
│   │   │   └── NotFound.jsx
│   │   ├── redux/
│   │   │   ├── api/
│   │   │   │   └── commonApi.js
│   │   │   │   └── estReportApi.js
│   │   │   │   └── gasChargingApi.js
│   │   │   │   └── taskReminder.js
│   │   │   ├── authSlice.js
│   │   │   ├── estReportSlice.js
│   │   │   ├── gasChargingSlice.js
│   │   │   ├── store.js
│   │   ├── utils/
│   │   │   └── dateUtils.js
│   │   │   └── exportToXls.js
│   │   │   └── mapCategories.js
│   │   │   └── shiftUtils.js
│   │   ├── App.jsx
│   │   ├── index.css
│   │   ├── main.jsx
│   ├── .dockerignore
│   ├── .env
│   ├── .gitignore
│   ├── Dockerfile
│   ├── eslint.config.js
│   ├── index.html
│   ├── package-lock.json
│   ├── package.json
│   ├── vite.config.js
├── APIs_Doc.md
└── docker-compose.yml
├── README.md
```

📖 See [Backend README](./Backend/README.md) and [Frontend README](./Frontend/README.md) for detailed documentation of each.

---

## 🚀 Getting Started

## 📌 Prerequisites

Ensure the following are installed on your machine:

| Tool              | Version | Purpose                  |
| ----------------- | ------- | ------------------------ |
| Node.js           | ≥ 18.x  | JavaScript runtime       |
| npm               | ≥ 9.x   | Package manager          |
| MSSQL Server      | ≥ 2019  | Primary database         |
| Docker (optional) | ≥ 24.x  | Containerized deployment |
| Git               | ≥ 2.x   | Version control          |

---

## 🔐 Environment Variables

Both **Frontend** and **Backend** require `.env` files.  
See the respective READMEs for full details.

---

### 🖥 Backend (`Backend/.env`)

```env
PORT=3000
JWT_SECRET=jwt_secret
CORS_ORIGIN=http://localhost:5173

# Database 1
DB_USER1=database_username
DB_PASSWORD1=database_password
DB_SERVER1=server_IP
DB_NAME1=database_name

# Database 2
DB_USER2=database_username
DB_PASSWORD2=database_password
DB_SERVER2=server_IP
DB_NAME2=database_name

# Database 3
DB_USER3=database_username
DB_PASSWORD3=database_password
DB_SERVER3=server_IP
DB_NAME3=database_name

# Email config
SMTP_HOST=SMTP_host
SMTP_PORT=587
SMTP_USER=SMTP_username
SMTP_PASS=SMTP_password

# App Configuration
FRONTEND_URL=frontend_url
TASK_OVERVIEW_PATH=/reminder/overview
```

---

### 🌐 Frontend (`Frontend/.env`)

```env
VITE_API_BASE_URL='http://localhost:3000/api/v1/'
```

---

## ▶️ Running Locally

### 1️⃣ Clone the repository

```bash
git clone https://github.com/Varunyadavgithub/WRL-Tool-Report-Dashboard
cd WRL-Tool-Report-Dashboard
```

---

### 2️⃣ Start the Backend

```bash
cd Backend
npm install
npm run dev
```

The API server will start at:

```
http://localhost:3000
```

---

### 3️⃣ Start the Frontend

```bash
cd Frontend
npm install
npm run dev
```

The development server will start at:

```
http://localhost:5173
```

---

## 🐳 Running with Docker

From the root directory:

```bash
docker-compose up --build
```

This will spin up both frontend and backend containers as defined in `docker-compose.yml`.

### Stop containers

```bash
docker-compose down
```

### Rebuild after changes

```bash
docker-compose up --build -d
```

---

# 📦 Module Breakdown

| Module        | Backend Controllers | Frontend Pages | Key Capabilities                                |
| ------------- | ------------------- | -------------- | ----------------------------------------------- |
| Production    | 9                   | 9              | Hourly reports, traceability, NFC, line-wise    |
| Quality       | 15                  | 19             | FPA, LPT, EST, CPT, BIS, BEE, rework, gas       |
| Dispatch      | 5                   | 6              | Gate entry, FG casting, error logs, performance |
| Planning      | 2                   | 2              | Daily plans, production scheduling              |
| Audit Report  | 2                   | 5              | Dynamic templates, audit entry & tracking       |
| Compliance    | 2                   | 2              | Calibration tracking, escalation workflows      |
| Visitor       | 6                   | 7              | Pass generation, check-in/out, reports          |
| Task Reminder | 1                   | 2              | Task management with email reminders            |
| Auth          | 1                   | 1              | Login, JWT tokens, role management              |

---

# 📡 API Documentation

📘 Detailed API endpoint documentation: [APIs Documentation](APIs_Doc.md)

---

## 🌍 General API Structure

**Base URL:**

```
http://localhost:3000/api/v1
```

### Available Routes

```
/api/v1/auth/_            → Authentication endpoints
/api/v1/shared/_          → Shared/common endpoints
/api/v1/prod/_            → Production module endpoints
/api/v1/quality/_         → Quality module endpoints
/api/v1/est-report/_      → EST report endpoints
/api/v1/gas-charging/_    → Gas charging report endpoints
/api/v1/dispatch/_        → Dispatch module endpoints
/api/v1/planing/_         → Planning module endpoints
/api/v1/visitor/_         → Visitor management endpoints
/api/v1/compliance/_      → Compliance module endpoints
/api/v1/task-reminder/_   → Task reminder endpoints
/api/v1/audit-report/_    → Audit report endpoints
```

---

## 👥 Team

This project is built and actively maintained by the **WRL MES Developer Team** to support internal manufacturing operations, reporting automation, compliance tracking, and production monitoring at **Western Refrigeration Pvt. Ltd.**

The team focuses on delivering scalable, secure, and production-ready MES solutions aligned with real-time plant requirements.

<br/>

<table>
  <tr>
    <td align="center">
      <img src="https://github.com/thecyberdevvarun.png" width="120px;" style="border-radius:50%; border:3px solid #e1e4e8;" alt="Varun Yadav"/><br />
      <b>Varun Yadav</b><br />
      <sub>MES Engineer</sub><br />
      <sub>Western Refrigeration Pvt. Ltd.</sub><br />
      <a href="https://www.linkedin.com/in/thecyberdevvarun">LinkedIn</a>
    </td>
    <td align="center">
      <img src="https://github.com/buildwithvikash.png" width="120px;" style="border-radius:50%; border:3px solid #e1e4e8;" alt="Vikash Kumar"/><br />
      <b>Vikash Kumar</b><br />
      <sub>MES Engineer</sub><br />
      <sub>Western Refrigeration Pvt. Ltd.</sub><br />
      <a href="https://www.linkedin.com/in/vikash-kumar-54b464336/">LinkedIn</a>
    </td>

  </tr>
</table>

---

### 💡 Setup Tip

If you encounter issues during first-time setup:

- Ensure your database credentials are correctly configured in `Backend/.env`
- Verify that **MSSQL** services are running
- Confirm that databases are accessible from your development machine
- Check that required ports (1433 for MSSQL) are open

---

## � Development Workflow

### Code Structure Guidelines

- **Backend Controllers**: Handle business logic and database operations
- **Frontend Pages**: React components organized by module in `src/pages/`
- **Redux Slices**: State management for complex data flows
- **API Calls**: Centralized in `src/redux/api/` using Axios
- **Reusable Components**: Located in `src/components/ui/` for common UI elements

### Git Workflow

```bash
# Create a new feature branch
git checkout -b feature/module-name

# Make changes and commit
git add .
git commit -m "feat: add description of changes"

# Push to remote
git push origin feature/module-name
```

### Commit Message Convention

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `refactor:` Code refactoring
- `style:` Code style changes (formatting, etc.)
- `test:` Adding or updating tests
- `chore:` Maintenance tasks

---

## 🧪 Testing

### Manual Testing Checklist

- [ ] User authentication (login/logout)
- [ ] Role-based access control for each module
- [ ] Production report generation and export
- [ ] Quality module data entry and reporting
- [ ] Dispatch reports and gate entry alerts
- [ ] Visitor pass generation with QR codes
- [ ] Task reminder creation and email notifications
- [ ] Calibration escalation workflows
- [ ] Audit template creation and audit entry
- [ ] Email notifications across all modules
- [ ] Excel and PDF export functionality

### API Testing

Use tools like Postman or Insomnia to test API endpoints:

1. Import the API collection from `APIs_Doc.md`
2. Set base URL to `http://localhost:3000/api/v1`
3. Authenticate via `/auth/login` endpoint
4. Include the JWT token in cookies for protected routes

---

## 🔒 Security Considerations

### Authentication & Authorization

- **JWT Tokens**: Stored in HTTP-only cookies to prevent XSS attacks
- **Token Expiration**: 24-hour session timeout
- **Role-Based Access Control**: Each user role has specific module access
- **Protected Routes**: Both frontend and backend enforce authentication

### Data Protection

- **SQL Injection Prevention**: Parameterized queries using MSSQL driver
- **File Upload Validation**: Multer middleware with file type and size restrictions
- **CORS Configuration**: Restricted to allowed origins only
- **Environment Variables**: Sensitive credentials stored in `.env` files (never committed)

### Best Practices

- Never commit `.env` files or sensitive credentials
- Use strong passwords for database and SMTP accounts
- Regularly update dependencies for security patches
- Implement rate limiting for API endpoints in production
- Enable HTTPS in production environments

---

## ⚡ Performance Optimization

### Frontend Optimization

- **Code Splitting**: React Router lazy loading for route-based code splitting
- **Redux Persist**: Session state persisted to localStorage for faster reloads
- **Image Optimization**: Compressed images in `src/assets/`
- **Bundle Size**: Vite's optimized build process for minimal bundle size

### Backend Optimization

- **Database Connection Pooling**: MSSQL connection pooling for efficient database access
- **Cron Jobs**: Scheduled tasks run at optimal times to avoid peak hours
- **Caching Strategy**: Consider implementing Redis for frequently accessed data
- **Async Operations**: Non-blocking I/O for email sending and file operations

### Database Optimization

- **Indexed Columns**: Ensure frequently queried columns have proper indexes
- **Query Optimization**: Use efficient SQL queries with proper JOIN operations
- **Connection Management**: Properly close database connections after use

---

## 🐛 Troubleshooting

### Common Issues and Solutions

#### 1. Database Connection Failed

**Symptoms**: Backend fails to start with database connection errors

**Solutions**:
- Verify MSSQL server is running and accessible
- Check database credentials in `Backend/.env`
- Ensure database server IP is correct and firewall allows connection
- Test connection using SQL Server Management Studio

#### 2. CORS Errors

**Symptoms**: Frontend cannot communicate with backend

**Solutions**:
- Verify `CORS_ORIGIN` in `Backend/.env` matches frontend URL
- Check that backend is running on correct port (default: 3000)
- Ensure no proxy conflicts in development

#### 3. Email Notifications Not Working

**Symptoms**: Tasks/visitors created but no emails sent

**Solutions**:
- Verify SMTP credentials in `Backend/.env`
- Check SMTP server is accessible from backend
- Review email logs in backend console
- Test SMTP configuration using a simple email client

#### 4. File Upload Failures

**Symptoms**: Unable to upload FPA defect images or BIS reports

**Solutions**:
- Check `uploads/` directory permissions
- Verify Multer configuration in `Backend/middlewares/uploadMiddleware.js`
- Ensure file size limits are appropriate
- Check disk space on server

#### 5. QR Code Generation Issues

**Symptoms**: Visitor passes not generating QR codes

**Solutions**:
- Verify `qrcode` package is installed in Frontend
- Check browser console for JavaScript errors
- Ensure QR code library is properly imported

#### 6. Docker Container Issues

**Symptoms**: Containers fail to start or cannot communicate

**Solutions**:
- Rebuild containers: `docker-compose up --build`
- Check container logs: `docker-compose logs backend` or `docker-compose logs frontend`
- Verify network configuration in `docker-compose.yml`
- Ensure ports 3000 and 5173 are not in use

### Debug Mode

Enable detailed logging by setting environment variable:

```env
NODE_ENV=development
```

---

## 📊 Database Schema Overview

### Primary Database Tables

The application uses **Microsoft SQL Server (MSSQL)** with the following key table categories:

#### Production Module
- `HourlyProduction` - Hourly production records by line
- `StageHistory` - Component stage tracking
- `ComponentDetails` - Component master data
- `ModelNames` - Product model definitions

#### Quality Module
- `FPA_Records` - First Piece Approval records
- `FPA_Defects` - Defect logging with image paths
- `LPT_Records` - Leak Proof Test results
- `LPT_Recipes` - LPT test recipes
- `EST_Reports` - Electrical Safety Test reports
- `CPT_Reports` - Component Performance Test data
- `GasCharging` - Gas charging records
- `BIS_Reports` - BIS compliance reports
- `Rework_Records` - Rework tracking
- `Dispatch_Hold` - Hold cabinet management

#### Dispatch Module
- `Dispatch_Reports` - Daily dispatch data
- `GateEntry` - Gate entry/exit logs
- `FG_Casting` - Final goods casting records
- `Error_Logs` - System error tracking

#### Compliance Module
- `Calibration_Schedule` - Instrument calibration schedules
- `Calibration_History` - Calibration completion records
- `Calibration_Users` - User escalation hierarchy

#### Visitor Management
- `Visitor_Passes` - Visitor pass records
- `Visitor_InOut` - Check-in/check-out logs
- `Employees` - Employee directory for host assignment

#### Task Reminders
- `Tasks` - Task records with due dates and assignees

#### Audit Reports
- `Audit_Templates` - Dynamic audit template definitions
- `Audit_Records` - Completed audit entries

#### Authentication
- `Users` - User credentials and role assignments

---

## 🚀 Deployment Guide

### Production Deployment Checklist

- [ ] Update all environment variables with production values
- [ ] Configure production database credentials
- [ ] Set up production SMTP server
- [ ] Enable HTTPS/SSL certificates
- [ ] Configure firewall rules for ports 3000 and 5173
- [ ] Set up database backups
- [ ] Configure log rotation
- [ ] Set up monitoring and alerting
- [ ] Review and tighten CORS settings
- [ ] Enable rate limiting on API endpoints

### Deployment Options

#### Option 1: Traditional VPS/Server

```bash
# On production server
git clone https://github.com/Varunyadavgithub/WRL-Tool-Report-Dashboard
cd WRL-Tool-Report-Dashboard

# Install PM2 for process management
npm install -g pm2

# Backend setup
cd Backend
npm install --production
pm2 start server.js --name "wrl-backend"

# Frontend setup
cd ../Frontend
npm install --production
npm run build
pm2 serve dist --name "wrl-frontend" --spa
```

#### Option 2: Docker Deployment

```bash
# On production server
git clone https://github.com/Varunyadavgithub/WRL-Tool-Report-Dashboard
cd WRL-Tool-Report-Dashboard

# Build and start containers
docker-compose up -d --build

# View logs
docker-compose logs -f
```

#### Option 3: Cloud Platform (AWS/Azure/GCP)

- Deploy backend as containerized service (ECS/AKS/GKE)
- Deploy frontend as static site (S3/Storage Account) with CDN
- Use managed database service (RDS/Azure SQL/Cloud SQL)
- Configure load balancer for high availability
- Set up auto-scaling based on traffic

---

## 📈 Monitoring & Maintenance

### Health Checks

Implement health check endpoints:

```bash
GET /api/v1/health
```

Response:
```json
{
  "status": "healthy",
  "database": "connected",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### Log Management

- **Backend Logs**: Console output with timestamps and log levels
- **Frontend Logs**: Browser console for client-side errors
- **Error Tracking**: Consider integrating Sentry for error monitoring
- **Access Logs**: Track API usage and performance metrics

### Backup Strategy

- **Database Backups**: Daily automated backups with 30-day retention
- **File Backups**: Backup `uploads/` directory regularly
- **Configuration Backups**: Version control for configuration files
- **Disaster Recovery**: Document recovery procedures

---

## 🤝 Contributing Guidelines

### How to Contribute

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style

- Follow existing code style and formatting
- Use descriptive variable and function names
- Add comments for complex logic
- Keep functions small and focused
- Write modular, reusable components

### Pull Request Process

- Provide clear description of changes
- Reference related issues if applicable
- Ensure all tests pass
- Update documentation if needed
- Request review from team members

---

## 📞 Support & Contact

For technical support or questions about this project:

- **Project Repository**: [GitHub](https://github.com/Varunyadavgithub/WRL-Tool-Report-Dashboard)
- **Issues**: Report bugs via GitHub Issues
- **Documentation**: See `APIs_Doc.md` for detailed API documentation

---

## 🗺 Roadmap

### Planned Enhancements

- [ ] **Real-time Dashboard**: WebSocket integration for live production updates
- [ ] **Mobile App**: React Native version for on-the-go access
- [ ] **Advanced Analytics**: Power BI integration for executive dashboards
- [ ] **IoT Integration**: Direct sensor data from production lines
- [ ] **Machine Learning**: Predictive maintenance and quality forecasting
- [ ] **Multi-language Support**: Localization for regional plants
- [ ] **Offline Mode**: PWA capabilities for areas with poor connectivity
- [ ] **Advanced Reporting**: Custom report builder with drag-and-drop interface

---

## �📃 License

This project is proprietary and developed exclusively for internal use at
**Western Refrigeration Pvt. Ltd.**

© 2024 Western Refrigeration Pvt. Ltd. All rights reserved.
