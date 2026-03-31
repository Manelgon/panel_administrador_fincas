-- Migration: Vacation Management System
-- Created: 2026-02-12

-- 1. Tables

-- Vacation Requests
CREATE TABLE IF NOT EXISTS public.vacation_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('VACACIONES', 'RETRIBUIDO', 'NO_RETRIBUIDO')),
    date_from DATE NOT NULL,
    date_to DATE NOT NULL,
    days_count NUMERIC NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDIENTE' CHECK (status IN ('PENDIENTE', 'APROBADA', 'RECHAZADA', 'CANCELADA', 'MODIFICADA')),
    admin_id UUID REFERENCES auth.users(id),
    comment_user TEXT,
    comment_admin TEXT,
    replaces_id UUID REFERENCES public.vacation_requests(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT valid_dates CHECK (date_from <= date_to)
);

-- Vacation Balances (Quotas)
CREATE TABLE IF NOT EXISTS public.vacation_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    vacaciones_total INTEGER NOT NULL DEFAULT 22,
    vacaciones_usados INTEGER NOT NULL DEFAULT 0,
    retribuidos_total INTEGER NOT NULL DEFAULT 4,
    retribuidos_usados INTEGER NOT NULL DEFAULT 0,
    no_retribuidos_total INTEGER NOT NULL DEFAULT 0,
    no_retribuidos_usados INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, year)
);

-- Vacation Policies & Capacity
CREATE TABLE IF NOT EXISTS public.vacation_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    max_approved_per_day INTEGER NOT NULL DEFAULT 1,
    count_holidays BOOLEAN NOT NULL DEFAULT false,
    count_weekends BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Blocked Dates (Blackout)
CREATE TABLE IF NOT EXISTS public.blocked_dates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date_from DATE NOT NULL,
    date_to DATE NOT NULL,
    reason TEXT,
    scope TEXT NOT NULL DEFAULT 'global', -- global, team, user
    type_restriction TEXT NOT NULL DEFAULT 'all', -- all, VACACIONES, etc
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT valid_blocked_dates CHECK (date_from <= date_to)
);

-- 2. RLS Policies

ALTER TABLE public.vacation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vacation_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vacation_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_dates ENABLE ROW LEVEL SECURITY;

-- vacation_requests
CREATE POLICY "Users can view own requests" ON public.vacation_requests
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own requests" ON public.vacation_requests
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all requests" ON public.vacation_requests
    FOR ALL TO authenticated USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND rol = 'admin')
    );

-- vacation_balances
CREATE POLICY "Users can view own balances" ON public.vacation_balances
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all balances" ON public.vacation_balances
    FOR ALL TO authenticated USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND rol = 'admin')
    );

-- vacation_policies & blocked_dates (ReadOnly for all, Manage for Admins)
CREATE POLICY "Everyone can view policies" ON public.vacation_policies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Everyone can view blocked dates" ON public.blocked_dates FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage policies" ON public.vacation_policies
    FOR ALL TO authenticated USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND rol = 'admin')
    );

CREATE POLICY "Admins can manage blocked dates" ON public.blocked_dates
    FOR ALL TO authenticated USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND rol = 'admin')
    );

-- 3. Functions & Triggers

-- Trigger to notify admins on new request
CREATE OR REPLACE FUNCTION public.notify_admin_vacation_request()
RETURNS TRIGGER AS $$
DECLARE
    admin_record RECORD;
    user_name TEXT;
BEGIN
    -- Get requester name
    SELECT (nombre || ' ' || COALESCE(apellido, '')) INTO user_name 
    FROM public.profiles WHERE user_id = NEW.user_id;

    -- For each admin, insert a notification
    FOR admin_record IN (SELECT user_id FROM public.profiles WHERE rol = 'admin') LOOP
        INSERT INTO public.notifications (user_id, type, title, body, entity_type, entity_id, is_read)
        VALUES (
            admin_record.user_id,
            'vacation_request',
            'Nueva solicitud de ' || NEW.type,
            user_name || ' ha solicitado del ' || to_char(NEW.date_from, 'DD/MM/YYYY') || ' al ' || to_char(NEW.date_to, 'DD/MM/YYYY') || '.',
            'vacation',
            0, -- We don't have a specific page yet, but entity_id is required
            false
        );
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_notify_admin_vacation_request
AFTER INSERT ON public.vacation_requests
FOR EACH ROW
EXECUTE FUNCTION public.notify_admin_vacation_request();

-- Trigger to notify user on status change
CREATE OR REPLACE FUNCTION public.notify_vacation_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Only notify if status has changed
    IF (OLD.status IS DISTINCT FROM NEW.status) THEN
        INSERT INTO public.notifications (user_id, type, title, body, entity_type, entity_id)
        VALUES (
            NEW.user_id,
            'vacation_status_change',
            'Estado de solicitud actualizado',
            'Tu solicitud del ' || to_char(NEW.date_from, 'DD/MM/YYYY') || ' ha cambiado a: ' || NEW.status || '.',
            'vacation',
            0
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_notify_vacation_status_change
AFTER UPDATE ON public.vacation_requests
FOR EACH ROW
EXECUTE FUNCTION public.notify_vacation_status_change();

-- Trigger to create initial balance for new users
CREATE OR REPLACE FUNCTION public.handle_new_profile_vacation_balance()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.vacation_balances (user_id, year)
    VALUES (NEW.user_id, EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER)
    ON CONFLICT (user_id, year) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_create_vacation_balance_for_new_user
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_profile_vacation_balance();

-- 4. Initial Seed Data
INSERT INTO public.vacation_policies (name, max_approved_per_day, count_holidays, count_weekends)
VALUES ('Política General', 1, false, false);
