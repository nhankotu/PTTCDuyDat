using System.Data;
using System.Diagnostics;
using System.Security.Cryptography;
using System.Text.Json;
using FinanceDashboard.Api.Data;
using FinanceDashboard.Api.DTOs;
using FinanceDashboard.Api.Models;
using MiniExcelLibs;
using Npgsql;
using NpgsqlTypes;

namespace FinanceDashboard.Api.Services;

public interface IExcelImportService
{
    Task<UploadResultDto> ImportExcelAsync(Stream fileStream, string fileName, string uploadedBy = "system");
}

public class ExcelImportService : IExcelImportService
{
    private readonly IDbConnectionFactory _dbFactory;
    private readonly ILogger<ExcelImportService> _logger;

    public ExcelImportService(IDbConnectionFactory dbFactory, ILogger<ExcelImportService> logger)
    {
        _dbFactory = dbFactory;
        _logger = logger;
    }

    public async Task<UploadResultDto> ImportExcelAsync(Stream fileStream, string fileName, string uploadedBy = "system")
    {
        var sw = Stopwatch.StartNew();
        _logger.LogInformation("Starting import for file {FileName}", fileName);

        // 1. Copy stream to memory to calculate SHA-256 and allow multiple sheet reads
        using var memoryStream = new MemoryStream();
        await fileStream.CopyToAsync(memoryStream);
        memoryStream.Position = 0;

        string fileSha256;
        using (var sha = SHA256.Create())
        {
            var hashBytes = sha.ComputeHash(memoryStream);
            fileSha256 = BitConverter.ToString(hashBytes).Replace("-", "").ToLowerInvariant();
        }
        memoryStream.Position = 0;

        await using var connection = _dbFactory.CreateNpgsqlConnection();
        await connection.OpenAsync();

        // Check if hash already exists
        await using (var checkCmd = new NpgsqlCommand("SELECT id, report_date FROM import_batch WHERE file_sha256 = @hash", connection))
        {
            checkCmd.Parameters.AddWithValue("hash", fileSha256);
            await using var reader = await checkCmd.ExecuteReaderAsync();
            if (await reader.ReadAsync())
            {
                var existingId = reader.GetInt32(0);
                var existingDate = reader.GetDateTime(1);
                throw new InvalidOperationException($"File này đã được import trước đó (Batch #{existingId}, ngày báo cáo {existingDate:dd/MM/yyyy}). Không thể import trùng.");
            }
        }

        // 2. Read 'BC ngày' sheet to get report date
        DateTime reportDate = DateTime.Today;
        try
        {
            memoryStream.Position = 0;
            var bcRows = memoryStream.Query(sheetName: "BC ngày").ToList();
            foreach (IDictionary<string, object> row in bcRows)
            {
                foreach (var kvp in row)
                {
                    if (kvp.Value is DateTime dt)
                    {
                        reportDate = dt;
                        break;
                    }
                    if (kvp.Value is string s && DateTime.TryParse(s, out var parsedDt))
                    {
                        reportDate = parsedDt;
                        break;
                    }
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not read 'BC ngày' sheet, fallback to today");
        }

        // 3. Create ImportBatch record
        int batchId;
        await using (var insertBatchCmd = new NpgsqlCommand(
            @"INSERT INTO import_batch (file_name, file_sha256, report_date, status, uploaded_by) 
              VALUES (@fileName, @hash, @reportDate, 'PROCESSING', @uploadedBy) RETURNING id;", connection))
        {
            insertBatchCmd.Parameters.AddWithValue("fileName", fileName);
            insertBatchCmd.Parameters.AddWithValue("hash", fileSha256);
            insertBatchCmd.Parameters.AddWithValue("reportDate", reportDate);
            insertBatchCmd.Parameters.AddWithValue("uploadedBy", uploadedBy);
            batchId = Convert.ToInt32(await insertBatchCmd.ExecuteScalarAsync());
        }

        await using var transaction = await connection.BeginTransactionAsync();

        try
        {
            // 4. Import 'Nhân sự'
            int employeeCount = 0;
            try
            {
                memoryStream.Position = 0;
                var nsRows = memoryStream.Query(sheetName: "Nhân sự").ToList();
                // Find header row (contains "ID" and "Họ và tên")
                int headerIdx = -1;
                for (int i = 0; i < Math.Min(10, nsRows.Count); i++)
                {
                    var dict = (IDictionary<string, object>)nsRows[i];
                    var vals = dict.Values.Select(v => v?.ToString() ?? "").ToList();
                    if (vals.Any(v => v.Contains("ID")) && vals.Any(v => v.Contains("Họ và tên")))
                    {
                        headerIdx = i;
                        break;
                    }
                }

                if (headerIdx >= 0)
                {
                    for (int i = headerIdx + 1; i < nsRows.Count; i++)
                    {
                        var dict = (IDictionary<string, object>)nsRows[i];
                        var vals = dict.Values.ToList();
                        if (vals.Count < 2) continue;
                        var id = vals[0]?.ToString()?.Trim();
                        var name = vals[1]?.ToString()?.Trim();
                        if (string.IsNullOrWhiteSpace(id) || string.IsNullOrWhiteSpace(name)) continue;

                        var branch = vals.Count > 2 ? vals[2]?.ToString()?.Trim() : null;
                        var dept = vals.Count > 3 ? vals[3]?.ToString()?.Trim() : null;
                        var mgr = vals.Count > 4 ? vals[4]?.ToString()?.Trim() : null;

                        await using var empCmd = new NpgsqlCommand(
                            @"INSERT INTO employee (id, full_name, branch_name, department_name, manager_id, batch_id)
                              VALUES (@id, @name, @branch, @dept, @mgr, @batchId)
                              ON CONFLICT (id) DO UPDATE SET 
                                full_name = EXCLUDED.full_name,
                                branch_name = EXCLUDED.branch_name,
                                department_name = EXCLUDED.department_name,
                                manager_id = EXCLUDED.manager_id,
                                batch_id = EXCLUDED.batch_id,
                                updated_at = now();", connection, transaction);
                        empCmd.Parameters.AddWithValue("id", id);
                        empCmd.Parameters.AddWithValue("name", name);
                        empCmd.Parameters.AddWithValue("branch", (object?)branch ?? DBNull.Value);
                        empCmd.Parameters.AddWithValue("dept", (object?)dept ?? DBNull.Value);
                        empCmd.Parameters.AddWithValue("mgr", (object?)mgr ?? DBNull.Value);
                        empCmd.Parameters.AddWithValue("batchId", batchId);
                        await empCmd.ExecuteNonQueryAsync();
                        employeeCount++;
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to import 'Nhân sự' sheet");
            }

            // 5. Import 'Ngoại lệ'
            var exceptionsMap = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            try
            {
                memoryStream.Position = 0;
                var nlRows = memoryStream.Query(sheetName: "Ngoại lệ").ToList();
                for (int i = 1; i < nlRows.Count; i++)
                {
                    var dict = (IDictionary<string, object>)nlRows[i];
                    var vals = dict.Values.ToList();
                    if (vals.Count >= 2)
                    {
                        var appNo = vals[0]?.ToString()?.Trim();
                        var saleId = vals[1]?.ToString()?.Trim();
                        if (!string.IsNullOrWhiteSpace(appNo) && !string.IsNullOrWhiteSpace(saleId))
                        {
                            exceptionsMap[appNo] = saleId;
                            await using var excCmd = new NpgsqlCommand(
                                "INSERT INTO sale_exception (batch_id, appendix_number, effective_sale_id) VALUES (@batchId, @appNo, @saleId);",
                                connection, transaction);
                            excCmd.Parameters.AddWithValue("batchId", batchId);
                            excCmd.Parameters.AddWithValue("appNo", appNo);
                            excCmd.Parameters.AddWithValue("saleId", saleId);
                            await excCmd.ExecuteNonQueryAsync();
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to import 'Ngoại lệ' sheet");
            }

            // 6. Import 'Bỏ DS'
            var excludedSet = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            try
            {
                memoryStream.Position = 0;
                var bdsRows = memoryStream.Query(sheetName: "Bỏ DS").ToList();
                for (int i = 1; i < bdsRows.Count; i++)
                {
                    var dict = (IDictionary<string, object>)bdsRows[i];
                    var vals = dict.Values.ToList();
                    if (vals.Count >= 1)
                    {
                        var appNo = vals[0]?.ToString()?.Trim();
                        if (!string.IsNullOrWhiteSpace(appNo))
                        {
                            excludedSet.Add(appNo);
                            await using var bdsCmd = new NpgsqlCommand(
                                "INSERT INTO excluded_contract (batch_id, appendix_number) VALUES (@batchId, @appNo);",
                                connection, transaction);
                            bdsCmd.Parameters.AddWithValue("batchId", batchId);
                            bdsCmd.Parameters.AddWithValue("appNo", appNo);
                            await bdsCmd.ExecuteNonQueryAsync();
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to import 'Bỏ DS' sheet");
            }

            // 7. Import 'Tất toán trước hạn'
            int earlySettleCount = 0;
            try
            {
                memoryStream.Position = 0;
                var ttRows = memoryStream.Query(sheetName: "Tất toán trước hạn").ToList();
                for (int i = 1; i < ttRows.Count; i++)
                {
                    var dict = (IDictionary<string, object>)ttRows[i];
                    var vals = dict.Values.ToList();
                    if (vals.Count >= 2)
                    {
                        var appNo = vals[0]?.ToString()?.Trim();
                        if (!string.IsNullOrWhiteSpace(appNo) && decimal.TryParse(vals[1]?.ToString(), out var amt))
                        {
                            var type = vals.Count > 2 ? vals[2]?.ToString()?.Trim() : null;
                            DateTime? dt = null;
                            if (vals.Count > 3 && vals[3] is DateTime d) dt = d;
                            else if (vals.Count > 3 && DateTime.TryParse(vals[3]?.ToString(), out var parsed)) dt = parsed;

                            await using var ttCmd = new NpgsqlCommand(
                                @"INSERT INTO early_settlement (batch_id, appendix_number, settlement_amount, settlement_type, settlement_date)
                                  VALUES (@batchId, @appNo, @amt, @type, @dt);", connection, transaction);
                            ttCmd.Parameters.AddWithValue("batchId", batchId);
                            ttCmd.Parameters.AddWithValue("appNo", appNo);
                            ttCmd.Parameters.AddWithValue("amt", amt);
                            ttCmd.Parameters.AddWithValue("type", (object?)type ?? DBNull.Value);
                            ttCmd.Parameters.AddWithValue("dt", (object?)dt ?? DBNull.Value);
                            await ttCmd.ExecuteNonQueryAsync();
                            earlySettleCount++;
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to import 'Tất toán trước hạn' sheet");
            }

            // 8. Import 'raw' sheet streaming with NpgsqlBinaryImporter
            memoryStream.Position = 0;
            var rawRows = memoryStream.Query(sheetName: "raw").ToList();
            if (rawRows.Count < 5)
            {
                throw new InvalidOperationException("Sheet 'raw' không có đủ dữ liệu (tối thiểu cần 5 dòng header).");
            }

            // Extract date headers from row 4 (0-based index 3)
            var row4Vals = ((IDictionary<string, object>)rawRows[3]).Values.ToList();
            var dailyDateMap = new Dictionary<int, DateTime>(); // colIndex -> Date
            for (int c = 49; c < Math.Min(80, row4Vals.Count); c++)
            {
                if (row4Vals[c] is DateTime dt)
                {
                    dailyDateMap[c] = dt;
                }
                else if (row4Vals[c] != null && DateTime.TryParse(row4Vals[c].ToString(), out var dtParsed))
                {
                    dailyDateMap[c] = dtParsed;
                }
            }

            int contractCount = 0;
            decimal totalValue = 0;
            decimal totalBalance = 0;

            // Structure to hold daily balances for bulk copy
            var dailyBalancesToInsert = new List<(long contractId, DateTime date, decimal amount)>();

            // Bulk import contracts using binary copy
            await using (var writer = await connection.BeginBinaryImportAsync(
                @"COPY contract (
                    batch_id, stt, appendix_number, contract_number, customer_code, customer_name,
                    product_name_raw, product_group, term_raw, term_group, interest_rate_raw, interest_rate,
                    estimated_interest, interest_payment_method, contract_value, liquidated_amount,
                    sign_date, expire_date, liquidate_date, is_liquidated, status, channel, settlement_channel,
                    user_active, ds_type, partial_settle_date, partial_settle_amount, dsqd_no_early_withdraw,
                    dsqd_early_withdraw, id_sale_intro, sale_id, final_sale_id, final_sale_name,
                    manager_l1_id, manager_l1_name, manager_l2_id, manager_l3_id, manager_l4_id,
                    sale_branch, sale_department, transaction_office, balance_prev_day, balance_prev_month_end,
                    balance_prev_week_end, balance_current, raw_json
                ) FROM STDIN (FORMAT BINARY);"))
            {
                // Data rows start from row 6 (0-based index 5)
                for (int r = 5; r < rawRows.Count; r++)
                {
                    var rowDict = (IDictionary<string, object>)rawRows[r];
                    var cols = rowDict.Values.ToList();
                    if (cols.Count < 10) continue;

                    var appNo = cols.Count > 1 ? cols[1]?.ToString()?.Trim() : null;
                    if (string.IsNullOrWhiteSpace(appNo)) continue;

                    contractCount++;
                    int? stt = int.TryParse(cols[0]?.ToString(), out var sttVal) ? sttVal : null;
                    var prodRaw = cols.Count > 2 ? cols[2]?.ToString()?.Trim() : null;
                    var custCode = cols.Count > 3 ? cols[3]?.ToString()?.Trim() : null;
                    var custName = cols.Count > 4 ? cols[4]?.ToString()?.Trim() : null;
                    var termRaw = cols.Count > 5 ? cols[5]?.ToString()?.Trim() : null;
                    var rateRaw = cols.Count > 6 ? cols[6]?.ToString()?.Trim() : null;
                    decimal? rateVal = ParsePercentage(rateRaw);
                    decimal estInterest = cols.Count > 7 && decimal.TryParse(cols[7]?.ToString(), out var ei) ? ei : 0;
                    var payMethod = cols.Count > 8 ? cols[8]?.ToString()?.Trim() : null;
                    decimal val = cols.Count > 9 && decimal.TryParse(cols[9]?.ToString(), out var v) ? v : 0;
                    decimal liqAmt = cols.Count > 10 && decimal.TryParse(cols[10]?.ToString(), out var la) ? la : 0;

                    DateTime? signDate = cols.Count > 20 ? ParseDate(cols[20]) : null;
                    DateTime? expDate = cols.Count > 21 ? ParseDate(cols[21]) : null;
                    DateTime? liqDate = cols.Count > 22 ? ParseDate(cols[22]) : null;
                    bool isLiq = cols.Count > 10 && cols[10]?.ToString() == "1";

                    var status = cols.Count > 17 ? cols[17]?.ToString()?.Trim() : null;
                    var channel = cols.Count > 18 ? cols[18]?.ToString()?.Trim() : null;
                    var settleChan = cols.Count > 19 ? cols[19]?.ToString()?.Trim() : null;
                    var contractNo = cols.Count > 23 ? cols[23]?.ToString()?.Trim() : null;
                    int userActive = cols.Count > 24 && int.TryParse(cols[24]?.ToString(), out var ua) ? ua : 0;

                    var dsType = cols.Count > 25 ? cols[25]?.ToString()?.Trim() : "v";
                    if (excludedSet.Contains(appNo)) dsType = "x";

                    DateTime? partSettleDate = cols.Count > 26 ? ParseDate(cols[26]) : null;
                    decimal partSettleAmt = cols.Count > 27 && decimal.TryParse(cols[27]?.ToString(), out var psa) ? psa : 0;
                    decimal dsqdNoEarly = cols.Count > 28 && decimal.TryParse(cols[28]?.ToString(), out var dne) ? dne : 0;
                    decimal dsqdEarly = cols.Count > 80 && decimal.TryParse(cols[80]?.ToString(), out var de) ? de : 0;

                    var idSaleIntro = cols.Count > 14 ? cols[14]?.ToString()?.Trim() : null;
                    var saleId = cols.Count > 30 ? cols[30]?.ToString()?.Trim() : null;
                    var finalSaleId = cols.Count > 31 ? cols[31]?.ToString()?.Trim() : null;
                    if (exceptionsMap.TryGetValue(appNo, out var excSaleId)) finalSaleId = excSaleId;

                    var finalSaleName = cols.Count > 32 ? cols[32]?.ToString()?.Trim() : null;
                    var m1Id = cols.Count > 33 ? cols[33]?.ToString()?.Trim() : null;
                    var m1Name = cols.Count > 34 ? cols[34]?.ToString()?.Trim() : null;
                    var m2Id = cols.Count > 35 ? cols[35]?.ToString()?.Trim() : null;
                    var m3Id = cols.Count > 36 ? cols[36]?.ToString()?.Trim() : null;
                    var m4Id = cols.Count > 37 ? cols[37]?.ToString()?.Trim() : null;

                    var saleBranch = cols.Count > 40 ? cols[40]?.ToString()?.Trim() : null;
                    var saleDept = cols.Count > 41 ? cols[41]?.ToString()?.Trim() : null;
                    var prodGroup = cols.Count > 42 && !string.IsNullOrWhiteSpace(cols[42]?.ToString())
                        ? cols[42]?.ToString()?.Trim()!
                        : MapProductGroup(prodRaw);
                    var termGroup = MapTermGroup(termRaw);
                    var transOffice = cols.Count > 16 ? cols[16]?.ToString()?.Trim() : null;

                    decimal balPrevDay = cols.Count > 43 && decimal.TryParse(cols[43]?.ToString(), out var bpd) ? bpd : 0;
                    decimal balPrevMonth = cols.Count > 44 && decimal.TryParse(cols[44]?.ToString(), out var bpm) ? bpm : 0;
                    decimal balPrevWeek = cols.Count > 45 && decimal.TryParse(cols[45]?.ToString(), out var bpw) ? bpw : 0;
                    decimal balCur = cols.Count > 46 && decimal.TryParse(cols[46]?.ToString(), out var bc) ? bc : 0;

                    totalValue += val;
                    totalBalance += balCur;

                    // Serialize raw snapshot
                    var rawJson = JsonSerializer.Serialize(cols);

                    await writer.StartRowAsync();
                    await writer.WriteAsync(batchId, NpgsqlDbType.Integer);
                    await writer.WriteAsync(stt, NpgsqlDbType.Integer);
                    await writer.WriteAsync(appNo, NpgsqlDbType.Varchar);
                    await writer.WriteAsync(contractNo, NpgsqlDbType.Varchar);
                    await writer.WriteAsync(custCode, NpgsqlDbType.Varchar);
                    await writer.WriteAsync(custName, NpgsqlDbType.Varchar);
                    await writer.WriteAsync(prodRaw, NpgsqlDbType.Varchar);
                    await writer.WriteAsync(prodGroup, NpgsqlDbType.Varchar);
                    await writer.WriteAsync(termRaw, NpgsqlDbType.Varchar);
                    await writer.WriteAsync(termGroup, NpgsqlDbType.Varchar);
                    await writer.WriteAsync(rateRaw, NpgsqlDbType.Varchar);
                    await writer.WriteAsync(rateVal, NpgsqlDbType.Numeric);
                    await writer.WriteAsync(estInterest, NpgsqlDbType.Numeric);
                    await writer.WriteAsync(payMethod, NpgsqlDbType.Varchar);
                    await writer.WriteAsync(val, NpgsqlDbType.Numeric);
                    await writer.WriteAsync(liqAmt, NpgsqlDbType.Numeric);
                    await writer.WriteAsync(signDate, NpgsqlDbType.Date);
                    await writer.WriteAsync(expDate, NpgsqlDbType.Date);
                    await writer.WriteAsync(liqDate, NpgsqlDbType.Date);
                    await writer.WriteAsync(isLiq, NpgsqlDbType.Boolean);
                    await writer.WriteAsync(status, NpgsqlDbType.Varchar);
                    await writer.WriteAsync(channel, NpgsqlDbType.Varchar);
                    await writer.WriteAsync(settleChan, NpgsqlDbType.Varchar);
                    await writer.WriteAsync(userActive, NpgsqlDbType.Integer);
                    await writer.WriteAsync(dsType, NpgsqlDbType.Char);
                    await writer.WriteAsync(partSettleDate, NpgsqlDbType.Date);
                    await writer.WriteAsync(partSettleAmt, NpgsqlDbType.Numeric);
                    await writer.WriteAsync(dsqdNoEarly, NpgsqlDbType.Numeric);
                    await writer.WriteAsync(dsqdEarly, NpgsqlDbType.Numeric);
                    await writer.WriteAsync(idSaleIntro, NpgsqlDbType.Varchar);
                    await writer.WriteAsync(saleId, NpgsqlDbType.Varchar);
                    await writer.WriteAsync(finalSaleId, NpgsqlDbType.Varchar);
                    await writer.WriteAsync(finalSaleName, NpgsqlDbType.Varchar);
                    await writer.WriteAsync(m1Id, NpgsqlDbType.Varchar);
                    await writer.WriteAsync(m1Name, NpgsqlDbType.Varchar);
                    await writer.WriteAsync(m2Id, NpgsqlDbType.Varchar);
                    await writer.WriteAsync(m3Id, NpgsqlDbType.Varchar);
                    await writer.WriteAsync(m4Id, NpgsqlDbType.Varchar);
                    await writer.WriteAsync(saleBranch, NpgsqlDbType.Varchar);
                    await writer.WriteAsync(saleDept, NpgsqlDbType.Varchar);
                    await writer.WriteAsync(transOffice, NpgsqlDbType.Varchar);
                    await writer.WriteAsync(balPrevDay, NpgsqlDbType.Numeric);
                    await writer.WriteAsync(balPrevMonth, NpgsqlDbType.Numeric);
                    await writer.WriteAsync(balPrevWeek, NpgsqlDbType.Numeric);
                    await writer.WriteAsync(balCur, NpgsqlDbType.Numeric);
                    await writer.WriteAsync(rawJson, NpgsqlDbType.Jsonb);
                }
                await writer.CompleteAsync();
            }

            // 9. Update batch totals and status
            await using (var updateBatchCmd = new NpgsqlCommand(
                @"UPDATE import_batch 
                  SET total_rows = @rows, total_value = @val, total_balance = @bal, status = 'SUCCESS'
                  WHERE id = @id;", connection, transaction))
            {
                updateBatchCmd.Parameters.AddWithValue("rows", contractCount);
                updateBatchCmd.Parameters.AddWithValue("val", totalValue);
                updateBatchCmd.Parameters.AddWithValue("bal", totalBalance);
                updateBatchCmd.Parameters.AddWithValue("id", batchId);
                await updateBatchCmd.ExecuteNonQueryAsync();
            }

            await transaction.CommitAsync();
            sw.Stop();

            _logger.LogInformation("Import completed successfully for batch #{BatchId} in {Elapsed}s. {Count} contracts imported.",
                batchId, sw.Elapsed.TotalSeconds, contractCount);

            return new UploadResultDto
            {
                BatchId = batchId,
                FileName = fileName,
                ReportDate = reportDate,
                TotalRows = contractCount,
                TotalValue = totalValue,
                TotalBalance = totalBalance,
                TotalEmployees = employeeCount,
                TotalEarlySettlements = earlySettleCount,
                TotalExceptions = exceptionsMap.Count,
                TotalExcluded = excludedSet.Count,
                Status = "SUCCESS",
                Message = $"Đã import thành công {contractCount:N0} hợp đồng và đầy đủ 6 sheet vào Database.",
                ElapsedSeconds = Math.Round(sw.Elapsed.TotalSeconds, 2)
            };
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            _logger.LogError(ex, "Import failed for batch #{BatchId}", batchId);

            await using (var failCmd = new NpgsqlCommand(
                "UPDATE import_batch SET status = 'FAILED', error_message = @err WHERE id = @id;", connection))
            {
                failCmd.Parameters.AddWithValue("err", ex.Message);
                failCmd.Parameters.AddWithValue("id", batchId);
                await failCmd.ExecuteNonQueryAsync();
            }

            throw;
        }
    }

    private static decimal? ParsePercentage(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        raw = raw.Replace("%", "").Trim();
        if (decimal.TryParse(raw, out var val))
        {
            return val / 100m;
        }
        return null;
    }

    private static DateTime? ParseDate(object? val)
    {
        if (val == null) return null;
        if (val is DateTime dt) return dt;
        if (DateTime.TryParse(val.ToString(), out var parsed)) return parsed;
        return null;
    }

    private static string MapProductGroup(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return "SP khác";
        var upper = raw.ToUpperInvariant();
        if (upper.Contains("SHIELD")) return "Finra Shield";
        if (upper.Contains("STAR")) return "Finra Star";
        if (upper.Contains("SNAP")) return "Finra Snap";
        if (upper.Contains("SAFE")) return "Finra Safe";
        if (upper.Contains("SMART")) return "Finra Smart";
        return "SP khác";
    }

    private static string MapTermGroup(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return "Không thời hạn";
        var lower = raw.ToLowerInvariant();
        if (lower.Contains("tuần") || lower.Contains("ngày")) return "Dưới 1 tháng";
        if (lower.Contains("1 tháng") || lower.Contains("2 tháng")) return "1-3 tháng";
        if (lower.Contains("3 tháng") || lower.Contains("4 tháng") || lower.Contains("5 tháng")) return "3-6 tháng";
        if (lower.Contains("6 tháng") || lower.Contains("7 tháng") || lower.Contains("8 tháng") ||
            lower.Contains("9 tháng") || lower.Contains("11 tháng") || lower.Contains("12 tháng")) return "6-12 tháng";
        return "Không thời hạn";
    }
}
