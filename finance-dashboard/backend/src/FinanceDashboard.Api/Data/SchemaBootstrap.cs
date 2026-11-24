using Dapper;

namespace FinanceDashboard.Api.Data;

/// <summary>
/// Ensures v1 columns and tables exist at startup for databases initialized from older SQL scripts.
/// </summary>
public static class SchemaBootstrap
{
    private const string SyncSql = @"
        ALTER TABLE app_user ADD COLUMN IF NOT EXISTS scope_type VARCHAR(50) NOT NULL DEFAULT 'ALL';
        ALTER TABLE app_user ADD COLUMN IF NOT EXISTS scope_node_id VARCHAR(100);
        ALTER TABLE app_user ADD COLUMN IF NOT EXISTS scope_node_name VARCHAR(255);
        ALTER TABLE app_user ADD COLUMN IF NOT EXISTS scope_node_role VARCHAR(100);

        ALTER TABLE employee ADD COLUMN IF NOT EXISTS region_name VARCHAR(150);
        ALTER TABLE employee ADD COLUMN IF NOT EXISTS position VARCHAR(50);
        ALTER TABLE employee ADD COLUMN IF NOT EXISTS level INT;
        ALTER TABLE employee ADD COLUMN IF NOT EXISTS manager_name VARCHAR(200);
        ALTER TABLE employee ADD COLUMN IF NOT EXISTS status VARCHAR(50);
        ALTER TABLE employee ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

        CREATE TABLE IF NOT EXISTS permission_preset (
            id              SERIAL PRIMARY KEY,
            name            VARCHAR(150) NOT NULL,
            description     TEXT,
            scope_type      VARCHAR(50) NOT NULL DEFAULT 'ALL',
            scope_node_id   VARCHAR(100),
            scope_node_name VARCHAR(255),
            scope_node_role VARCHAR(100),
            created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
            created_by      VARCHAR(100) NOT NULL DEFAULT 'admin'
        );

        UPDATE app_user
        SET password_hash = '$2a$11$5i3IrMPdu15AK.CypuDGVuVmO5oEjTCW.7TJLDCrnTwl978ifJ8we'
        WHERE username = 'admin'
          AND password_hash = '$2a$11$q9hI6hZ7WpA2R7iT4TfNq.OvhH6V9m3L.s2kHkG7R/d0eK9i3lH8C';

        -- Allow ghost contracts marked via UI or V2 import without legacy import_batch FK
        ALTER TABLE excluded_contract ALTER COLUMN batch_id DROP NOT NULL;
        ALTER TABLE excluded_contract DROP CONSTRAINT IF EXISTS excluded_contract_batch_id_fkey;
        ALTER TABLE excluded_contract ADD COLUMN IF NOT EXISTS source_batch_id BIGINT;
        ALTER TABLE excluded_contract ADD COLUMN IF NOT EXISTS marked_by VARCHAR(100);
        ALTER TABLE excluded_contract ADD COLUMN IF NOT EXISTS marked_at TIMESTAMPTZ DEFAULT now();

        -- Deduplicate excluded_contract on normalized appendix_number before creating unique index
        DELETE FROM excluded_contract a
        USING excluded_contract b
        WHERE a.id < b.id
          AND UPPER(TRIM(a.appendix_number)) = UPPER(TRIM(b.appendix_number));

        CREATE UNIQUE INDEX IF NOT EXISTS ux_excluded_contract_app_upper
            ON excluded_contract (UPPER(TRIM(appendix_number)));

        -- Dedicated permanent registry table for Ghost Contracts (Hợp đồng ma)
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

        -- Performance indexes for Render Free PostgreSQL
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
    ";

    public static async Task EnsureSyncedAsync(IServiceProvider services)
    {
        try
        {
            var factory = services.GetRequiredService<IDbConnectionFactory>();
            await using var connection = factory.CreateNpgsqlConnection();
            await connection.OpenAsync();
            await connection.ExecuteAsync(SyncSql);
        }
        catch (Exception ex)
        {
            var logger = services.GetRequiredService<ILoggerFactory>().CreateLogger("SchemaBootstrap");
            logger.LogWarning(ex, "Schema bootstrap sync skipped or failed during startup.");
        }
    }
}
