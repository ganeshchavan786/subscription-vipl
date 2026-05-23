# SubTrack Pro — Subscription Management System

A full-stack subscription management app built with React + Node.js + SQLite.

## Features
- Customer, Product & Subscription management
- User-wise subscription tracking (different start/end dates per user)
- AMC / Non-user based subscriptions
- Excel Import (Customers, Products, Subscriptions)
- Dashboard with MRR, expiry alerts
- Light theme (Stripe-style UI)

## Project Structure
```
app3/
├── backend/          # Node.js + Express + SQLite
│   └── server.js
├── frontend/         # React app
│   └── src/
├── dummy_customers.xlsx
├── dummy_products.xlsx
└── dummy_subscriptions.xlsx
```

## Setup & Run

### Backend
```bash
cd backend
npm install
node server.js
# Runs on http://localhost:3251
```

### Frontend
```bash
cd frontend
npm install
npm start
# Runs on http://localhost:3252
```

## Excel Import Format

### Customers: `dummy_customers.xlsx`
| name | email | phone | notes |

### Products: `dummy_products.xlsx`
| name | price | quantity | description |

### Subscriptions: `dummy_subscriptions.xlsx`
- **Sheet 1 "Subscriptions"**: ref, customer_name, product_name, billing_period, price, payment_status, auto_renewal, is_user_based, start_date, notes
- **Sheet 2 "Subscription_Users"**: subscription_ref, user_name, start_date, end_date, price, description

> ⚠️ Import Customers & Products first, then import Subscriptions.
