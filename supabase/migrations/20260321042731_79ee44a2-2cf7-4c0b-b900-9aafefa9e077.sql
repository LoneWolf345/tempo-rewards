
-- Create adjustments table
CREATE TABLE public.adjustments (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    technician_email text NOT NULL,
    technician_name text,
    adjustment_type text NOT NULL DEFAULT 'raffle',
    amount numeric NOT NULL,
    adjustment_date date NOT NULL,
    description text,
    uploaded_by uuid NOT NULL,
    uploaded_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.adjustments ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admins can view all adjustments"
ON public.adjustments FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert adjustments"
ON public.adjustments FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update adjustments"
ON public.adjustments FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete adjustments"
ON public.adjustments FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Technicians can view their own
CREATE POLICY "Users can view their own adjustments"
ON public.adjustments FOR SELECT
USING (lower(technician_email) = lower((SELECT profiles.email FROM profiles WHERE profiles.user_id = auth.uid())));

-- Add expected_reward_amount to tempo_submissions
ALTER TABLE public.tempo_submissions
ADD COLUMN expected_reward_amount numeric;
