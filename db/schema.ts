import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const journeys = sqliteTable('journeys', { owner: text('owner').primaryKey(), data: text('data').notNull(), revision: integer('revision').notNull().default(0) });
export const deliveries=sqliteTable('deliveries',{id:text('id').primaryKey(),owner:text('owner').notNull(),channel:text('channel').notNull(),recipient:text('recipient').notNull(),status:text('status').notNull(),providerId:text('provider_id'),createdAt:text('created_at').notNull(),error:text('error')});

export const aiUsage=sqliteTable("ai_usage",{owner:text("owner").primaryKey(),day:text("day").notNull(),count:integer("count").notNull(),lastAt:integer("last_at").notNull()});

export const lookupCache=sqliteTable("lookup_cache",{id:text("id").primaryKey(),data:text("data").notNull(),expiresAt:integer("expires_at").notNull()});
