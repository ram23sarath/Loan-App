-- ============================================================
-- TRIGGER: Sync Interest Deletion
-- Ensures customer_interest balance remains correct if an
-- "Interest Charge" entry is deleted from the UI (Soft Delete)
-- ============================================================

-- Function to handle the logic
CREATE OR REPLACE FUNCTION public.handle_interest_entry_deletion()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Check if it is a soft delete (deleted_at changed from NULL to Value)
    IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
        
        -- Check if this was an Interest Charge
        IF OLD.subtype = 'Interest Charge' THEN
            RAISE NOTICE 'Syncing deleted interest charge: %', OLD.amount;
            
            -- Deduct the amount from the customer's running total
            UPDATE public.customer_interest
            SET total_interest_charged = GREATEST(0, total_interest_charged - OLD.amount),
                updated_at = now()
            WHERE customer_id = OLD.customer_id;
        END IF;
        
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create the Trigger on data_entries
DROP TRIGGER IF EXISTS sync_interest_deletion ON public.data_entries;

CREATE TRIGGER sync_interest_deletion
AFTER UPDATE OF deleted_at ON public.data_entries
FOR EACH ROW
EXECUTE FUNCTION public.handle_interest_entry_deletion();

COMMENT ON TRIGGER sync_interest_deletion ON public.data_entries IS 
'Automatically reduces customer_interest balance when an Interest Charge is soft-deleted';
