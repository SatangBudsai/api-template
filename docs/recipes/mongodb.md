# Optional MongoDB module

Add MongoDB only for a bounded feature whose document model is a better fit than PostgreSQL.

1. Create `src/modules/<feature>/repositories/<feature>.repository.ts` as the application-facing interface.
2. Put the Mongo implementation under `src/infrastructure/mongodb` or inside that feature's infrastructure folder.
3. Register it behind a Nest injection token in the feature module.
4. Keep users, roles, refresh sessions, and audit authority in PostgreSQL unless the whole application intentionally migrates identity storage.
5. Do not attempt a cross-database transaction. Use an outbox/idempotent consumer when a workflow spans PostgreSQL and MongoDB.

This keeps Mongo optional and prevents Prisma-specific types from leaking into feature controllers.
