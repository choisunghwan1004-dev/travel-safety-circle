import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const journeys = sqliteTable('journeys', { owner: text('owner').primaryKey(), data: text('data').notNull(), revision: integer('revision').notNull().default(0) });
export const deliveries=sqliteTable('deliveries',{id:text('id').primaryKey(),owner:text('owner').notNull(),channel:text('channel').notNull(),recipient:text('recipient').notNull(),status:text('status').notNull(),providerId:text('provider_id'),createdAt:text('created_at').notNull(),error:text('error')});

export const aiUsage=sqliteTable("ai_usage",{owner:text("owner").primaryKey(),day:text("day").notNull(),count:integer("count").notNull(),lastAt:integer("last_at").notNull()});

export const lookupCache=sqliteTable("lookup_cache",{id:text("id").primaryKey(),data:text("data").notNull(),expiresAt:integer("expires_at").notNull()});

export const userAiKeys=sqliteTable("user_ai_keys",{owner:text("owner").primaryKey(),ciphertext:text("ciphertext").notNull(),iv:text("iv").notNull(),lastFour:text("last_four").notNull(),updatedAt:text("updated_at").notNull()});

export const notificationSettings=sqliteTable('notification_settings',{owner:text('owner').primaryKey(),ciphertext:text('ciphertext').notNull(),iv:text('iv').notNull(),updatedAt:text('updated_at').notNull()});
export const alertMonitors=sqliteTable('alert_monitors',{owner:text('owner').primaryKey(),lastAt:text('last_at').notNull(),result:text('result').notNull()});
