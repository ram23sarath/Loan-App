-- check_customer_status.sql
-- Run this to see why the function cannot find the customer

SELECT 
    id, 
    name, 
    deleted_at,
    CASE 
        WHEN deleted_at IS NOT NULL THEN 'Soft Deleted' 
        ELSE 'Active' 
    END as status
FROM public.customers 
WHERE id = '6ccb0a6d-8df7-43db-8506-6e4e91157d45';
