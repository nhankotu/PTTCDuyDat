-- Script: Xóa sạch toàn bộ dữ liệu các file đã import vào hệ thống Finra Finance
-- Giữ nguyên: Tài khoản người dùng (app_user), quyền hạn (permission_preset), phân quyền và migration

BEGIN;

TRUNCATE TABLE
    -- Dữ liệu hợp đồng, giao dịch và số dư V1
    contract_appendix_version,
    contract_settlement_transaction,
    stock_contract_version,
    contract_exception_version,
    
    -- Dữ liệu staging, preview và batch import V1
    import_staging_record,
    import_preview,
    import_confirm_audit,
    dataset_source_manifest,
    report_dataset,
    source_batch,
    
    -- Dữ liệu nhân sự và lịch sử cây tổ chức
    employee,
    employee_history,
    
    -- Dữ liệu hợp đồng và giao dịch V0 (nếu có)
    contract_daily_balance,
    early_settlement,
    sale_exception,
    contract,
    excluded_contract,
    ghost_contract_registry,
    import_batch
CASCADE;

COMMIT;

-- Kiểm tra lại số lượng dữ liệu sau khi xóa
SELECT 'app_user' AS table_name, count(*) AS remaining_rows FROM app_user
UNION ALL
SELECT 'contract_appendix_version', count(*) FROM contract_appendix_version
UNION ALL
SELECT 'employee', count(*) FROM employee
UNION ALL
SELECT 'source_batch', count(*) FROM source_batch;
