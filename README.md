# Secure File Management Platform

A high-performance, modern full-stack File Management Platform. Built on a modular, enterprise-grade architecture, this platform features drag-and-drop uploads, instant multi-format media previews, robust user authentication, dark/light visual modes, and a powerful administrative panel for account moderation and storage regulation.

## Core Features

-   **Seamless Authentication**: Secure login, signup, forgot password, and reset password flows. Handles persistent sessions and supports account remember-me triggers.
-   **Multi-Role Architecture**: Two roles out-of-the-box:
    -   *Normal Users*: Access personal storage metrics, upload files (up to 200MB), search and filter personal files, and launch full-screen previews or downloads.
    -   *Administrators*: Access central dashboard analytics (global storage capacity, active users count, file count, recent activities), search and suspend user accounts, purge file storage, and audit any file in the system.
-   **Advanced Drag & Drop Uploader**: High-performance upload field validating file size limitations (max 200MB) and extension types (`.pdf`, `.docx`, `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`, `.mp4`). Displays individual progress percentages using native browser hooks.
-   **Multi-Format Preview Engine**: Visualizes images, scrolls inside multi-page PDFs, controls MP4 videos natively, and displays document summaries for files without inline preview capabilities.
-   **SaaS Dashboard Experience**: Styled with Inter and JetBrains Mono typography, responsive collapse navigations, custom CSS loading skeletons, floating notifications, and light/dark theme variables.

---

## Technical Stack

-   **Frontend**: React 19, TypeScript, Tailwind CSS v4, Lucide Icons, Axios, and React context theme engines.
-   **Backend**: Node.js, Express, Multer (robust file parsing, multi-part requests), and FS persistence modules.
-   **Database & Storage (Production)**: Supabase PostgreSQL Database, Row Level Security (RLS) policies, and Supabase Storage Buckets.

---

## Step-by-Step Production Setup Guide

Follow these steps to deploy this platform to production.

### Phase 1: Local Environment Preparation

1.  **Install Node.js**: Ensure Node.js v18 or later is installed. Verify with:
    ```bash
    node -v
    npm -v
    ```
2.  **Clone the Project**: Download the source folder onto your local machine.
3.  **Install Dependencies**: Install the required npm modules:
    ```bash
    npm install
    ```

---

### Phase 2: Supabase Project Setup (Backend, Auth, and Storage)

Supabase provides a powerful, free-tier backend including an authenticated user base, Postgres tables, and asset storage buckets.

1.  **Create Supabase Project**:
    -   Sign in to the [Supabase Dashboard](https://supabase.com).
    -   Click **New Project** and choose your database region.
2.  **Execute SQL Database Schemas**:
    -   Open the **SQL Editor** from the left sidebar inside Supabase.
    -   Click **New Query**.
    -   Open the `supabase_schema.sql` file from this project, copy the entire SQL content, paste it into the editor, and click **Run**.
    -   *This creates the `profiles` and `files` tables, establishes the database security rules, and mounts a database trigger to auto-create user profiles upon email signup.*
3.  **Create Storage Bucket**:
    -   Navigate to the **Storage** section from the Supabase dashboard.
    -   Click **New Bucket**.
    -   Name the bucket exactly **`files-bucket`**.
    -   Toggle **Public** to `True` (so files can generate public URLs for previews) and click **Create**.
4.  **Configure Storage Policies (RLS)**:
    -   Inside your new bucket settings, navigate to **Policies**.
    -   Select **Add Policy** to allow authenticated users to upload to their own directories:
        -   *Allowed operation*: `INSERT`, `SELECT`, `DELETE`.
        -   *Check condition*: Match user folder prefix: `(role() = 'authenticated')`.

---

### Phase 3: Configure Environment Variables

Create a `.env` file at the root of your project directory based on `.env.example`:

```env
# Supabase Public Keys (Used on Vercel and locally)
NEXT_PUBLIC_SUPABASE_URL="https://your-project-id.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-public-api-key"

# Administrative Secret Key (Used on secure server proxies only)
SUPABASE_SERVICE_ROLE_KEY="your-supabase-service-role-key"
```

#### Where to retrieve these keys:
-   In the Supabase Dashboard, navigate to **Project Settings** (gear icon) -> **API**.
-   **`NEXT_PUBLIC_SUPABASE_URL`**: Copy the URL value under **Project URL**.
-   **`NEXT_PUBLIC_SUPABASE_ANON_KEY`**: Copy the `anon` / `public` API key.
-   **`SUPABASE_SERVICE_ROLE_KEY`**: Copy the `service_role` secret API key. Keep this hidden.

---

### Phase 4: Run the Application Locally

1.  Start the full-stack development environment:
    ```bash
    npm run dev
    ```
2.  Open your browser to `http://localhost:3000` to interact with the system.
3.  *The app uses an elegant file-backed local database engine inside the development sandbox, enabling 100% functionality (such as signup, login, dashboard, drag-drop upload, previews, user blocking) immediately without configuring any external API keys first!*

---

### Phase 5: Production Deployment

You can deploy the frontend dashboard to Vercel, Netlify, or Cloudflare Pages for free:

#### Option A: Deploy to Vercel
1.  Sign up on [Vercel](https://vercel.com) and connect your GitHub account.
2.  Click **Add New** -> **Project**.
3.  Select this repository and import it.
4.  In the **Environment Variables** configuration foldout:
    -   Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` with their corresponding Supabase values.
5.  Click **Deploy**. Vercel will build and host your platform with a free SSL certificate.

#### Option B: Deploy to Netlify
1.  Sign up on [Netlify](https://netlify.com) and select **Import from Git**.
2.  Select your repository.
3.  Under **Build settings**, verify the build command is `npm run build` and publish directory is `dist` (or `out` for SPAs).
4.  Under **Environment variables**, set your Supabase keys.
5.  Click **Deploy site**.

---

## Folder Architecture Reference

This project is built around a standard, scalable layout:

```text
├── data/                       # Local persisted SQLite/JSON database folder (development)
├── uploads/                    # Local multi-user file storage directory (development)
├── src/
│   ├── types.ts                # App-wide shared TypeScript declarations (profiles, stats, files)
│   ├── main.tsx                # Master DOM rendering entrypoint
│   ├── App.tsx                 # Core App controller (session loading, toasts, modals)
│   ├── index.css               # Typography (Inter & Mono) and theme styles
│   └── components/
│       ├── ThemeContext.tsx    # Light & Dark mode controller
│       ├── AuthPages.tsx       # Auth Forms (Login, Sign-up, Forgot password, Reset)
│       ├── Layout.tsx          # Shell Layout (Responsive sidebar, Navbar, dropdown, account settings)
│       ├── DragDropUpload.tsx  # Interactive drag-and-drop multi-file uploader
│       ├── FilePreviewModal.tsx# Multi-format media display (Images, PDF, Video, Fallback info cards)
│       ├── UserDashboard.tsx   # User space (Storage metrics, files explorer, filters, sorting)
│       └── AdminDashboard.tsx  # Admin moderation cockpit (Stats, users moderation, files regulation)
├── server.ts                   # Express full-stack backend (Authentication, file upload/deletion API)
├── supabase_schema.sql         # Production PostgreSQL schemas, triggers, and RLS rules
├── metadata.json               # Platform configuration metadata
└── package.json                # Project script commands and library dependencies
```

---

## License
Licensed under the Apache-2.0 License.
