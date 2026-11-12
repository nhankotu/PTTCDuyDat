-- ====================================================================
-- FINRA FINANCIAL DASHBOARD - DATABASE SCHEMA
-- ====================================================================

-- 1. Bảng quản lý đợt import (import_batch)
CREATE TABLE IF NOT EXISTS import_batch (
    id              SERIAL PRIMARY KEY,
    file_name       VARCHAR(300) NOT NULL,
    file_sha256     CHAR(64) NOT NULL,
    report_date     DATE NOT NULL,
    storage_key     VARCHAR(500),
    total_rows      INT DEFAULT 0,
    total_value     NUMERIC(22,2) DEFAULT 0,
    total_balance   NUMERIC(22,2) DEFAULT 0,
    status          VARCHAR(20) NOT NULL DEFAULT 'PROCESSING',
    error_message   TEXT,
    uploaded_by     VARCHAR(100) NOT NULL DEFAULT 'system',
    uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_batch_hash UNIQUE (file_sha256)
);

-- 2. Bảng Nhân sự (employee)
CREATE TABLE IF NOT EXISTS employee (
    id              VARCHAR(50) PRIMARY KEY,
    full_name       VARCHAR(200) NOT NULL,
    branch_name     VARCHAR(150),
    department_name VARCHAR(150),
    manager_id      VARCHAR(50),
    batch_id        INT REFERENCES import_batch(id) ON DELETE SET NULL,
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_emp_branch ON employee(branch_name);
CREATE INDEX IF NOT EXISTS ix_emp_manager ON employee(manager_id);

-- 3. Bảng Hợp đồng chính (contract)
CREATE TABLE IF NOT EXISTS contract (
    id                      BIGSERIAL PRIMARY KEY,
    batch_id                INT NOT NULL REFERENCES import_batch(id) ON DELETE CASCADE,
    stt                     INT,
    appendix_number         VARCHAR(150) NOT NULL,
    contract_number         VARCHAR(100),
    
    -- Khách hàng
    customer_code           VARCHAR(50),
    customer_name           VARCHAR(255),
    
    -- Sản phẩm & Kỳ hạn
    product_name_raw        VARCHAR(200),
    product_group           VARCHAR(100) NOT NULL,
    term_raw                VARCHAR(50),
    term_group              VARCHAR(50),
    
    -- Giá trị tài chính
    estimated_interest      NUMERIC(18,2) DEFAULT 0,
    interest_payment_method VARCHAR(50),
    contract_value          NUMERIC(18,2) NOT NULL DEFAULT 0,
    liquidated_amount       NUMERIC(18,2) DEFAULT 0,
    
    -- Thời gian
    sign_date               DATE,
    expire_date             DATE,
    liquidate_date          DATE,
    is_liquidated           BOOLEAN DEFAULT FALSE,
    
    -- Trạng thái & Kênh
    status                  VARCHAR(50),
    channel                 VARCHAR(50),
    settlement_channel      VARCHAR(50),
    user_active             INT DEFAULT 0,
    ds_type                 CHAR(1) NOT NULL DEFAULT 'v',
    
    -- Rút vốn / Quy đổi
    partial_settle_date     DATE,
    partial_settle_amount   NUMERIC(18,2) DEFAULT 0,
    dsqd_no_early_withdraw  NUMERIC(18,2) DEFAULT 0,
    dsqd_early_withdraw     NUMERIC(18,2) DEFAULT 0,
    
    -- Sale & Quản lý
    id_sale_intro           VARCHAR(100),
    sale_id                 VARCHAR(50),
    final_sale_id           VARCHAR(50),
    final_sale_name         VARCHAR(200),
    manager_l1_id           VARCHAR(50),
    manager_l1_name         VARCHAR(200),
    manager_l2_id           VARCHAR(50),
    manager_l3_id           VARCHAR(50),
    manager_l4_id           VARCHAR(50),
    sale_branch             VARCHAR(150),
    sale_department         VARCHAR(150),
    transaction_office      VARCHAR(150),
    
    -- Các mốc số dư
    balance_prev_day        NUMERIC(18,2) DEFAULT 0,
    balance_prev_month_end  NUMERIC(18,2) DEFAULT 0,
    balance_prev_week_end   NUMERIC(18,2) DEFAULT 0,
    balance_current         NUMERIC(18,2) DEFAULT 0,
    
    -- Snapshot JSON
    raw_json                JSONB
);

CREATE INDEX IF NOT EXISTS ix_contract_batch          ON contract(batch_id);
CREATE INDEX IF NOT EXISTS ix_contract_sign_date      ON contract(batch_id, sign_date);
CREATE INDEX IF NOT EXISTS ix_contract_product        ON contract(batch_id, product_group);
CREATE INDEX IF NOT EXISTS ix_contract_term           ON contract(batch_id, term_group);
CREATE INDEX IF NOT EXISTS ix_contract_branch         ON contract(batch_id, sale_branch);
CREATE INDEX IF NOT EXISTS ix_contract_ds_type        ON contract(batch_id, ds_type);
CREATE INDEX IF NOT EXISTS ix_contract_customer       ON contract(customer_code);
CREATE INDEX IF NOT EXISTS ix_contract_appendix       ON contract(batch_id, appendix_number);
CREATE INDEX IF NOT EXISTS ix_contract_sale           ON contract(batch_id, final_sale_id);

-- 4. Bảng Số dư theo ngày (contract_daily_balance)
CREATE TABLE IF NOT EXISTS contract_daily_balance (
    id              BIGSERIAL PRIMARY KEY,
    contract_id     BIGINT NOT NULL REFERENCES contract(id) ON DELETE CASCADE,
    batch_id        INT NOT NULL REFERENCES import_batch(id) ON DELETE CASCADE,
    balance_date    DATE NOT NULL,
    balance_amount  NUMERIC(18,2) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS ix_daily_bal_date ON contract_daily_balance(batch_id, balance_date);
CREATE INDEX IF NOT EXISTS ix_daily_bal_contract ON contract_daily_balance(contract_id);

-- 5. Bảng Tất toán trước hạn (early_settlement)
CREATE TABLE IF NOT EXISTS early_settlement (
    id                  BIGSERIAL PRIMARY KEY,
    batch_id            INT NOT NULL REFERENCES import_batch(id) ON DELETE CASCADE,
    appendix_number     VARCHAR(150) NOT NULL,
    settlement_amount   NUMERIC(18,2) NOT NULL DEFAULT 0,
    settlement_type     VARCHAR(50),
    settlement_date     DATE
);

CREATE INDEX IF NOT EXISTS ix_early_settle_batch ON early_settlement(batch_id);
CREATE INDEX IF NOT EXISTS ix_early_settle_appendix ON early_settlement(appendix_number);

-- 6. Bảng Ngoại lệ Sale (sale_exception)
CREATE TABLE IF NOT EXISTS sale_exception (
    id                  BIGSERIAL PRIMARY KEY,
    batch_id            INT NOT NULL REFERENCES import_batch(id) ON DELETE CASCADE,
    appendix_number     VARCHAR(150) NOT NULL,
    effective_sale_id   VARCHAR(50) NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_sale_exc_batch ON sale_exception(batch_id);

-- 7. Bảng Phụ lục loại trừ Doanh số (excluded_contract)
CREATE TABLE IF NOT EXISTS excluded_contract (
    id                  BIGSERIAL PRIMARY KEY,
    batch_id            INT NOT NULL REFERENCES import_batch(id) ON DELETE CASCADE,
    appendix_number     VARCHAR(150) NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_excluded_batch ON excluded_contract(batch_id);

-- 8. Bảng User nội bộ (app_user) phục vụ xác thực JWT
CREATE TABLE IF NOT EXISTS app_user (
    id                  SERIAL PRIMARY KEY,
    username            VARCHAR(50) NOT NULL UNIQUE,
    password_hash       VARCHAR(255) NOT NULL,
    full_name           VARCHAR(100) NOT NULL,
    role                VARCHAR(20) NOT NULL DEFAULT 'user',
    branch_access       VARCHAR(150),
    permissions         JSONB,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ DEFAULT now()
);

-- 9. Bảng Refresh Token
CREATE TABLE IF NOT EXISTS user_refresh_token (
    id                  BIGSERIAL PRIMARY KEY,
    user_id             INT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    token               VARCHAR(255) NOT NULL UNIQUE,
    expires_at          TIMESTAMPTZ NOT NULL,
    is_revoked          BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by_ip       VARCHAR(50),
    revoked_at          TIMESTAMPTZ,
    replaced_by_token   VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS ix_refresh_token_user ON user_refresh_token(user_id);
CREATE INDEX IF NOT EXISTS ix_refresh_token_val ON user_refresh_token(token);

-- Seed tài khoản mặc định: admin / admin123
INSERT INTO app_user (username, password_hash, full_name, role)
VALUES ('admin', '$2a$11$q9hI6hZ7WpA2R7iT4TfNq.OvhH6V9m3L.s2kHkG7R/d0eK9i3lH8C', 'System Administrator', 'admin')
ON CONFLICT (username) DO NOTHING;
