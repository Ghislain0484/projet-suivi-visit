-- Align demo invoices amount_paid values with their payment_status
UPDATE invoices SET amount_paid = amount WHERE payment_status = 'paid';
UPDATE invoices SET amount_paid = 600000 WHERE id = '33333333-3333-3333-3333-333333333005';
