# Quick Start Guide - RetailPro

## Installation (5 minutes)

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Database
Create PostgreSQL database:
```sql
CREATE DATABASE retaildb;
```

### 3. Setup Environment
```bash
cp .env.example .env.local
```

Edit `.env.local`:
```
DATABASE_URL="postgresql://user:password@localhost:5432/retaildb"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-a-random-string-min-32-chars"
EMAIL_HOST="smtp.gmail.com"
EMAIL_PORT=587
EMAIL_USER="your-email@gmail.com"
EMAIL_PASS="your-app-password"
```

### 4. Initialize Database
```bash
npm run db:push
npm run db:seed
```

### 5. Start Development Server
```bash
npm run dev
```

Visit: http://localhost:3000

## Demo Credentials

### Owner Account
- Email: owner@store.com
- Password: owner123
- Access: Full system including settings

### Manager Account
- Email: manager@store.com
- Password: manager123
- Access: Dashboard, inventory, sales, reports

### Cashier Account
- Email: cashier1@store.com
- Password: cashier123
- Access: POS interface only

## What's Included

✅ Complete POS system with cart management
✅ Inventory management with stock tracking
✅ Sales tracking with multiple payment methods
✅ Customer management (retail and wholesale)
✅ Automated end-of-day reports with PDF
✅ Email report delivery
✅ Scheduled daily tasks
✅ 20 sample products with pricing
✅ 7 sample customers
✅ 10 sample sales transactions
✅ Role-based access control
✅ Beautiful responsive UI with Tailwind CSS
✅ Full TypeScript type safety
✅ Production-ready code

## Key Features

### POS Interface
- Search products by name or SKU
- Category filtering
- Real-time cart management
- Customer selection (changes pricing for wholesale)
- Support for 4 payment methods
- Receipt generation
- Stock validation

### Dashboard
- Sales overview with stats
- Inventory with low-stock alerts
- Customer management with credit limits
- Expense tracking by category
- Comprehensive reporting

### Automated Reports
- Daily end-of-day summaries
- PDF generation and attachment
- Email delivery
- Payment method breakdown
- Top products analysis
- Low stock alerts
- Day-over-day comparison

## Database Models

- **11 Core Models** with proper relationships
- **Indexes** on all frequently queried fields
- **Foreign keys** with cascade delete
- **Audit logging** for tracking changes
- **Role-based permissions** in schema

## Project Structure

```
src/
├── app/              # Next.js pages and API routes
├── components/       # Reusable React components
├── lib/             # Utilities (auth, email, database)
├── types/           # TypeScript definitions
prisma/
├── schema.prisma    # Database schema
└── seed.ts          # Demo data
```

## Next Steps

1. **Explore Dashboard**: Login as manager@store.com
2. **Try POS**: Login as cashier1@store.com to test transactions
3. **Check Reports**: View end-of-day reports in dashboard
4. **Customize Settings**: Configure business info and tax rates
5. **Add Products**: Create new products through inventory
6. **Manage Customers**: Add retail and wholesale customers

## Troubleshooting

### Port Already in Use
```bash
PORT=3001 npm run dev
```

### Database Issues
```bash
npm run db:push -- --force-reset
npm run db:seed
```

### Email Not Working
- Verify SMTP credentials in .env.local
- For Gmail: Use App Password (Settings > Security)
- Check firewall allows SMTP port 587

### Clear Database
```bash
npx prisma db push --force-reset
npm run db:seed
```

## Commands Reference

```bash
npm run dev              # Start development server
npm run build            # Build for production
npm start                # Start production server
npm run db:push          # Apply schema changes
npm run db:seed          # Populate sample data
npm run db:studio        # Open Prisma Studio
npm run db:migrate       # Create migration
npm run lint             # Run ESLint
npm run cron:start       # Start scheduled tasks
```

## API Documentation

All endpoints require authentication (JWT token from NextAuth):

### Products
- `GET /api/products` - List with pagination
- `POST /api/products` - Create
- `GET /api/products/[id]` - Get one
- `PUT /api/products/[id]` - Update
- `DELETE /api/products/[id]` - Soft delete

### Sales
- `GET /api/sales` - List with filtering
- `POST /api/sales` - Create transaction
- `GET /api/sales/[id]` - Get details
- `PUT /api/sales/[id]` - Change status (void/hold)

### Customers
- `GET /api/customers` - List with filtering
- `POST /api/customers` - Create new

### Inventory
- `GET /api/inventory` - Get stock levels
- `PATCH /api/inventory` - Adjust quantities

### Expenses
- `GET /api/expenses` - List with filtering
- `POST /api/expenses` - Create

### Reports
- `GET /api/reports/eod` - Get report data
- `POST /api/reports/eod` - Send email or generate PDF

### Dashboard
- `GET /api/dashboard/stats` - Get overview numbers

## File Structure After Setup

```
retail-system/
├── node_modules/           # Dependencies (created after npm install)
├── .env.local              # Your configuration (create from .env.example)
├── .next/                  # Build output (created after npm run dev)
├── prisma/
│   ├── schema.prisma       # Database definition
│   └── seed.ts             # Demo data script
└── src/
    ├── app/                # Pages and API routes
    ├── components/         # React components
    ├── lib/               # Utilities
    └── types/             # TypeScript types
```

## Production Deployment

1. Build the application: `npm run build`
2. Set environment variables on your hosting
3. Set up PostgreSQL database
4. Run migrations: `npm run db:push`
5. Start server: `npm start`
6. Set up email service for reports
7. Configure scheduled tasks (cron)

## Support & Documentation

See `README.md` for complete documentation
See `PROJECT_STRUCTURE.md` for file organization details

## Performance Tips

- Database has indexes on all key fields
- Queries use pagination (20 items per page)
- API responses are optimized
- CSS is purged of unused styles
- Images ready for optimization

## Security Implemented

✅ Password hashing with bcryptjs
✅ Secure session management
✅ Role-based access control
✅ Protected API endpoints
✅ Input validation with zod
✅ Activity audit logging
✅ Environment variable protection

## What to Customize

1. **Business Info**: Settings page
2. **Tax Rate**: Settings page (currently 7.5%)
3. **EOD Email Time**: Settings page
4. **Color Scheme**: tailwind.config.ts
5. **Email Templates**: src/lib/email.ts
6. **Product Categories**: Add via Dashboard
7. **User Roles**: NextAuth in src/lib/auth.ts

## Sample Data Includes

- 5 Product Categories
- 20 Products with prices
- 3 Suppliers
- 7 Customers
- 10 Sales transactions
- Sample expenses

All completely customizable after setup!

---

**Ready to go!** Visit http://localhost:3000 after `npm run dev`
