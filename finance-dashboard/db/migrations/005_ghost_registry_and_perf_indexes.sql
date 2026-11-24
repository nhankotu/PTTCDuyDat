-- 005_ghost_registry_and_perf_indexes.sql
-- 1. Dedicated permanent registry table for Ghost Contracts (Hợp đồng ma)
CREATE TABLE IF NOT EXISTS ghost_contract_registry (
    id                   BIGSERIAL PRIMARY KEY,
    appendix_number      VARCHAR(150) NOT NULL,
    appendix_number_norm VARCHAR(150) NOT NULL UNIQUE,
    customer_code        VARCHAR(100),
    customer_name        VARCHAR(255),
    product_name         VARCHAR(200),
    contract_value       NUMERIC(18, 2),
    sign_date            DATE,
    sale_id              VARCHAR(100),
    reason               TEXT,
    source_file_name     VARCHAR(255),
    source_batch_id      BIGINT,
    marked_by            VARCHAR(100) NOT NULL DEFAULT 'admin',
    marked_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_locked            BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS ix_ghost_registry_marked_at ON ghost_contract_registry(marked_at DESC);

-- Migrate legacy excluded_contract records into ghost_contract_registry (idempotent)
INSERT INTO ghost_contract_registry (
    appendix_number, appendix_number_norm, customer_code, customer_name,
    product_name, contract_value, sign_date, sale_id,
    source_batch_id, marked_by, marked_at, is_locked
)
SELECT
    TRIM(ec.appendix_number),
    UPPER(TRIM(ec.appendix_number)),
    ca.customer_code,
    ca.customer_name,
    ca.product_name,
    ca.contract_value,
    ca.sign_date,
    ca.sale_id,
    ec.source_batch_id,
    COALESCE(ec.marked_by, 'admin'),
    COALESCE(ec.marked_at, now()),
    TRUE
FROM excluded_contract ec
LEFT JOIN LATERAL (
    SELECT customer_code, customer_name, product_name, contract_value, sign_date, sale_id
    FROM contract_appendix_version c
    WHERE UPPER(TRIM(c.appendix_number)) = UPPER(TRIM(ec.appendix_number))
    ORDER BY c.version_num DESC
    LIMIT 1
) ca ON TRUE
WHERE TRIM(ec.appendix_number) <> ''
ON CONFLICT (appendix_number_norm) DO NOTHING;

-- 2. Performance Indexes for Render Free PostgreSQL (KPI, Trend, Pivot, New Customers)
CREATE INDEX IF NOT EXISTS ix_app_ver_app_ver_desc
    ON contract_appendix_version (appendix_number, version_num DESC);

CREATE INDEX IF NOT EXISTS ix_app_ver_perf_main
    ON contract_appendix_version (status, sign_date, valid_from, valid_to);

CREATE INDEX IF NOT EXISTS ix_exc_ver_lookup
    ON contract_exception_version (appendix_number, effective_date, expire_date);

CREATE INDEX IF NOT EXISTS ix_settle_tx_lookup
    ON contract_settlement_transaction (appendix_number, settlement_date)
    WHERE is_active_version = TRUE;

CREATE INDEX IF NOT EXISTS ix_app_ver_cust_upper
    ON contract_appendix_version (UPPER(TRIM(customer_code)), sign_date);
