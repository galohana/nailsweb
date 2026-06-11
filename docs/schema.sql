-- Schema dump of eyebrowsweb-app Supabase project
-- Project ref: expypgqdrjbthgxfddog
-- Generated: 2026-05-23T22:36:58.168Z

-- ═══════════════════════════════════════════════════════════
-- TABLES
-- ═══════════════════════════════════════════════════════════
CREATE TABLE public.appointments (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    phone text NOT NULL,
    user_name text NOT NULL,
    service_id uuid,
    service_name text NOT NULL,
    service_duration integer,
    date date NOT NULL,
    "time" time without time zone NOT NULL,
    price numeric(10,2) NOT NULL DEFAULT 0,
    status text NOT NULL DEFAULT 'confirmed'::text,
    staff_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    reminder_sent boolean DEFAULT false,
    addons jsonb DEFAULT '[]'::jsonb
);

CREATE TABLE public.clients (
    phone text NOT NULL,
    name text NOT NULL,
    no_show_count integer DEFAULT 0,
    is_blocked boolean DEFAULT false,
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.gallery (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    url text,
    "order" integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    image_url text
);

CREATE TABLE public.orders (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    client_name text NOT NULL,
    client_phone text NOT NULL,
    items jsonb NOT NULL DEFAULT '[]'::jsonb,
    total numeric NOT NULL DEFAULT 0,
    status text NOT NULL DEFAULT 'pending'::text,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.products (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    name text NOT NULL,
    price numeric(10,2) NOT NULL DEFAULT 0,
    sale_price numeric(10,2),
    image_url text,
    visible boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.reviews (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    name text NOT NULL,
    rating integer NOT NULL,
    text text NOT NULL,
    approved boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.services (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    name text NOT NULL,
    duration integer NOT NULL DEFAULT 30,
    price numeric(10,2) NOT NULL DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    image_url text DEFAULT ''::text,
    parent_id uuid DEFAULT NULL
);

CREATE TABLE public.settings (
    key text NOT NULL,
    value jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.staff (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    name text NOT NULL,
    phone text,
    created_at timestamp with time zone DEFAULT now(),
    image_url text DEFAULT ''::text
);

CREATE TABLE public.waitlist (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    date date NOT NULL,
    phone text NOT NULL,
    user_name text NOT NULL,
    service_id uuid,
    created_at timestamp with time zone DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════
-- CONSTRAINTS — סדר: PRIMARY KEY → FOREIGN KEY → CHECK
-- ═══════════════════════════════════════════════════════════

-- PRIMARY KEY
ALTER TABLE public.appointments ADD CONSTRAINT appointments_pkey PRIMARY KEY (id);
ALTER TABLE public.clients      ADD CONSTRAINT clients_pkey      PRIMARY KEY (phone);
ALTER TABLE public.gallery      ADD CONSTRAINT gallery_pkey      PRIMARY KEY (id);
ALTER TABLE public.orders       ADD CONSTRAINT orders_pkey       PRIMARY KEY (id);
ALTER TABLE public.products     ADD CONSTRAINT products_pkey     PRIMARY KEY (id);
ALTER TABLE public.reviews      ADD CONSTRAINT reviews_pkey      PRIMARY KEY (id);
ALTER TABLE public.services     ADD CONSTRAINT services_pkey     PRIMARY KEY (id);
ALTER TABLE public.settings     ADD CONSTRAINT settings_pkey     PRIMARY KEY (key);
ALTER TABLE public.staff        ADD CONSTRAINT staff_pkey        PRIMARY KEY (id);
ALTER TABLE public.waitlist     ADD CONSTRAINT waitlist_pkey     PRIMARY KEY (id);

-- FOREIGN KEY
ALTER TABLE public.appointments ADD CONSTRAINT appointments_service_id_fkey FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL;
ALTER TABLE public.appointments ADD CONSTRAINT appointments_staff_id_fkey   FOREIGN KEY (staff_id)   REFERENCES staff(id)     ON DELETE SET NULL;
ALTER TABLE public.services     ADD CONSTRAINT services_parent_id_fkey      FOREIGN KEY (parent_id)  REFERENCES services(id)  ON DELETE CASCADE;

-- CHECK
ALTER TABLE public.appointments ADD CONSTRAINT appointments_status_check CHECK ((status = ANY (ARRAY['confirmed'::text, 'cancelled'::text, 'pending'::text])));
ALTER TABLE public.reviews      ADD CONSTRAINT reviews_rating_check       CHECK (((rating >= 1) AND (rating <= 5)));

-- ═══════════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════════
CREATE INDEX idx_appointments_date   ON public.appointments USING btree (date);
CREATE INDEX idx_appointments_phone  ON public.appointments USING btree (phone);
CREATE INDEX idx_appointments_status ON public.appointments USING btree (status);

-- Prevent exact-slot double-booking among CONFIRMED appointments only.
-- COALESCE maps NULL staff_id (single-staff businesses) to a fixed sentinel so
-- they are protected too (Postgres treats NULLs as distinct in unique indexes).
CREATE UNIQUE INDEX IF NOT EXISTS appointments_no_double_booking
  ON public.appointments (date, "time", COALESCE(staff_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE status = 'confirmed';
