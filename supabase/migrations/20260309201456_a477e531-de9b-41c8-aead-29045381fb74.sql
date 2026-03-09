
-- Add expiry_date column to sendoso_records
ALTER TABLE public.sendoso_records ADD COLUMN expiry_date date NULL;

-- Add UPDATE RLS policy for admins
CREATE POLICY "Admins can update sendoso records"
ON public.sendoso_records
FOR UPDATE
TO public
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
