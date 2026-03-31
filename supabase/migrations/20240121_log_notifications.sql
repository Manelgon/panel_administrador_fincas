-- Migration to log notification creation activity
CREATE OR REPLACE FUNCTION public.log_notification_activity()
RETURNS TRIGGER AS $$
DECLARE
    v_user_name TEXT;
BEGIN
    -- Try to get the name of the user performing the action (auth.uid())
    SELECT nombre INTO v_user_name FROM public.profiles WHERE user_id = auth.uid();
    
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
            'recipient_id', NEW.user_id,
            'type', NEW.type,
            'aviso_id', NEW.id
        )
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create Trigger
DROP TRIGGER IF EXISTS trg_log_notification_activity ON public.notifications;

CREATE TRIGGER trg_log_notification_activity
AFTER INSERT ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.log_notification_activity();
