# RetailPro - Complete Retail Management System

A full-stack retail management system built with Next.js 14, TypeScript, Tailwind CSS, Prisma, and PostgreSQL. Features a comprehensive POS interface, inventory management, sales tracking, and advanced reporting capabilities.

## Features

### Core Features
- **Point of Sale (POS)**: Full-featured POS interface for cashiers with product search, category filtering, and cart management
- **Inventory Management**: Track product stock levels with low-stock alerts
- **Sales Management**: Complete sales history with filtering and detailed transaction views
- **Customer Management**: Manage retail and wholesale customers with credit limits
- **Expense Tracking**: Log and categorize business expenses
- **Reports & Analytics**: End-of-day reports with PDF generation and email delivery
- **Role-Based Access**: Owner, Manager, Cashier, and Wholesale Customer roles
- **Automated EOD Reports**: Scheduled end-of-day email reports with PDF attachments

### Technical Features
- Next.js 14 App Router with TypeScript
- NextAuth.js v5 for secure authentication
- Prisma ORM with PostgreSQL
- Tailwind CSS with custom styling
- PDF generation with pdfkit
- Email notifications with Nodemailer
- Automated task scheduling with node-cron
- Comprehensive type safety

## Prerequisites

- Node.js 18+
- PostgreSQL 12+
- npm or yarn package manager

## Installation

### 1. Clone and Setup

```bash
cd retail-system
npm install
```

### 2. Database Setup

Create a PostgreSQL database:

```sql
CREATE DATABASE retaildb;
```

### 3. Environment Variables

Copy `.env.example` to `.env.local` and configure:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your configuration:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/retaildb"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-a-random-32-char-string"
EMAIL_HOST="smtp.gmail.com"
EMAIL_PORT=587
EMAIL_USER="your-email@gmail.com"
EMAIL_PASS="your-app-password"
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_PUBLIC_KEY="pk_test_..."
```

### 4. Database Migration and Seeding

```bash
# Setup the database schema
npm run db:push

# Seed with sample data
npm run db:seed
```

This creates:
- 1 Owner user (owner@store.com)
- 1 Manager user (manager@store.com)
- 2 Cashier users (cashier1@store.com, cashier2@store.com)
- 1 Branch with complete setup
- 20 sample products across 5 categories
- 7 sample customers (5 retail, 2 wholesale)
- 10 sample sales transactions

## Running the Application

### Development Mode

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

```bash
npm run build
npm start
```

## Default Login Credentials

### Owner
- Email: `owner@store.com`
- Password: `owner123`
- Access: Full system access, settings configuration

### Manager
- Email: `manager@store.com`
- Password: `manager123`
- Access: Dashboard, inventory, sales, reports, expenses

### Cashier
- Email: `cashier1@store.com` or `cashier2@store.com`
- Password: `cashier123`
- Access: POS interface only

### Wholesale Customer
- Can browse products at wholesale prices

## Project Structure

```
retail-system/
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── seed.ts                # Seed data
├── src/
│   ├── app/
│   │   ├── (auth)/            # Authentication pages
│   │   ├── (dashboard)/       # Dashboard pages (Owner/Manager)
│   │   ├── (pos)/             # POS interface (Cashier)
│   │   ├── (wholesale)/       # Wholesale portal
│   │   ├── api/               # API routes
│   │   ├── layout.tsx         # Root layout
│   │   ├── page.tsx           # Home/redirect page
│   │   └── globals.css        # Global styles
│   ├── components/
│   │   └── shared/            # Shared components (Navbar, Sidebar)
│   ├── lib/
│   │   ├── auth.ts            # NextAuth configuration
│   │   ├── prisma.ts          # Prisma client
│   │   ├── email.ts           # Email utilities
│   │   ├── eod.ts             # End-of-day report generation
│   │   └── cron.ts            # Scheduled tasks
│   └── types/
│       └── index.ts           # TypeScript types
├── .env.example               # Environment variables template
├── next.config.ts             # Next.js configuration
├── tailwind.config.ts         # Tailwind CSS configuration
├── tsconfig.json              # TypeScript configuration
└── package.json               # Dependencies
```

## API Routes

### Authentication
- `POST /api/auth/[...nextauth]` - NextAuth handlers

### Products
- `GET /api/products` - List products with filtering
- `POST /api/products` - Create product
- `GET /api/products/[id]` - Get product details
- `PUT /api/products/[id]` - Update product
- `DELETE /api/products/[id]` - Soft delete product

### Sales
- `GET /api/sales` - List sales with pagination
- `POST /api/sales` - Create new sale
- `GET /api/sales/[id]` - Get sale details
- `PUT /api/sales/[id]` - Update sale status (void/hold)

### Customers
- `GET /api/customers` - List customers with filtering
- `POST /api/customers` - Create customer

### Inventory
- `GET /api/inventory` - Get inventory levels
- `PATCH /api/inventory` - Adjust stock quantities

### Expenses
- `GET /api/expenses` - List expenses
- `POST /api/expenses` - Create expense

### Reports
- `GET /api/reports/eod` - Get EOD report
- `POST /api/reports/eod` - Send EOD email or export PDF

### Dashboard
- `GET /api/dashboard/stats` - Get dashboard statistics

## Database Schema

### Key Models
- **User**: System users with roles (OWNER, MANAGER, CASHIER, WHOLESALE_CUSTOMER)
- **Branch**: Business locations
- **Product**: Inventory items with retail/wholesale prices
- **Category**: Product categories with nesting support
- **Supplier**: Product suppliers
- **Customer**: Retail and wholesale customers
- **Sale**: Sales transactions with items
- **SaleItem**: Individual items in sales
- **Expense**: Business expenses
- **DiscountCode**: Promotional discount codes
- **AuditLog**: System activity logging
- **Setting**: Application configuration

## Features by Role

### Owner
- Full dashboard access
- View all reports and analytics
- Manage system settings
- Configure EOD scheduling
- View all users and transactions
- Expense management

### Manager
- Dashboard overview
- View and manage sales
- Inventory management with stock adjustments
- Customer management
- Generate reports
- View expenses

### Cashier
- Access POS interface only
- Process customer sales
- Search and browse products
- Cart management with discounts
- Multiple payment methods (Cash, Card, Bank Transfer, Mobile Money)
- Receipt generation

### Wholesale Customer
- Browse products at wholesale prices
- View pricing and availability
- Request quotes
- Track orders (future feature)

## Configuration

### Email Setup (Gmail)
1. Generate an App Password in Google Account settings
2. Use the app password in `EMAIL_PASS` environment variable

### EOD Scheduling
Configure in Settings:
- Set EOD time (format: HH:mm)
- Set owner email for reports
- Reports are automatically sent at scheduled time

### Tax Configuration
- Default tax rate: 7.5%
- Configurable in Settings page

## Scheduled Tasks

### Automatic EOD Reports
- Runs at configured time daily
- Generates report with:
  - Sales summary
  - Payment method breakdown
  - Top 5 products
  - Low stock alerts
  - Day-over-day comparison
- Sends email with PDF attachment

### Low Stock Check
- Runs daily at 8:00 AM
- Alerts on products below threshold

## Performance Optimization

- Database indexes on frequently queried fields
- Pagination on all list endpoints
- Client-side search and filtering
- Optimized API queries with selective field selection
- Image optimization with Next.js Image component
- CSS optimization with Tailwind CSS purging

## Security Features

- NextAuth.js v5 for secure session management
- Role-based access control (RBAC)
- Password hashing with bcryptjs
- Protected API routes with session validation
- Audit logging for critical operations
- Environment variable protection

## Browser Support

- Chrome/Chromium (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint

# Push schema to database
npm run db:push

# Open Prisma Studio
npm run db:studio

# Run database migrations
npm run db:migrate

# Run cron jobs (for testing)
npm run cron:start
```

## Troubleshooting

### Database Connection Issues
- Ensure PostgreSQL is running
- Check DATABASE_URL is correct
- Verify database exists and user has permissions

### Email Not Sending
- Verify email credentials in `.env.local`
- For Gmail, use App Password (not account password)
- Check firewall/network connectivity to SMTP server
- Enable "Less secure app access" if needed

### Port Already in Use
```bash
# Use different port
PORT=3001 npm run dev
```

### Database Migration Issues
```bash
# Reset database completely (WARNING: deletes all data)
npm run db:push -- --force-reset
npm run db:seed
```

## Future Enhancements

- Wholesale order management system
- Advanced inventory analytics
- Multi-branch management dashboard
- Customer loyalty programs
- Payment gateway integration (Stripe, Flutterwave)
- Mobile app (React Native)
- Real-time inventory sync
- Advanced reporting with charts
- SMS notifications
- Barcode scanning
- User permissions customization

## Contributing

1. Create a feature branch: `git checkout -b feature/amazing-feature`
2. Commit changes: `git commit -m 'Add amazing feature'`
3. Push to branch: `git push origin feature/amazing-feature`
4. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For issues, questions, or suggestions, please open an issue on the project repository.

## Changelog

### Version 1.0.0 (Initial Release)
- Complete POS interface
- Inventory management system
- Sales tracking and reporting
- Customer management
- EOD report generation
- Role-based access control
- Database seeding with sample data
- Responsive UI with Tailwind CSS
