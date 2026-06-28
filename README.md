Nuts Backend

A production-ready multi-vendor e-commerce backend built with NestJS.

Currently Implemented

Core Framework

* NestJS
* TypeScript
* Node.js
* RxJS

Database & ORM

* PostgreSQL
* Prisma
* @prisma/adapter-pg

Caching, Queues & Streams

* Redis
* ioredis
* BullMQ

Authentication & Security

* JWT — Access & Refresh Token authentication
* Passport — JWT strategy
* bcrypt — Password hashing
* Helmet — HTTP security headers
* cookie-parser — HTTP-only cookie parsing
* @nestjs/throttler — Rate limiting (100 requests / 60 seconds)
* Custom OTP Guard — One-time password verification
* Custom JWT Guard — Global JWT authentication

API & Documentation

* Swagger / OpenAPI — API documentation available at /api/docs
* class-validator — DTO validation
* class-transformer — Request payload transformation
* compression — Gzip/Brotli response compression

Payments

* Paystack — Payment initialization, verification, webhooks, refunds
* nanoid — Idempotency key generation

Email & Notifications

* Nodemailer — SMTP email delivery
* SMTP Configuration — Host, port, username, password, secure connection

Input Sanitization

* sanitize-html — HTML sanitization
* Custom NormalizeInput Pipe — Input normalization
* Custom SanitizeHtml Pipe — XSS prevention

ID Generation

* uuid — UUID generation
* nanoid — Compact unique ID generation

Testing

* Jest — Unit testing
* Supertest — HTTP integration testing
* ts-jest — TypeScript test compilation

Tooling & Linting

* ESLint — Code linting (Flat Config + TypeScript ESLint)
* Prettier — Code formatting
* TypeScript ESLint — Type-aware linting rules

DevOps / CI

* GitHub Actions — Continuous Integration (lint, build, unit tests on pull requests to development and main)

Business Modules

Customer Modules

* AuthModule — Customer registration, login, logout, refresh tokens, password reset, OTP verification
* UsersModule — Profile management, password change, deactivate/delete account
* CartModule — Add, update, remove items, clear cart
* CategoriesModule — Nested category hierarchy and slug resolution
* ProductsModule — Product catalog, search, filtering, stock management
* ProductVariantsModule — Sizes, colors, variant stock management
* OrdersModule — Checkout, order history, cancellation, shipping updates
* PaymentsModule — Paystack integration, verification, webhooks, refunds
* CreatorsModule — Creator registration, authentication, account management
* WishlistModule — Wishlist management for products and variants
* ReviewsModule — Product reviews and ratings
* WalletModule — Customer and creator wallet management
* ReferralModule — Referral codes, rewards, discount tracking
* ShippingAddressesModule — Saved addresses, default address management
* HealthModule — Liveness probe and database connectivity checks

Creator Modules

* Creators Auth — Register, login, logout, refresh tokens, OTP verification, password reset
* Creator Account — Profile management, deactivate/reactivate, delete account
* Creator Products — CRUD operations, stock management, activate/deactivate products
* Creator Product Variants — CRUD operations, stock management, activate/deactivate variants
* Creator Orders — View creator orders, update fulfillment status
* Creator Wallet — Wallet balance, transactions, payout management
* Creator Analytics — Revenue analytics, top-selling products, performance metrics
* Creator Discount Codes — Create, manage, deactivate discount codes
* Public Store — Individual creator storefronts

Admin Modules

* AdminAuthModule — Setup, login, logout, refresh authentication
* AdminUsersModule — Manage users, deactivate/reactivate, delete accounts
* AdminProductModule — Full product management
* AdminProductVariantsModule — Full product variant management
* AdminOrdersModule — View and manage all orders
* AdminCategoryModule — Category management
* AdminCreatorsModule — Approve, verify, suspend, delete creators
* AdminCacheModule — Cache management
* AdminPromotionModule — Platform-wide promotions and discount codes
* AdminAnalyticsModule — Revenue analytics, top products, creators, funnel metrics, audit reports
* AdminSearchModule — Global search across users, creators, products, orders, promotions
* AuditLogModule — Activity audit logging
* UploadModule — File upload abstraction with extensible storage strategy

Infrastructure & Support

* QueueModule — Job producers and processors (analytics, carts, emails, inventory)
* NotificationModule — Email events, listeners, templates
* TrackingModule — Product views and search query tracking
* AnalyticsModule — Admin and creator analytics, snapshots, scheduled reports
* CronModule — Scheduled jobs (abandoned carts, creator summaries, low stock alerts)
* SecurityModule — Custom guards, middleware, distributed throttling
* SearchModule — Storefront search, autocomplete, admin and creator search
* PromotionsModule — Customer and creator discount code services

To Be Implemented / Next Phase

* Sentry — Error tracking and performance monitoring (PII scrubbed)
* Prometheus — Metrics collection (HTTP request duration, queue processing duration)
* Grafana — Pre-provisioned monitoring dashboards
* Paystack Split — Automatic revenue splitting between creators and the platform
* Paystack Dedicated Virtual Accounts — Seamless payment collection for creators
* Enhanced Wallet System — Settlement scheduling, withdrawal requests, payout history, admin payout management
* Docker — Dockerfile and complete docker-compose.yml with PostgreSQL, Redis, Prometheus, and Grafana
* Blue-Green / Canary Deployments — Zero-downtime deployment strategy
* GitHub Actions Deployment Pipeline — Build and automated deployments
* AWS Deployment — ECS/EKS/EC2 deployment with networking, security groups, and auto scaling
* Nginx — Reverse proxy, SSL termination, load balancing, static asset serving
* Complete CI/CD Pipeline — Staging → Production deployments
* Environment & Secrets Management — AWS Secrets Manager for centralized configuration
* Algolia — Full-text search, faceted filtering, typo-tolerant autocomplete
* Brevo — Transactional email service with templates and delivery tracking
* AWS S3 Storage — Image uploads, optimization, CDN delivery
* JMeter — Load and stress testing
* Advanced Notification System — In-app notifications, push notifications (FCM), SMS fallback, email digests
* Expanded End-to-End Test Suite
* Alerting & Uptime Monitoring — Prometheus AlertManager, Better Uptime or Checkly
* Automated PostgreSQL Backup & Restore Strategy
* Socket.IO / NestJS WebSockets — Real-time order status updates and notifications
* Live Order Tracking
* Performance Benchmarking
* API Versioning Strategy (v2, v3, …)
