import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'src/modules/infrastructure/prisma/schema.prisma',
  migrations: {
    path: 'src/modules/infrastructure/prisma/migrations',
  },
  datasource: {
    url: process.env['POSTGRESQL_URL'],
  },
});

//npx prisma db pull
//npx prisma generate
//npx prisma migrate dev --name sync-schema
