-- Migration to log notification creation activity with recipient name instead of ID
CREATE OR REPLACE FUNCTION public.log_notification_activity()
RETURNS TRIGGER AS $$
DECLARE
    v_user_name TEXT;
    v_recipient_name TEXT;
BEGIN
    -- Get the name of the user performing the action (auth.uid())
    SELECT nombre INTO v_user_name FROM public.profiles WHERE user_id = auth.uid();
    
    -- Get the name of the recipient
    SELECT nombre INTO v_recipient_name FROM public.profiles WHERE user_id = NEW.user_id;
    
    INSERT INTO public.activity_logs (
        user_id,
        user_name,
        action,
        entity_type,
        entity_id,
        entity_name,
        details
    )
    VALUES (
        auth.uid(),
        COALESCE(v_user_name, 'Sistema'),
        'create',
        'aviso',
        NEW.entity_id,
        NEW.title,
        jsonb_build_object(
            'recipient_id', COALESCE(v_recipient_name, NEW.user_id::text),
            'type', NEW.type,
            'aviso_id', NEW.id
        )
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
