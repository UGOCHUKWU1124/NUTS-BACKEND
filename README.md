# Nuts Backend

Multi-vendor e-commerce platform. 

### Currently Implemented

#### Core Framework
| Technology |
| [NestJS]
| [TypeScript]
| [Node.js]
| [RxJS]

#### Database & ORM
| Technology | 
| [PostgreSQL]
| [Prisma]
| [@prisma/adapter-pg]

#### Caching, Queues & Streams
| Technology |
| [Redis]
| [ioredis]
| [BullMQ]


#### Authentication & Security
| Technology 
| [JWT] Access & refresh token auth |
| [Passport] JWT strategy for passport |
| [bcrypt]  Password hashing |
| [helmet] HTTP security headers |
| [cookie-parser] Cookie parsing for httpOnly auth cookies |
| [@nestjs/throttler] Rate limiting (100 req/60s default) |
| Custom OTP guard | — | One-time password verification guard |
| Custom JWT guard | — | Global JWT auth guard |

#### API & Documentation
| Technology 
| [Swagger / OpenAPI] API documentation at `/api/docs` |
| [class-validator] DTO validation |
| [class-transformer] Payload transformation |
| [compression] | Gzip/brotli response compression |

#### Payments
| Technology
| [Paystack] Payment gateway — initialize, verify, webhooks, refunds |
| [nanoid] Idempotency key generation |


#### Email & Notifications
| Technology
| [nodemailer] SMTP email sending |
| SMTP configuration Host, port, user, pass, secure |


#### Input Sanitization
| Technology 
| [sanitize-html] HTML sanitization pipe |
| Custom NormalizeInput pipe | Input normalization |
| Custom SanitizeHtml pipe | XSS prevention |

#### ID Generation
| Technology 
| [uuid] UUID generation |
| [nanoid] Compact unique IDs |

#### Testing
| Technology 
| [Jest] Unit testing framework |
| [Supertest] HTTP integration testing |
| [ts-jest] TypeScript test compilation |

#### Tooling & Linting
| Technology
| [ESLint] Code linting (flat config, typescript-eslint) |
| [Prettier] Code formatting |
| [TypeScript ESLint] Type-aware lint rules |

#### DevOps / CI
| Technology 
| [GitHub Actions] CI — lint, build, unit test on PR to `development`/`main` |

#### Business Modules
| Module 
| AuthModule | Customer register, login, logout, refresh, password reset, OTP |
| UsersModule | Profile view/update, password change, deactivate/delete |
| CartModule | Add/update/remove items, clear cart |
| CategoriesModule | Nested category hierarchy, slug resolution |
| ProductsModule | Catalog browse, search, filter, stock |
| ProductVariantsModule | Sizes, colors, stock per variant |
| OrdersModule | Checkout, view orders, cancel, update shipping |
| PaymentsModule | Paystack init, verify, webhooks, refunds |
| CreatorsModule | Creator register/login/profile, account management |
| WishlistModule | Add/remove products & variants |
| ReviewsModule | Create, view by product, delete own reviews |
| WalletModule | User wallet + creator wallet — balance, transactions |
| ReferralModule | Referral codes, rewards, discount tracking |
| ShippingAddressesModule | Saved addresses, set default, delete |
| HealthModule | Liveness probe, database connectivity |

#### Creator Modules
| Module 
| Creators Auth | Register, login, logout, refresh, OTP, password reset |
| Creator Account | View/update profile, deactivate, reactivate, delete account |
| Creator Products | CRUD own products, stock adjustments, activate/deactivate |
| Creator Product Variants | CRUD own variants, stock adjustments, activate/deactivate |
| Creator Orders | View orders containing own products, update fulfillment status |
| Creator Wallet | View balance, transaction history, manage payouts |
| Creator Analytics | Revenue, top products, performance metrics |
| Creator Discount Codes | Create, list, deactivate, delete own discount codes |
| Public Store | View individual creator storefronts |

Admin Modules
| Module 
| AdminAuthModule | Setup, login, logout, refresh |
| AdminUsersModule | List, view, deactivate/reactivate, delete users |
| AdminProductModule | CRUD, stock, activate/deactivate any product |
| AdminProductVariantsModule | CRUD, stock, activate/deactivate any variant |
| AdminOrdersModule | List/filter all orders, update any order status |
| AdminCategoryModule | Create, update, activate/deactivate, delete |
| AdminCreatorsModule | List, approve, verify, suspend, delete |
| AdminCacheModule | Cache management |
| AdminPromotionModule | Platform-wide discount codes |
| AdminAnalyticsModule | Summary, revenue, top products/creators, funnel, audit |
| AdminSearchModule | Global search — users, creators, products, orders, codes |
| AuditLogModule | Activity audit logging |
| UploadModule | File upload abstraction (local storage strategy, extensible) |

## Infrastructure & Support
| Module 
| QueueModule | Job producers & processors (analytics, cart, email, inventory) |
| NotificationModule | Email events, listeners, templates |
| TrackingModule | Product view tracking, search query tracking |
| AnalyticsModule | Admin + creator analytics, snapshots, reports, cron summaries |
| CronModule | Scheduled tasks — abandoned cart, creator summary, low stock |
| SecurityModule | Custom guards, middleware, services, distributed throttling |
| SearchModule | Storefront search, autocomplete, admin/creator search controllers |
| PromotionsModule | Discount code service (customer/creator scoped) |


### To Be Implemented / next phase 

Sentry Error tracking & performance monitoring (PII-scrubbed) |
Prometheus Metrics — HTTP request duration, queue processing duration |
Grafana Dashboards (pre-provisioned) |
Payments | **Payout Splits** | Implement Paystack Split — auto-split revenue between creator and company at transaction time |
Payments | **Paystack Dedicated Virtual Account** | Use Paystack's dedicated virtual account feature for seamless payment collection per creator |
Wallet | **Improved Wallet System** | Enhance wallet — settlement scheduling, withdrawal requests, payout history, admin payout management |
Containerization | **Docker** | Dockerfile for the app + full `docker-compose.yml` bundling app, PostgreSQL, Redis, Prometheus, and Grafana |
Blue-green / canary deploys | Zero-downtime deployment strategy |
Deployment pipeline | GitHub Actions → build → deploy |
Deployment | **AWS Deployment** | Deploy to AWS (ECS/EKS/EC2) with proper networking, security groups, and auto-scaling |
Reverse Proxy | **Nginx** | Reverse proxy, SSL termination, load balancing, and static file serving |
CI/CD | **Proper CI/CD Pipeline** | GitHub Actions → build → test → deploy to AWS (staging → production) |
Environment | **Env & Secrets Management** | Centralized env management across environments (dev/staging/prod) — AWS Secrets Manager |
Search | **Algolia** | Replace Prisma `contains` search with Algolia for full-text search, faceted filtering, and typo-tolerant autocomplete |
Email | **Brevo (Sendinblue)** | Swap current SMTP/nodemailer for Brevo — transactional emails, templates, delivery tracking |
File Uploads | **Cloud Storage Strategy** | Replace local storage with AWS S3— image upload, optimization, CDN delivery |
Testing | **JMeter** | Load and stress testing — identify bottlenecks, establish performance baselines |
Notifications | **Better Notification System** | In-app notifications (read/unread, paginated history), email digests, push notifications (FCM), SMS fallback |
Testing | **E2E Test Expansion** | Comprehensive integration test suite covering all major flows |
Monitoring | **Alerting & Uptime** | Prometheus AlertManager rules, uptime monitoring (Better Uptime / Checkly) |
Reliability | **Database Backups** | Automated PostgreSQL backup & restore strategy |
Socket.IO / NestJS WebSockets | Real-time order status updates, notifications |
Live order tracking | Real-time fulfillment progress |
Performance benchmarks | Baseline performance across endpoints |
API versioning strategy | Formal versioned routes (v2, v3) |
