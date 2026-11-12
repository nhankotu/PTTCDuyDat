-- ====================================================================
-- FINRA FINANCIAL DASHBOARD - VERSIONED & HISTORICAL DATABASE SCHEMA
-- Bootstrap script: 004_versioned_schema.sql
-- ====================================================================

-- 0. Schema migrations tracking table
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(100) PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    description VARCHAR(255)
);

-- 1. Cập nhật bảng tài khoản app_user (Bổ sung liên kết nhân sự & chính sách xem cấp dưới)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'app_user' AND column_name = 'employee_id'
    ) THEN
        ALTER TABLE app_user ADD COLUMN employee_id VARCHAR(50);
        CREATE INDEX IF NOT EXISTS ix_app_user_emp ON app_user(employee_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'app_user' AND column_name = 'can_view_subordinates'
    ) THEN
        ALTER TABLE app_user ADD COLUMN can_view_subordinates BOOLEAN NOT NULL DEFAULT TRUE;
        ALTER TABLE app_user ADD COLUMN subordinate_view_updated_at TIMESTAMPTZ;
        ALTER TABLE app_user ADD COLUMN subordinate_view_updated_by VARCHAR(50);
    END IF;
END $$;

-- 2. Bảng Lịch sử Nhân sự & Cây Tổ chức theo khoảng hiệu lực (employee_history)
CREATE TABLE IF NOT EXISTS employee_history (
    id                      BIGSERIAL PRIMARY KEY,
    employee_id             VARCHAR(50) NOT NULL,
    full_name               VARCHAR(200) NOT NULL,
    position                VARCHAR(50) NOT NULL,
    source_level            VARCHAR(50),
    department              VARCHAR(150),
    branch                  VARCHAR(150),
    region                  VARCHAR(100),
    manager_employee_id     VARCHAR(50),
    manager_name            VARCHAR(150),
    source_account_status   VARCHAR(50),
    employment_status       VARCHAR(50),
    valid_from              DATE NOT NULL,
    valid_to                DATE NOT NULL DEFAULT '9999-12-31',
    batch_id                BIGINT,
    recorded_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    recorded_by             VARCHAR(100) NOT NULL DEFAULT 'system',
    is_current              BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT chk_emp_valid_dates CHECK (valid_from <= valid_to)
);

CREATE INDEX IF NOT EXISTS ix_emp_hist_emp_id       ON employee_history(employee_id);
CREATE INDEX IF NOT EXISTS ix_emp_hist_mgr_id       ON employee_history(manager_employee_id);
CREATE INDEX IF NOT EXISTS ix_emp_hist_validity     ON employee_history(employee_id, valid_from, valid_to);
CREATE INDEX IF NOT EXISTS ix_emp_hist_current      ON employee_history(is_current) WHERE is_current = TRUE;

-- 3. Bảng Quản lý Đợt Import Nguồn có phiên bản (source_batch)
CREATE TABLE IF NOT EXISTS source_batch (
    id                      BIGSERIAL PRIMARY KEY,
    source_type             VARCHAR(50) NOT NULL, -- APPENDIX, SETTLEMENT, STOCK, EXCEPTION, EMPLOYEE
    file_name               VARCHAR(300) NOT NULL,
    file_sha256             CHAR(64) NOT NULL,
    source_date             DATE,
    effective_date          DATE,
    storage_key             VARCHAR(500),
    mapping_version         VARCHAR(50) NOT NULL DEFAULT 'v1',
    status                  VARCHAR(30) NOT NULL DEFAULT 'STAGING', -- STAGING, VALIDATED, PREVIEWED, CONFIRMED, FAILED
    total_rows              INT DEFAULT 0,
    new_rows                INT DEFAULT 0,
    unchanged_rows          INT DEFAULT 0,
    changed_rows            INT DEFAULT 0,
    ambiguous_rows          INT DEFAULT 0,
    invalid_rows            INT DEFAULT 0,
    error_summary           TEXT,
    uploaded_by             VARCHAR(100) NOT NULL DEFAULT 'system',
    uploaded_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    confirmed_by            VARCHAR(100),
    confirmed_at            TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ix_source_batch_type_status ON source_batch(source_type, status);
CREATE INDEX IF NOT EXISTS ix_source_batch_hash ON source_batch(file_sha256);

-- 4. Bảng Staging lưu vị trí dòng & fingerprint chuẩn hóa (import_staging_record)
CREATE TABLE IF NOT EXISTS import_staging_record (
    id                      BIGSERIAL PRIMARY KEY,
    batch_id                BIGINT NOT NULL REFERENCES source_batch(id) ON DELETE CASCADE,
    source_type             VARCHAR(50) NOT NULL,
    sheet_name              VARCHAR(100),
    row_index               INT NOT NULL,
    entity_key              VARCHAR(150),
    fingerprint             CHAR(64) NOT NULL,
    classification          VARCHAR(20) NOT NULL DEFAULT 'NEW', -- NEW, UNCHANGED, CHANGED, AMBIGUOUS, INVALID
    parsed_json             JSONB NOT NULL,
    raw_selected_json       JSONB,
    diff_json               JSONB,
    validation_errors       JSONB,
    resolution_action       VARCHAR(50) DEFAULT 'PENDING', -- ACCEPT, SKIP, CREATE_NEW, LINK_EXISTING
    resolution_notes        TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_staging_batch_class ON import_staging_record(batch_id, classification);
CREATE INDEX IF NOT EXISTS ix_staging_entity ON import_staging_record(source_type, entity_key);

-- 5. Bảng Lưu Trữ Preview Nhập Dữ Liệu (import_preview)
CREATE TABLE IF NOT EXISTS import_preview (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id                BIGINT NOT NULL REFERENCES source_batch(id) ON DELETE CASCADE,
    expected_revision       INT NOT NULL DEFAULT 1,
    total_new               INT DEFAULT 0,
    total_unchanged         INT DEFAULT 0,
    total_changed           INT DEFAULT 0,
    total_ambiguous         INT DEFAULT 0,
    total_invalid           INT DEFAULT 0,
    impact_summary          JSONB,
    is_stale                BOOLEAN NOT NULL DEFAULT FALSE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by              VARCHAR(100) NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_import_preview_batch ON import_preview(batch_id);

-- 6. Bảng Audit Xác Nhận Import & Idempotency Key (import_confirm_audit)
CREATE TABLE IF NOT EXISTS import_confirm_audit (
    id                      BIGSERIAL PRIMARY KEY,
    preview_id              UUID NOT NULL,
    batch_id                BIGINT NOT NULL REFERENCES source_batch(id),
    idempotency_key         VARCHAR(100) NOT NULL UNIQUE,
    expected_revision       INT NOT NULL,
    actual_revision         INT NOT NULL,
    decision_summary        JSONB NOT NULL,
    reason                  TEXT NOT NULL,
    confirmed_by            VARCHAR(100) NOT NULL,
    confirmed_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_import_confirm_key ON import_confirm_audit(idempotency_key);

-- 7. Bảng Hợp Đồng Phụ Lục Chuẩn Hóa & Phiên Bản (contract_appendix_version)
-- 14 trường nghiệp vụ chuẩn (KHÔNG LÃI SUẤT) + metadata phiên bản
CREATE TABLE IF NOT EXISTS contract_appendix_version (
    id                      BIGSERIAL PRIMARY KEY,
    entity_id               UUID NOT NULL,
    appendix_number         VARCHAR(100) NOT NULL,
    customer_code           VARCHAR(20) NOT NULL,
    customer_name           VARCHAR(255) NOT NULL,
    product_name            VARCHAR(100) NOT NULL,
    term                    VARCHAR(50) NOT NULL,
    contract_value          NUMERIC(18,2) NOT NULL DEFAULT 0,
    liquidated_amount       NUMERIC(18,2) NOT NULL DEFAULT 0,
    sign_date               DATE NOT NULL,
    expire_date             DATE,
    liquidate_date          DATE,
    sale_id                 VARCHAR(50) NOT NULL,
    sale_name               VARCHAR(150),
    status                  VARCHAR(50) NOT NULL, -- APPROVED, LIQUIDATED, PENDING, ADVANCING
    channel                 VARCHAR(50) NOT NULL, -- APP_FINRA, BO_FINRA, UPSC
    batch_id                BIGINT NOT NULL REFERENCES source_batch(id),
    version_num             INT NOT NULL DEFAULT 1,
    valid_from              DATE NOT NULL,
    valid_to                DATE NOT NULL DEFAULT '9999-12-31',
    fingerprint             CHAR(64) NOT NULL,
    is_active_version       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_app_valid_dates CHECK (valid_from <= valid_to)
);

CREATE INDEX IF NOT EXISTS ix_app_ver_entity ON contract_appendix_version(entity_id);
CREATE INDEX IF NOT EXISTS ix_app_ver_appendix ON contract_appendix_version(appendix_number);
CREATE INDEX IF NOT EXISTS ix_app_ver_cust ON contract_appendix_version(customer_code);
CREATE INDEX IF NOT EXISTS ix_app_ver_sign_date ON contract_appendix_version(sign_date);
CREATE INDEX IF NOT EXISTS ix_app_ver_status ON contract_appendix_version(status);
CREATE INDEX IF NOT EXISTS ix_app_ver_sale ON contract_appendix_version(sale_id);
CREATE INDEX IF NOT EXISTS ix_app_ver_active ON contract_appendix_version(is_active_version) WHERE is_active_version = TRUE;

-- 8. Bảng Giao Dịch Tất Toán (contract_settlement_transaction)
-- 12 trường nghiệp vụ chuẩn (KHÔNG LÃI SUẤT), hỗ trợ nhiều giao dịch cùng hợp đồng
CREATE TABLE IF NOT EXISTS contract_settlement_transaction (
    id                      BIGSERIAL PRIMARY KEY,
    transaction_entity_id   UUID NOT NULL,
    appendix_number         VARCHAR(100) NOT NULL,
    customer_code           VARCHAR(20) NOT NULL,
    customer_name           VARCHAR(255) NOT NULL,
    transaction_date        DATE NOT NULL,
    settlement_date         DATE NOT NULL,
    principal_amount        NUMERIC(18,2) NOT NULL DEFAULT 0,
    term                    VARCHAR(50),
    settlement_amount       NUMERIC(18,2) NOT NULL DEFAULT 0,
    sale_id                 VARCHAR(50) NOT NULL,
    sale_name               VARCHAR(150),
    channel                 VARCHAR(50),
    batch_id                BIGINT NOT NULL REFERENCES source_batch(id),
    version_num             INT NOT NULL DEFAULT 1,
    fingerprint             CHAR(64) NOT NULL,
    is_active_version       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_settle_tx_app ON contract_settlement_transaction(appendix_number);
CREATE INDEX IF NOT EXISTS ix_settle_tx_date ON contract_settlement_transaction(settlement_date);
CREATE INDEX IF NOT EXISTS ix_settle_tx_sale ON contract_settlement_transaction(sale_id);
CREATE INDEX IF NOT EXISTS ix_settle_tx_active ON contract_settlement_transaction(is_active_version) WHERE is_active_version = TRUE;

-- 9. Bảng Hợp Đồng Chứng Khoán (stock_contract_version)
-- 9 trường nghiệp vụ chuẩn, độc lập với Phụ lục, cho phép trùng appendix_number
CREATE TABLE IF NOT EXISTS stock_contract_version (
    id                      BIGSERIAL PRIMARY KEY,
    entity_id               UUID NOT NULL,
    appendix_number         VARCHAR(150) NOT NULL,
    customer_code           VARCHAR(20) NOT NULL,
    customer_name           VARCHAR(255) NOT NULL,
    contract_value          NUMERIC(18,2) NOT NULL DEFAULT 0,
    liquidated_amount       NUMERIC(18,2) NOT NULL DEFAULT 0,
    sign_date               DATE NOT NULL,
    expire_date             DATE,
    liquidate_date          DATE,
    sale_id                 VARCHAR(100) NOT NULL,
    batch_id                BIGINT NOT NULL REFERENCES source_batch(id),
    version_num             INT NOT NULL DEFAULT 1,
    fingerprint             CHAR(64) NOT NULL,
    is_active_version       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_stock_ver_entity ON stock_contract_version(entity_id);
CREATE INDEX IF NOT EXISTS ix_stock_ver_app ON stock_contract_version(appendix_number);
CREATE INDEX IF NOT EXISTS ix_stock_ver_sign ON stock_contract_version(sign_date);
CREATE INDEX IF NOT EXISTS ix_stock_ver_sale ON stock_contract_version(sale_id);

-- 10. Bảng Ngoại Lệ Sale (contract_exception_version)
-- 15 trường + new_sale_id, dùng ghi đè người thụ hưởng
CREATE TABLE IF NOT EXISTS contract_exception_version (
    id                      BIGSERIAL PRIMARY KEY,
    entity_id               UUID NOT NULL,
    appendix_number         VARCHAR(100) NOT NULL,
    new_sale_id             VARCHAR(50) NOT NULL,
    original_sale_id        VARCHAR(50),
    effective_date          DATE NOT NULL,
    expire_date             DATE,
    batch_id                BIGINT NOT NULL REFERENCES source_batch(id),
    version_num             INT NOT NULL DEFAULT 1,
    is_active_version       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_exc_ver_app ON contract_exception_version(appendix_number);
CREATE INDEX IF NOT EXISTS ix_exc_ver_new_sale ON contract_exception_version(new_sale_id);
CREATE INDEX IF NOT EXISTS ix_exc_ver_active ON contract_exception_version(is_active_version) WHERE is_active_version = TRUE;

-- 11. Bảng Dataset Báo Cáo Bất Biến (report_dataset & dataset_source_manifest)
CREATE TABLE IF NOT EXISTS report_dataset (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_code            VARCHAR(100) NOT NULL UNIQUE,
    title                   VARCHAR(255) NOT NULL,
    cutoff_date             DATE NOT NULL,
    coverage_from           DATE NOT NULL,
    coverage_to             DATE NOT NULL,
    is_published            BOOLEAN NOT NULL DEFAULT FALSE,
    published_at            TIMESTAMPTZ,
    published_by            VARCHAR(100),
    previous_dataset_id     UUID REFERENCES report_dataset(id),
    amendment_reason        TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by              VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS dataset_source_manifest (
    id                      BIGSERIAL PRIMARY KEY,
    dataset_id              UUID NOT NULL REFERENCES report_dataset(id) ON DELETE RESTRICT,
    source_type             VARCHAR(50) NOT NULL,
    source_batch_id         BIGINT REFERENCES source_batch(id) ON DELETE RESTRICT,
    is_confirmed_no_movement BOOLEAN NOT NULL DEFAULT FALSE,
    notes                   TEXT,
    CONSTRAINT uq_dataset_manifest UNIQUE (dataset_id, source_type)
);

CREATE INDEX IF NOT EXISTS ix_manifest_dataset ON dataset_source_manifest(dataset_id);

-- 12. Bảng Phân Quyền Ngang Hàng, Đơn Yêu Cầu & Audit (access_peer_grant, access_request, access_audit_log)
CREATE TABLE IF NOT EXISTS access_peer_grant (
    id                      BIGSERIAL PRIMARY KEY,
    user_id                 INT NOT NULL REFERENCES app_user(id) ON DELETE RESTRICT,
    target_employee_id      VARCHAR(50) NOT NULL,
    grant_revenue           BOOLEAN NOT NULL DEFAULT FALSE,
    grant_balance           BOOLEAN NOT NULL DEFAULT FALSE,
    target_scope_type       VARCHAR(20) NOT NULL DEFAULT 'SELF',
    valid_from              DATE NOT NULL,
    valid_to                DATE NOT NULL DEFAULT '9999-12-31',
    status                  VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, REVOKED, EXPIRED
    granted_by              VARCHAR(100) NOT NULL,
    grant_reason            TEXT NOT NULL,
    revoked_by              VARCHAR(100),
    revoked_at              TIMESTAMPTZ,
    revocation_reason       TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_grant_valid_dates CHECK (valid_from <= valid_to)
);

CREATE INDEX IF NOT EXISTS ix_peer_grant_user ON access_peer_grant(user_id, status);
CREATE INDEX IF NOT EXISTS ix_peer_grant_target ON access_peer_grant(target_employee_id);

CREATE TABLE IF NOT EXISTS access_request (
    id                      BIGSERIAL PRIMARY KEY,
    requesting_user_id      INT NOT NULL REFERENCES app_user(id),
    target_employee_id      VARCHAR(50) NOT NULL,
    request_revenue         BOOLEAN NOT NULL DEFAULT FALSE,
    request_balance         BOOLEAN NOT NULL DEFAULT FALSE,
    reason                  TEXT NOT NULL,
    status                  VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED
    reviewed_by             VARCHAR(100),
    reviewed_at             TIMESTAMPTZ,
    review_notes            TEXT,
    resulting_grant_id      BIGINT REFERENCES access_peer_grant(id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_access_req_user ON access_request(requesting_user_id, status);

CREATE TABLE IF NOT EXISTS access_audit_log (
    id                      BIGSERIAL PRIMARY KEY,
    actor_username          VARCHAR(100) NOT NULL,
    action                  VARCHAR(50) NOT NULL,
    target_type             VARCHAR(50) NOT NULL,
    target_id               VARCHAR(100) NOT NULL,
    details                 JSONB NOT NULL,
    ip_address              VARCHAR(50),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_access_audit_action ON access_audit_log(action, created_at);

-- Ghi nhận migration 001_versioned_schema
INSERT INTO schema_migrations (version, description)
VALUES ('001_versioned_schema', 'Initial versioned schema, staging, manifest, and access tables')
ON CONFLICT (version) DO NOTHING;
