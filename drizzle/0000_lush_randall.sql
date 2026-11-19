CREATE TABLE "price_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"shop_id" integer NOT NULL,
	"product_id" text NOT NULL,
	"variant_id" text NOT NULL,
	"market" text DEFAULT 'default' NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"price_minor" integer NOT NULL,
	"compare_at_minor" integer,
	"captured_at" timestamp DEFAULT now() NOT NULL,
	"source" text DEFAULT 'webhook' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"shop" text NOT NULL,
	"state" text NOT NULL,
	"isOnline" boolean DEFAULT false NOT NULL,
	"scope" text,
	"expires" timestamp,
	"accessToken" text NOT NULL,
	"userId" bigint,
	"firstName" text,
	"lastName" text,
	"email" text,
	"accountOwner" boolean,
	"locale" text,
	"collaborator" boolean,
	"emailVerified" boolean,
	"refreshToken" text,
	"refreshTokenExpires" timestamp
);
--> statement-breakpoint
CREATE TABLE "shops" (
	"id" serial PRIMARY KEY NOT NULL,
	"domain" text NOT NULL,
	"plan" text DEFAULT 'free' NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb,
	"product_limit" integer DEFAULT 25 NOT NULL,
	"tracked_count" integer DEFAULT 0 NOT NULL,
	"installed_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "shops_domain_unique" UNIQUE("domain")
);
--> statement-breakpoint
ALTER TABLE "price_snapshots" ADD CONSTRAINT "price_snapshots_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "price_snapshots_lookup_idx" ON "price_snapshots" USING btree ("shop_id","product_id","variant_id","market","captured_at");--> statement-breakpoint
CREATE INDEX "price_snapshots_shop_idx" ON "price_snapshots" USING btree ("shop_id","captured_at");