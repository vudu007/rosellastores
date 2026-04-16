# Project Structure - RetailPro Retail Management System

This document outlines the complete file structure of the RetailPro system.

## Directory Tree

```
retail-system/
├── .env.example                          # Environment variables template
├── next.config.ts                        # Next.js configuration
├── tailwind.config.ts                    # Tailwind CSS configuration
├── tsconfig.json                         # TypeScript configuration
├── postcss.config.js                     # PostCSS configuration
├── package.json                          # Dependencies and scripts
├── README.md                             # Project documentation
├── PROJECT_STRUCTURE.md                  # This file
│
├── prisma/
│   ├── schema.prisma                     # Database schema (Prisma ORM)
│   └── seed.ts                           # Database seed data
│
└── src/
    ├── app/
    │   ├── globals.css                   # Global styles
    │   ├── layout.tsx                    # Root layout with SessionProvider
    │   ├── page.tsx                      # Home page (redirects based on role)
    │   │
    │   ├── (auth)/                       # Auth routes group
    │   │   └── login/
    │   │       └── page.tsx              # Login page
    │   │
    │   ├── api/                          # API routes
    │   │   ├── auth/
    │   │   │   └── [...nextauth]/
    │   │   │       └── route.ts          # NextAuth authentication endpoints
    │   │   │
    │   │   ├── products/
    │   │   │   ├── route.ts              # GET: list products, POST: create
    │   │   │   └── [id]/
    │   │   │       └── route.ts          # GET: product detail, PUT: update, DELETE: delete
    │   │   │
    │   │   ├── sales/
    │   │   │   ├── route.ts              # GET: list sales, POST: create sale
    │   │   │   └── [id]/
    │   │   │       └── route.ts          # GET: sale detail, PUT: update status
    │   │   │
    │   │   ├── customers/
    │   │   │   └── route.ts              # GET: list customers, POST: create
    │   │   │
    │   │   ├── inventory/
    │   │   │   └── route.ts              # GET: stock levels, PATCH: adjust stock
    │   │   │
    │   │   ├── expenses/
    │   │   │   └── route.ts              # GET: list expenses, POST: create
    │   │   │
    │   │   ├── dashboard/
    │   │   │   └── stats/
    │   │   │       └── route.ts          # GET: dashboard statistics
    │   │   │
    │   │   └── reports/
    │   │       └── eod/
    │   │           └── route.ts          # GET: EOD report, POST: send email or PDF
    │   │
    │   ├── (dashboard)/                  # Dashboard routes group (OWNER/MANAGER only)
    │   │   ├── layout.tsx                # Layout with Navbar and Sidebar
    │   │   └── dashboard/
    │   │       ├── page.tsx              # Dashboard overview
    │   │       ├── inventory/
    │   │       │   └── page.tsx          # Inventory management
    │   │       ├── sales/
    │   │       │   └── page.tsx          # Sales history
    │   │       ├── customers/
    │   │       │   └── page.tsx          # Customer management
    │   │       ├── reports/
    │   │       │   └── page.tsx          # Reports and analytics
    │   │       ├── staff/
    │   │       │   └── page.tsx          # Staff management
    │   │       ├── expenses/
    │   │       │   └── page.tsx          # Expense tracking
    │   │       └── settings/
    │   │           └── page.tsx          # System settings
    │   │
    │   ├── (pos)/                        # POS routes group (CASHIER only)
    │   │   ├── layout.tsx                # Layout with Navbar
    │   │   └── pos/
    │   │       └── page.tsx              # POS interface with cart
    │   │
    │   └── (wholesale)/                  # Wholesale routes group (WHOLESALE_CUSTOMER only)
    │       ├── layout.tsx                # Layout with Navbar
    │       └── wholesale/
    │           └── page.tsx              # Wholesale portal
    │
    ├── components/
    │   └── shared/
    │       ├── Navbar.tsx                # Top navigation bar
    │       └── Sidebar.tsx               # Dashboard sidebar menu
    │
    ├── lib/
    │   ├── prisma.ts                     # Prisma client singleton
    │   ├── auth.ts                       # NextAuth configuration
    │   ├── email.ts                      # Email utilities and templates
    │   ├── eod.ts                        # EOD report generation and PDF
    │   └── cron.ts                       # Scheduled task management
    │
    └── types/
        └── index.ts                      # TypeScript interfaces and types
```

## File Count Summary

- **Total Files**: 44
- **TypeScript/TSX Files**: 32
- **Configuration Files**: 5
- **Documentation**: 2
- **CSS Files**: 1
- **JavaScript Files**: 1
- **Example Files**: 1
- **Prisma Files**: 2

## Key Features by File

### Database Layer (`prisma/`)
- **schema.prisma**: Complete data model with 11 models (User, Branch, Product, Category, Supplier, Customer, Sale, SaleItem, Expense, DiscountCode, AuditLog, Setting)
- **seed.ts**: Generates demo data including users, products, customers, and sample sales

### Authentication & Authorization (`src/lib/auth.ts`)
- NextAuth.js v5 configuration
- Credentials provider for email/password auth
- JWT-based session management
- Role-based redirects (OWNER → /dashboard, MANAGER → /dashboard, CASHIER → /pos, WHOLESALE_CUSTOMER → /wholesale)

### Email & Reporting (`src/lib/email.ts`, `src/lib/eod.ts`)
- Nodemailer setup for SMTP
- Beautiful HTML email templates with inline CSS
- EOD report generation with:
  - Sales summary
  - Payment method breakdown
  - Top 5 products
  - Low stock alerts
  - Day comparison
- PDF generation using pdfkit

### Scheduled Tasks (`src/lib/cron.ts`)
- node-cron based task scheduler
- Daily EOD email at configured time
- Daily low stock check at 8:00 AM
- Configurable through Settings

### API Routes (10 endpoints)
- Authentication with NextAuth
- Products (CRUD operations)
- Sales (create, list, update status)
- Customers (create, list)
- Inventory (view, adjust stock)
- Expenses (create, list)
- Dashboard stats
- Reports (generate, email, PDF)

### UI Pages by Role

#### Owner/Manager (Dashboard)
- Dashboard overview with stats
- Inventory management
- Sales history with filtering
- Customer management
- Reports with date range selection
- Expense tracking
- Staff management
- System settings

#### Cashier (POS)
- Full-featured POS interface
- Product search and category filtering
- Shopping cart with quantity controls
- Customer selection
- Multiple payment methods
- Receipt generation

#### Wholesale Customer
- Product browsing at wholesale prices
- Availability checking
- Order request system

### Styling (Tailwind CSS)
- Global styles in `src/app/globals.css`
- Component-level utility classes
- Color scheme: Blue primary, Green success, Red danger, Orange warning
- Responsive grid layouts
- Custom animations for fade-in and slide-up effects

## Technologies Included

### Frontend
- Next.js 14 with App Router
- React 18
- TypeScript 5
- Tailwind CSS 3
- Lucide React for icons

### Backend
- Node.js runtime
- Prisma ORM 5
- PostgreSQL database
- NextAuth.js v5

### Utilities
- pdfkit - PDF generation
- nodemailer - Email sending
- node-cron - Task scheduling
- zod - Input validation
- bcryptjs - Password hashing
- date-fns - Date manipulation

## Environment Variables

Configured in `.env.local`:
- DATABASE_URL - PostgreSQL connection
- NEXTAUTH_URL - Authentication URL
- NEXTAUTH_SECRET - Session secret
- EMAIL_* - SMTP configuration
- STRIPE_* - Payment gateway (optional)

## Running the System

1. **Setup**: `npm install && npm run db:push && npm run db:seed`
2. **Development**: `npm run dev`
3. **Production**: `npm run build && npm start`

## Seed Data

The seed script creates:
- 1 Owner (owner@store.com)
- 1 Manager (manager@store.com)
- 2 Cashiers (cashier1@, cashier2@store.com)
- 1 Main Branch
- 5 Product Categories
- 3 Suppliers
- 20 Products across categories
- 5 Retail + 2 Wholesale Customers
- 10 Sample sales transactions
- 8 System settings

## Security Features

- Role-based access control (RBAC) at page and API level
- Password hashing with bcryptjs
- Secure session management with NextAuth
- Protected API routes requiring authentication
- Input validation with zod
- Audit logging for important operations
- Environment variable protection

## Performance Optimizations

- Database indexes on frequently queried fields
- Pagination on all list endpoints
- Client-side search and filtering
- Selective field queries in API responses
- CSS purging with Tailwind
- Image optimization ready

## Deployment Ready

- Environment configuration via .env.local
- Production build optimization
- Database migration support
- Scheduled task support
- Email integration
- Error handling throughout
