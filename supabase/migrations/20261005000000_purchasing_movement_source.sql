-- Receiving uses the existing movement ledger. Enum values cannot be used in the
-- same transaction that adds them, so this migration only extends the type.

alter type public.inventory_movement_source add value if not exists 'receiving_report';
