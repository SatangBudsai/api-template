# Persistence choice

Prisma is the default because most projects using this template target PostgreSQL and benefit from one readable relational schema, committed SQL migrations, generated TypeScript types, relation loading, and transaction support. It also has a lower onboarding cost for teams reusing the template.

Drizzle is a good alternative when SQL-level control, a smaller abstraction, or highly tuned queries are the primary concern. That trade-off is not the common baseline here, so the template avoids making every project choose and assemble an ORM again.

MongoDB is not configured beside PostgreSQL by default. Running two persistence approaches increases deployment, transaction, and ownership complexity for projects that do not need it. If a feature genuinely needs MongoDB, add it as an isolated Nest module with repository interfaces as described in [the MongoDB recipe](recipes/mongodb.md).
