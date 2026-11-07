-- ====================================================================
-- FINRA FINANCIAL DASHBOARD - SQL VIEWS FOR REPORTING & DASHBOARD
-- ====================================================================

-- 1. View tổng hợp KPI chính
CREATE OR REPLACE VIEW v_kpi_summary AS
SELECT
    c.batch_id,
    b.report_date,
    c.sale_branch AS branch_name,
    SUM(CASE WHEN c.ds_type = 'v' THEN c.contract_value ELSE 0 END) AS total_revenue,
    SUM(CASE WHEN c.ds_type = 'v' AND c.channel = 'UPSC' THEN c.contract_value ELSE 0 END) AS revenue_upsc,
    SUM(CASE WHEN c.ds_type = 'v' AND c.channel <> 'UPSC' THEN c.contract_value ELSE 0 END) AS revenue_finra,
    SUM(c.balance_current) AS total_balance_current,
    SUM(c.balance_current) - SUM(c.balance_prev_month_end) AS net_growth,
    COUNT(DISTINCT CASE 
        WHEN c.ds_type = 'v' 
         AND c.sign_date >= DATE_TRUNC('month', b.report_date)
         AND c.sign_date <= b.report_date
        THEN c.customer_code 
    END) AS new_customers,
    COUNT(*) AS total_contracts,
    COUNT(CASE WHEN c.ds_type = 'v' THEN 1 END) AS active_contracts
FROM contract c
JOIN import_batch b ON b.id = c.batch_id
GROUP BY c.batch_id, b.report_date, c.sale_branch;

-- 2. View theo Sản phẩm
CREATE OR REPLACE VIEW v_by_product AS
SELECT
    c.batch_id,
    c.sale_branch AS branch_name,
    c.product_group,
    SUM(CASE WHEN c.ds_type = 'v' THEN c.contract_value ELSE 0 END) AS revenue,
    SUM(c.balance_current) AS balance,
    COUNT(CASE WHEN c.ds_type = 'v' THEN 1 END) AS contract_count
FROM contract c
GROUP BY c.batch_id, c.sale_branch, c.product_group;

-- 3. View theo Kỳ hạn
CREATE OR REPLACE VIEW v_by_term AS
SELECT
    c.batch_id,
    c.sale_branch AS branch_name,
    c.term_group,
    SUM(CASE WHEN c.ds_type = 'v' THEN c.contract_value ELSE 0 END) AS revenue,
    SUM(c.balance_current) AS balance,
    COUNT(CASE WHEN c.ds_type = 'v' THEN 1 END) AS contract_count
FROM contract c
GROUP BY c.batch_id, c.sale_branch, c.term_group;

-- 4. View theo Chi nhánh
CREATE OR REPLACE VIEW v_by_branch AS
SELECT
    c.batch_id,
    c.sale_branch AS branch_name,
    SUM(CASE WHEN c.ds_type = 'v' THEN c.contract_value ELSE 0 END) AS revenue,
    SUM(c.balance_current) AS balance,
    COUNT(CASE WHEN c.ds_type = 'v' THEN 1 END) AS contract_count,
    COUNT(DISTINCT CASE WHEN c.ds_type = 'v' THEN c.customer_code END) AS customer_count
FROM contract c
GROUP BY c.batch_id, c.sale_branch;
