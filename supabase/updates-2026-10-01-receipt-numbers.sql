-- Palm River Academy admin: no two receipts with the same number.
-- Run once in the Supabase SQL editor (safe to run again).
--
-- Receipt numbers (PT-2627-0001 ...) are handed out by the app: it reads the
-- highest number and adds one. Two people recording a payment at the same moment
-- could both be given the same number, and nothing stopped the second one being
-- saved. Invoice numbers already have this rule (adm_invoices.number is unique).
-- With it in place, the app sees the refusal and takes the next number.

-- 1. See whether any number is already used twice. If this lists rows, give one
--    payment of each pair a new number on its invoice page before step 2, or
--    step 2 fails and changes nothing.
select receipt_number, count(*) as times
  from adm_payments
 where receipt_number is not null
 group by receipt_number
having count(*) > 1;

-- 2. The rule itself.
create unique index if not exists adm_payments_receipt_number_key
  on adm_payments (receipt_number)
  where receipt_number is not null;
