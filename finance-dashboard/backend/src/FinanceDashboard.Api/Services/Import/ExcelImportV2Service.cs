using System.Data;
using System.Text.Json;
using Dapper;
using FinanceDashboard.Api.Data;
using FinanceDashboard.Api.DTOs.V1;
using FinanceDashboard.Api.Models.Versioned;
using MiniExcelLibs;

namespace FinanceDashboard.Api.Services.Import;

public class ExcelImportV2Service
{
    private readonly DbConnectionFactory _db;
    private readonly ILogger<ExcelImportV2Service> _logger;

    public ExcelImportV2Service(DbConnectionFactory db, ILogger<ExcelImportV2Service> logger)
    {
        _db = db;
        _logger = logger;
    }

    public static string NormalizeStatus(string? rawStatus)
    {
        if (string.IsNullOrWhiteSpace(rawStatus)) return "APPROVED";
        var s = ExcelParserHelper.NormalizeHeader(rawStatus);
        if (s.Contains("da thanh ly") || s.Contains("liquidated") || s.Contains("thanh ly")) return "LIQUIDATED";
        if (s.Contains("cho duyet") || s.Contains("pending") || s.Contains("cho")) return "PENDING";
        if (s.Contains("tam ung") || s.Contains("advancing")) return "ADVANCING";
        if (s.Contains("tu choi") || s.Contains("rejected")) return "REJECTED";
        if (s.Contains("da duyet") || s.Contains("approved") || s.Contains("duyet")) return "APPROVED";
        return rawStatus.Trim().ToUpperInvariant();
    }

    public static string NormalizeChannel(string? rawChannel)
    {
        if (string.IsNullOrWhiteSpace(rawChannel)) return "APP_FINRA";
        var s = ExcelParserHelper.NormalizeHeader(rawChannel);
        if (s.Contains("app")) return "APP_FINRA";
        if (s.Contains("backoffice") || s.Contains("bo")) return "BO_FINRA";
        if (s.Contains("upsc")) return "UPSC";
        return rawChannel.Trim().ToUpperInvariant();
    }

    public async Task<ImportPreviewResponse> GeneratePreviewAsync(
        Stream fileStream,
        string fileName,
        ImportPreviewRequest request,
        string username)
    {
        var fileSha256 = ExcelParserHelper.ComputeStreamSha256(fileStream);

        // Copy stream to memory stream for repeated reads
        using var memoryStream = new MemoryStream();
        await fileStream.CopyToAsync(memoryStream);
        memoryStream.Position = 0;

        // Auto-detect sheet and header
        var sheetNames = MiniExcel.GetSheetNames(memoryStream);
        var targetSheet = sheetNames.FirstOrDefault() ?? "Sheet1";
        if (sheetNames.Contains("list", StringComparer.OrdinalIgnoreCase))
        {
            targetSheet = sheetNames.First(s => s.Equals("list", StringComparison.OrdinalIgnoreCase));
        }

        memoryStream.Position = 0;
        var rows = MiniExcel.Query(memoryStream, useHeaderRow: false, sheetName: targetSheet).ToList();

        if (rows.Count == 0)
        {
            throw new InvalidOperationException("File Excel không có dữ liệu.");
        }

        // Find header row (scan first 15 rows)
        int headerRowIndex = -1;
        Dictionary<string, int> headerMap = new(StringComparer.OrdinalIgnoreCase);
        string detectedType = request.SourceType?.ToUpperInvariant() ?? string.Empty;

        for (int r = 0; r < Math.Min(15, rows.Count); r++)
        {
            var rowDict = (IDictionary<string, object>)rows[r];
            var colNames = rowDict.Values
                .Where(v => v != null)
                .Select(v => ExcelParserHelper.NormalizeHeader(v.ToString()!))
                .Where(s => !string.IsNullOrWhiteSpace(s))
                .ToList();

            // Detect source type if not specified
            if (string.IsNullOrEmpty(detectedType) && colNames.Count >= 4)
            {
                if (colNames.Any(c => c.Contains("id sale thay doi") || c.Contains("sale thay doi")))
                {
                    detectedType = "EXCEPTION";
                }
                else if (colNames.Any(c => c.Contains("so tien tat toan") || c.Contains("ngay tat toan")))
                {
                    detectedType = "SETTLEMENT";
                }
                else if (colNames.Any(c => c.Contains("id ql1") || c.Contains("phong kd") || c.Contains("chuc vu")))
                {
                    detectedType = "EMPLOYEE";
                }
                else if (colNames.Any(c => c.Contains("ten san pham") || c.Contains("san pham")))
                {
                    detectedType = "APPENDIX";
                }
                else if (colNames.Any(c => c.Contains("gia tri") && c.Contains("so phu luc")))
                {
                    detectedType = "STOCK";
                }
            }

            // Check if this row is the header (R08 & R10: require colNames.Count >= 4 to skip banner titles)
            if (colNames.Count >= 4 && colNames.Any(c => c.Contains("so phu luc") || c.Contains("ma kh") || c.Contains("chuc vu") || c.Contains("id ql1") || c.Contains("stt")))
            {
                headerRowIndex = r;
                int colIdx = 0;
                foreach (var kvp in rowDict)
                {
                    var val = kvp.Value?.ToString();
                    if (!string.IsNullOrWhiteSpace(val))
                    {
                        var norm = ExcelParserHelper.NormalizeHeader(val);
                        if (!headerMap.ContainsKey(norm))
                        {
                            headerMap[norm] = colIdx;
                        }
                    }
                    colIdx++;
                }
                break;
            }
        }

        if (string.IsNullOrEmpty(detectedType))
        {
            detectedType = "APPENDIX"; // Default fallback
        }

        if (headerRowIndex == -1)
        {
            throw new InvalidOperationException("Không tìm thấy dòng tiêu đề cột hợp lệ trong 15 dòng đầu.");
        }

        // Create source_batch in DB
        using var connection = _db.CreateNpgsqlConnection();
        await connection.OpenAsync();

        var batchId = await connection.ExecuteScalarAsync<long>(@"
            INSERT INTO source_batch (
                source_type, file_name, file_sha256, source_date, effective_date,
                mapping_version, status, uploaded_by, uploaded_at
            ) VALUES (
                @SourceType, @FileName, @FileSha256, @SourceDate, @EffectiveDate,
                'v1', 'STAGING', @UploadedBy, now()
            ) RETURNING id;",
            new
            {
                SourceType = detectedType,
                FileName = fileName,
                FileSha256 = fileSha256,
                SourceDate = request.SourceDate,
                EffectiveDate = request.EffectiveDate ?? request.SourceDate,
                UploadedBy = username
            });

        // Parse records row by row
        var stagingRecords = new List<ImportStagingRecord>();
        var recordDtos = new List<StagingRecordDto>();

        for (int r = headerRowIndex + 1; r < rows.Count; r++)
        {
            var rowDict = (IDictionary<string, object>)rows[r];
            var rowVals = rowDict.Values.Cast<object?>().ToList();

            // Skip empty rows
            if (rowVals.All(v => v == null || string.IsNullOrWhiteSpace(v.ToString())))
            {
                continue;
            }

            var staging = ParseRowToStaging(r + 1, targetSheet, detectedType, rowVals, headerMap, batchId);
            
            // Skip report footer / signature / summary rows
            if (staging.Classification == "INVALID" && IsReportFooterRow(rowVals, staging.EntityKey))
            {
                continue;
            }

            stagingRecords.Add(staging);
        }

        // Compare fingerprints with existing database records to classify: NEW, UNCHANGED, CHANGED
        await ClassifyStagingRecordsAsync(connection, detectedType, stagingRecords);

        // Batch insert staging records
        foreach (var stg in stagingRecords)
        {
            stg.Id = await connection.ExecuteScalarAsync<long>(@"
                INSERT INTO import_staging_record (
                    batch_id, source_type, sheet_name, row_index, entity_key,
                    fingerprint, classification, parsed_json, raw_selected_json,
                    diff_json, validation_errors, resolution_action, created_at
                ) VALUES (
                    @BatchId, @SourceType, @SheetName, @RowIndex, @EntityKey,
                    @Fingerprint, @Classification, @ParsedJson::jsonb, @RawSelectedJson::jsonb,
                    @DiffJson::jsonb, @ValidationErrors::jsonb, @ResolutionAction, now()
                ) RETURNING id;", stg);

            recordDtos.Add(new StagingRecordDto
            {
                Id = stg.Id,
                RowIndex = stg.RowIndex,
                SheetName = stg.SheetName,
                EntityKey = stg.EntityKey,
                Classification = stg.Classification,
                ParsedData = JsonSerializer.Deserialize<object>(stg.ParsedJson),
                DiffData = !string.IsNullOrEmpty(stg.DiffJson) ? JsonSerializer.Deserialize<object>(stg.DiffJson) : null,
                ValidationErrors = !string.IsNullOrEmpty(stg.ValidationErrors)
                    ? JsonSerializer.Deserialize<List<string>>(stg.ValidationErrors) ?? new()
                    : new(),
                ResolutionAction = stg.ResolutionAction
            });
        }

        // Count totals
        int totalNew = stagingRecords.Count(s => s.Classification == "NEW");
        int totalUnchanged = stagingRecords.Count(s => s.Classification == "UNCHANGED");
        int totalChanged = stagingRecords.Count(s => s.Classification == "CHANGED");
        int totalAmbiguous = stagingRecords.Count(s => s.Classification == "AMBIGUOUS");
        int totalInvalid = stagingRecords.Count(s => s.Classification == "INVALID");

        // Update batch counts
        await connection.ExecuteAsync(@"
            UPDATE source_batch SET
                total_rows = @Total,
                new_rows = @NewRows,
                unchanged_rows = @Unchanged,
                changed_rows = @Changed,
                ambiguous_rows = @Ambiguous,
                invalid_rows = @Invalid,
                status = 'PREVIEWED'
            WHERE id = @BatchId;",
            new
            {
                Total = stagingRecords.Count,
                NewRows = totalNew,
                Unchanged = totalUnchanged,
                Changed = totalChanged,
                Ambiguous = totalAmbiguous,
                Invalid = totalInvalid,
                BatchId = batchId
            });

        // Insert Preview record
        var previewId = Guid.NewGuid();
        await connection.ExecuteAsync(@"
            INSERT INTO import_preview (
                id, batch_id, expected_revision, total_new, total_unchanged,
                total_changed, total_ambiguous, total_invalid, created_at, created_by
            ) VALUES (
                @PreviewId, @BatchId, 1, @TotalNew, @TotalUnchanged,
                @TotalChanged, @TotalAmbiguous, @TotalInvalid, now(), @CreatedBy
            );",
            new
            {
                PreviewId = previewId,
                BatchId = batchId,
                TotalNew = totalNew,
                TotalUnchanged = totalUnchanged,
                TotalChanged = totalChanged,
                TotalAmbiguous = totalAmbiguous,
                TotalInvalid = totalInvalid,
                CreatedBy = username
            });

        var errorsList = new List<ImportRowErrorDto>();
        foreach (var inv in stagingRecords.Where(s => s.Classification == "INVALID"))
        {
            var errs = !string.IsNullOrEmpty(inv.ValidationErrors)
                ? JsonSerializer.Deserialize<List<string>>(inv.ValidationErrors) ?? new()
                : new List<string> { "Dữ liệu dòng không hợp lệ." };

            errorsList.Add(new ImportRowErrorDto
            {
                RowIndex = inv.RowIndex,
                EntityKey = inv.EntityKey,
                ValidationErrors = errs
            });
        }

        var warnings = new List<string>();
        if (totalAmbiguous > 0)
        {
            warnings.Add($"Có {totalAmbiguous} dòng dữ liệu mơ hồ cần người dùng chỉ định đối tượng trước khi công bố.");
        }
        if (totalInvalid > 0)
        {
            warnings.Add($"Phát hiện {totalInvalid} dòng không hợp lệ trong file Excel:");
            foreach (var errItem in errorsList.Take(15))
            {
                warnings.Add($"• Dòng {errItem.RowIndex} (Khóa: {errItem.EntityKey ?? "Trống"}): {string.Join("; ", errItem.ValidationErrors)}");
            }
            if (errorsList.Count > 15)
            {
                warnings.Add($"... và còn {errorsList.Count - 15} dòng lỗi khác.");
            }
        }

        // Prioritize: show all INVALID and AMBIGUOUS rows first, then others up to 300 items
        var prioritizedDtos = recordDtos.Where(r => r.Classification == "INVALID" || r.Classification == "AMBIGUOUS")
            .Concat(recordDtos.Where(r => r.Classification != "INVALID" && r.Classification != "AMBIGUOUS"))
            .Take(300)
            .ToList();

        return new ImportPreviewResponse
        {
            PreviewId = previewId,
            BatchId = batchId,
            SourceType = detectedType,
            FileName = fileName,
            FileSha256 = fileSha256,
            ExpectedRevision = 1,
            TotalRows = stagingRecords.Count,
            NewRows = totalNew,
            UnchangedRows = totalUnchanged,
            ChangedRows = totalChanged,
            AmbiguousRows = totalAmbiguous,
            InvalidRows = totalInvalid,
            Errors = errorsList,
            Items = prioritizedDtos,
            Warnings = warnings,
            IsStale = false
        };
    }

    public async Task<ImportPreviewResponse?> GetPreviewAsync(Guid previewId, int page = 1, int pageSize = 100)
    {
        using var connection = _db.CreateNpgsqlConnection();
        await connection.OpenAsync();

        var preview = await connection.QueryFirstOrDefaultAsync<ImportPreview>(@"
            SELECT * FROM import_preview WHERE id = @PreviewId;", new { PreviewId = previewId });

        if (preview == null) return null;

        var batch = await connection.QueryFirstOrDefaultAsync<SourceBatch>(@"
            SELECT * FROM source_batch WHERE id = @BatchId;", new { BatchId = preview.BatchId });

        if (batch == null) return null;

        int offset = (page - 1) * pageSize;
        var staging = (await connection.QueryAsync<ImportStagingRecord>(@"
            SELECT * FROM import_staging_record
            WHERE batch_id = @BatchId
            ORDER BY row_index
            OFFSET @Offset LIMIT @Limit;",
            new { BatchId = preview.BatchId, Offset = offset, Limit = pageSize })).ToList();

        var dtos = staging.Select(s => new StagingRecordDto
        {
            Id = s.Id,
            RowIndex = s.RowIndex,
            SheetName = s.SheetName,
            EntityKey = s.EntityKey,
            Classification = s.Classification,
            ParsedData = JsonSerializer.Deserialize<object>(s.ParsedJson),
            DiffData = !string.IsNullOrEmpty(s.DiffJson) ? JsonSerializer.Deserialize<object>(s.DiffJson) : null,
            ValidationErrors = !string.IsNullOrEmpty(s.ValidationErrors)
                ? JsonSerializer.Deserialize<List<string>>(s.ValidationErrors) ?? new()
                : new(),
            ResolutionAction = s.ResolutionAction
        }).ToList();

        var invalidItems = staging.Where(s => s.Classification == "INVALID").Select(s => new ImportRowErrorDto
        {
            RowIndex = s.RowIndex,
            EntityKey = s.EntityKey,
            ValidationErrors = !string.IsNullOrEmpty(s.ValidationErrors)
                ? JsonSerializer.Deserialize<List<string>>(s.ValidationErrors) ?? new()
                : new List<string>()
        }).ToList();

        return new ImportPreviewResponse
        {
            PreviewId = preview.Id,
            BatchId = batch.Id,
            SourceType = batch.SourceType,
            FileName = batch.FileName,
            FileSha256 = batch.FileSha256,
            ExpectedRevision = preview.ExpectedRevision,
            TotalRows = batch.TotalRows,
            NewRows = batch.NewRows,
            UnchangedRows = batch.UnchangedRows,
            ChangedRows = batch.ChangedRows,
            AmbiguousRows = batch.AmbiguousRows,
            InvalidRows = batch.InvalidRows,
            Errors = invalidItems,
            Items = dtos,
            IsStale = preview.IsStale
        };
    }

    public async Task<ImportConfirmResponse> ConfirmImportAsync(
        Guid previewId,
        ImportConfirmRequest request,
        string username)
    {
        if (string.IsNullOrWhiteSpace(request.IdempotencyKey))
        {
            throw new ArgumentException("IdempotencyKey là bắt buộc khi xác nhận import.");
        }

        using var connection = _db.CreateNpgsqlConnection();
        await connection.OpenAsync();
        using var transaction = connection.BeginTransaction();

        try
        {
            // 1. Lock and check preview
            var preview = await connection.QueryFirstOrDefaultAsync<ImportPreview>(@"
                SELECT * FROM import_preview WHERE id = @PreviewId FOR UPDATE;", 
                new { PreviewId = previewId }, transaction: transaction);

            if (preview == null)
            {
                throw new KeyNotFoundException("Không tìm thấy đợt preview tương ứng.");
            }

            // R12: Reject if stale or revision mismatch
            if (preview.IsStale || preview.ExpectedRevision != request.ExpectedRevision)
            {
                throw new InvalidOperationException("Preview đã lỗi thời (Stale Preview). Vui lòng làm mới lại bản xem trước.");
            }

            // 2. Lock and check source batch
            var batch = await connection.QueryFirstOrDefaultAsync<SourceBatch>(@"
                SELECT * FROM source_batch WHERE id = @BatchId FOR UPDATE;", 
                new { BatchId = preview.BatchId }, transaction: transaction);

            if (batch == null)
            {
                throw new KeyNotFoundException("Không tìm thấy đợt import nguồn.");
            }

            // R12: Check if batch already confirmed (Idempotent response)
            if (batch.Status == "CONFIRMED")
            {
                transaction.Commit();
                return new ImportConfirmResponse
                {
                    BatchId = batch.Id,
                    PreviewId = preview.Id,
                    SourceType = batch.SourceType,
                    ConfirmedRows = 0,
                    SkippedRows = 0,
                    Status = "ALREADY_CONFIRMED",
                    Message = "Đợt import này đã được xác nhận trước đó (Idempotent response)."
                };
            }

            // Check if idempotency key already processed
            var existingAudit = await connection.QueryFirstOrDefaultAsync<ImportConfirmAudit>(@"
                SELECT * FROM import_confirm_audit WHERE idempotency_key = @Key FOR UPDATE;",
                new { Key = request.IdempotencyKey }, transaction: transaction);

            if (existingAudit != null)
            {
                transaction.Commit();
                return new ImportConfirmResponse
                {
                    BatchId = existingAudit.BatchId,
                    PreviewId = existingAudit.PreviewId,
                    SourceType = batch.SourceType,
                    ConfirmedRows = 0,
                    SkippedRows = 0,
                    Status = "ALREADY_CONFIRMED",
                    Message = "Yêu cầu đã được xác nhận trước đó (Idempotent response)."
                };
            }

            // 3. Staging records verification
            var stagingRecords = (await connection.QueryAsync<ImportStagingRecord>(@"
                SELECT * FROM import_staging_record WHERE batch_id = @BatchId ORDER BY row_index;",
                new { BatchId = batch.Id }, transaction: transaction)).ToList();

            // R13: Reject unresolved AMBIGUOUS rows
            var unresolvedAmbiguous = stagingRecords.Where(s =>
                s.Classification == "AMBIGUOUS" &&
                !(request.RowResolutions != null && request.RowResolutions.TryGetValue(s.Id, out var act) &&
                  (act == "LINK_EXISTING" || act == "CREATE_NEW" || act == "SKIP"))).ToList();

            if (unresolvedAmbiguous.Count > 0)
            {
                throw new InvalidOperationException(
                    $"Có {unresolvedAmbiguous.Count} dòng dữ liệu mơ hồ (AMBIGUOUS) chưa được người dùng chỉ định đối tượng (LINK_EXISTING / CREATE_NEW / SKIP). Vui lòng xử lý toàn bộ trước khi xác nhận.");
            }

            int confirmedCount = 0;
            int skippedCount = 0;

            foreach (var stg in stagingRecords)
            {
                var action = stg.ResolutionAction;
                if (request.RowResolutions != null && request.RowResolutions.TryGetValue(stg.Id, out var overrideAct))
                {
                    action = overrideAct;
                }

                if (action == "SKIP" || stg.Classification == "INVALID")
                {
                    skippedCount++;
                    continue;
                }

                if (stg.Classification == "UNCHANGED" && action != "ACCEPT")
                {
                    skippedCount++;
                    continue;
                }

                // Apply to target versioned table (R05 & R14)
                await ApplyStagingRecordAsync(connection, transaction, batch, stg);
                confirmedCount++;
            }

            // Update batch status to CONFIRMED
            await connection.ExecuteAsync(@"
                UPDATE source_batch SET
                    status = 'CONFIRMED',
                    confirmed_by = @Username,
                    confirmed_at = now()
                WHERE id = @BatchId;",
                new { Username = username, BatchId = batch.Id }, transaction: transaction);

            // R12: Mark this preview and any pending previews for this batch/source_type as stale
            await connection.ExecuteAsync(@"
                UPDATE import_preview SET is_stale = TRUE WHERE id = @PreviewId;",
                new { PreviewId = preview.Id }, transaction: transaction);

            await connection.ExecuteAsync(@"
                UPDATE import_preview ip
                SET is_stale = TRUE
                FROM source_batch sb
                WHERE ip.batch_id = sb.id
                  AND sb.source_type = @SourceType
                  AND ip.id != @PreviewId
                  AND ip.is_stale = FALSE;",
                new { SourceType = batch.SourceType, PreviewId = preview.Id }, transaction: transaction);

            // Save audit
            await connection.ExecuteAsync(@"
                INSERT INTO import_confirm_audit (
                    preview_id, batch_id, idempotency_key, expected_revision,
                    actual_revision, decision_summary, reason, confirmed_by, confirmed_at
                ) VALUES (
                    @PreviewId, @BatchId, @Key, @ExpectedRev,
                    @ActualRev, @Summary::jsonb, @Reason, @ConfirmedBy, now()
                );",
                new
                {
                    PreviewId = preview.Id,
                    BatchId = batch.Id,
                    Key = request.IdempotencyKey,
                    ExpectedRev = request.ExpectedRevision,
                    ActualRev = request.ExpectedRevision,
                    Summary = JsonSerializer.Serialize(new { Confirmed = confirmedCount, Skipped = skippedCount }),
                    Reason = request.Reason ?? "Import confirmation",
                    ConfirmedBy = username
                }, transaction: transaction);

            transaction.Commit();

            return new ImportConfirmResponse
            {
                BatchId = batch.Id,
                PreviewId = preview.Id,
                SourceType = batch.SourceType,
                ConfirmedRows = confirmedCount,
                SkippedRows = skippedCount,
                Status = "CONFIRMED",
                Message = $"Xác nhận nạp thành công {confirmedCount} bản ghi vào hệ thống ({skippedCount} bản ghi bỏ qua)."
            };
        }
        catch (Exception ex)
        {
            transaction.Rollback();
            _logger.LogError(ex, "Lỗi khi confirm import batch {BatchId}", previewId);
            throw;
        }
    }

    private ImportStagingRecord ParseRowToStaging(
        int rowIndex,
        string sheetName,
        string sourceType,
        List<object?> vals,
        Dictionary<string, int> headerMap,
        long batchId)
    {
        object? GetVal(params string[] aliases)
        {
            foreach (var alias in aliases)
            {
                var norm = ExcelParserHelper.NormalizeHeader(alias);
                if (headerMap.TryGetValue(norm, out var idx) && idx < vals.Count)
                {
                    return vals[idx];
                }
            }
            // Fallback substring matching on normalized headers
            foreach (var alias in aliases)
            {
                var norm = ExcelParserHelper.NormalizeHeader(alias);
                foreach (var kvp in headerMap)
                {
                    if (kvp.Key.Contains(norm, StringComparison.OrdinalIgnoreCase) || 
                        norm.Contains(kvp.Key, StringComparison.OrdinalIgnoreCase))
                    {
                        if (kvp.Value < vals.Count)
                        {
                            return vals[kvp.Value];
                        }
                    }
                }
            }
            return null;
        }

        var errors = new List<string>();
        string entityKey = string.Empty;
        var parsedDict = new Dictionary<string, object?>();

        decimal ReadDecimal(string colLabel, params string[] aliases)
        {
            var raw = GetVal(aliases);
            if (raw == null || string.IsNullOrWhiteSpace(raw.ToString())) return 0m;
            if (ExcelParserHelper.TryParseDecimal(raw, out var parsedVal))
            {
                return parsedVal;
            }
            errors.Add($"Giá trị '{raw}' tại cột '{colLabel}' không phải số tiền hợp lệ.");
            return 0m;
        }

        switch (sourceType)
        {
            case "APPENDIX":
            case "EXCEPTION":
                var appNum = GetVal("so phu luc hop dong", "so phu luc (so hd)", "so phu luc", "so hd")?.ToString()?.Trim() ?? string.Empty;
                var custCode = ExcelParserHelper.FormatCustomerCode(GetVal("ma kh", "makh", "ma khach hang"));
                var custName = GetVal("ten kh", "ten khach hang")?.ToString()?.Trim() ?? string.Empty;
                var rawProdName = GetVal("ten san pham", "san pham", "ma sp", "ten sp", "san pham dau tu");
                var prodName = ExcelParserHelper.NormalizeProductName(rawProdName, appNum);
                var term = GetVal("ky han")?.ToString()?.Trim() ?? string.Empty;
                var val = ReadDecimal("Giá trị", "gia tri", "so tien", "gia tri hop dong");
                var liquidated = ReadDecimal("Đã thanh lý", "da thanh ly", "so tien da thanh ly");
                var signDate = ExcelParserHelper.ParseDate(GetVal("ngay ky", "ngay gia tri", "ngay hop dong"));
                var expDate = ExcelParserHelper.ParseDate(GetVal("ngay het han", "ngay dao han"));
                var liqDate = ExcelParserHelper.ParseDate(GetVal("ngay thanh ly"));
                var saleIntro = GetVal("id sale gioi thieu", "id sale", "sale gioi thieu", "sale");
                var (saleId, saleName) = ExcelParserHelper.ParseSaleIntro(saleIntro);
                var rawStatus = GetVal("trang thai")?.ToString();
                var status = NormalizeStatus(rawStatus);
                var rawChannel = GetVal("kenh", "kenh phan phoi")?.ToString();
                var channel = NormalizeChannel(rawChannel);

                entityKey = appNum;
                if (string.IsNullOrEmpty(appNum)) errors.Add("Thiếu Số phụ lục hợp đồng.");
                if (signDate == null) errors.Add("Ngày ký không hợp lệ hoặc bị trống.");

                parsedDict["appendix_number"] = appNum;
                parsedDict["customer_code"] = custCode;
                parsedDict["customer_name"] = custName;
                parsedDict["product_name"] = prodName;
                parsedDict["term"] = term;
                parsedDict["contract_value"] = val;
                parsedDict["liquidated_amount"] = liquidated;
                parsedDict["sign_date"] = signDate?.ToString("yyyy-MM-dd");
                parsedDict["expire_date"] = expDate?.ToString("yyyy-MM-dd");
                parsedDict["liquidate_date"] = liqDate?.ToString("yyyy-MM-dd");
                parsedDict["sale_id"] = saleId;
                parsedDict["sale_name"] = saleName;
                parsedDict["status"] = status;
                parsedDict["channel"] = channel;

                if (sourceType == "EXCEPTION")
                {
                    var newSaleId = GetVal("id sale thay doi", "sale thay doi", "new sale id")?.ToString()?.Trim() ?? string.Empty;
                    if (string.IsNullOrEmpty(newSaleId)) errors.Add("Thiếu ID Sale thay đổi trong file Ngoại lệ.");
                    parsedDict["new_sale_id"] = newSaleId;
                }
                break;

            case "SETTLEMENT":
                var setAppNum = GetVal("so phu luc (so hd)", "so phu luc hop dong", "so phu luc", "so hd")?.ToString()?.Trim() ?? string.Empty;
                var setCustCode = ExcelParserHelper.FormatCustomerCode(GetVal("ma kh", "makh", "ma khach hang"));
                var setCustName = GetVal("ten kh", "ten khach hang")?.ToString()?.Trim() ?? string.Empty;
                var txDate = ExcelParserHelper.ParseDate(GetVal("ngay giao dich", "ngay ky"));
                var setDate = ExcelParserHelper.ParseDate(GetVal("ngay tat toan"));
                var principal = ReadDecimal("Số tiền gốc", "so tien goc", "tien goc");
                var setTerm = GetVal("ky han")?.ToString()?.Trim();
                var setAmount = ReadDecimal("Số tiền tất toán", "so tien tat toan", "tien tat toan");
                var setSaleId = GetVal("id sale gan hd", "id sale gan hop dong", "id sale", "sale")?.ToString()?.Trim() ?? string.Empty;
                var setSaleName = GetVal("ten id sale gan hd", "ten sale")?.ToString()?.Trim();
                var setChannel = NormalizeChannel(GetVal("kenh", "kenh phan phoi")?.ToString());
                var rawSetProd = GetVal("ma sp", "ten sp", "san pham", "ten san pham");
                var setProdName = ExcelParserHelper.NormalizeProductName(rawSetProd, setAppNum);

                entityKey = setAppNum;
                if (string.IsNullOrEmpty(setAppNum)) errors.Add("Thiếu Số phụ lục.");
                if (setDate == null) errors.Add("Ngày tất toán không hợp lệ hoặc bị trống.");

                parsedDict["appendix_number"] = setAppNum;
                parsedDict["customer_code"] = setCustCode;
                parsedDict["customer_name"] = setCustName;
                parsedDict["product_name"] = setProdName;
                parsedDict["transaction_date"] = (txDate ?? setDate)?.ToString("yyyy-MM-dd");
                parsedDict["settlement_date"] = setDate?.ToString("yyyy-MM-dd");
                parsedDict["principal_amount"] = principal;
                parsedDict["term"] = setTerm;
                parsedDict["settlement_amount"] = setAmount;
                parsedDict["sale_id"] = setSaleId;
                parsedDict["sale_name"] = setSaleName;
                parsedDict["channel"] = setChannel;
                break;

            case "STOCK":
                var stockAppNum = GetVal("so phu luc hop dong", "so phu luc", "so hd")?.ToString()?.Trim() ?? "BOND";
                var stockCustCode = ExcelParserHelper.FormatCustomerCode(GetVal("ma kh", "makh", "ma khach hang"));
                var stockCustName = GetVal("ten kh", "ten khach hang")?.ToString()?.Trim() ?? string.Empty;
                var stockVal = ReadDecimal("Giá trị", "gia tri", "so tien");
                var stockLiq = ReadDecimal("Đã thanh lý", "da thanh ly");
                var stockSign = ExcelParserHelper.ParseDate(GetVal("ngay ky", "ngay hop dong"));
                var stockExp = ExcelParserHelper.ParseDate(GetVal("ngay het han"));
                var stockLiqDate = ExcelParserHelper.ParseDate(GetVal("ngay thanh ly"));
                var stockSale = GetVal("id sale gioi thieu", "id sale gan hd", "id sale", "sale")?.ToString()?.Trim() ?? string.Empty;

                entityKey = $"{stockAppNum}_{stockCustCode}_{stockSign:yyyyMMdd}";
                if (stockSign == null) errors.Add("Ngày ký hợp đồng chứng khoán bị trống.");

                parsedDict["appendix_number"] = stockAppNum;
                parsedDict["customer_code"] = stockCustCode;
                parsedDict["customer_name"] = stockCustName;
                parsedDict["contract_value"] = stockVal;
                parsedDict["liquidated_amount"] = stockLiq;
                parsedDict["sign_date"] = stockSign?.ToString("yyyy-MM-dd");
                parsedDict["expire_date"] = stockExp?.ToString("yyyy-MM-dd");
                parsedDict["liquidate_date"] = stockLiqDate?.ToString("yyyy-MM-dd");
                parsedDict["sale_id"] = stockSale;
                break;

            case "EMPLOYEE":
                var empId = GetVal("id", "ma nhan su", "ma nv", "manv")?.ToString()?.Trim() ?? string.Empty;
                var empName = GetVal("ho va ten", "ten", "ho ten")?.ToString()?.Trim() ?? string.Empty;
                var region = GetVal("mien")?.ToString()?.Trim();
                var branch = GetVal("chi nhanh")?.ToString()?.Trim();
                var pos = GetVal("chuc vu", "chuc danh")?.ToString()?.Trim() ?? "CVKD";
                var level = GetVal("cap")?.ToString()?.Trim();
                var dept = GetVal("phong kd", "phong")?.ToString()?.Trim();
                var mgrId = GetVal("id ql1", "id cap tren")?.ToString()?.Trim();
                var mgrName = GetVal("ql1", "cap tren")?.ToString()?.Trim();
                var accStatus = GetVal("trang thai id")?.ToString()?.Trim();
                var empStatus = GetVal("tinh trang")?.ToString()?.Trim();

                entityKey = empId;
                if (string.IsNullOrEmpty(empId)) errors.Add("Thiếu mã nhân sự (ID).");
                if (string.IsNullOrEmpty(empName)) errors.Add("Thiếu họ tên nhân sự.");

                parsedDict["employee_id"] = empId;
                parsedDict["full_name"] = empName;
                parsedDict["region"] = region;
                parsedDict["branch"] = branch;
                parsedDict["position"] = pos;
                parsedDict["source_level"] = level;
                parsedDict["department"] = dept;
                parsedDict["manager_employee_id"] = mgrId;
                parsedDict["manager_name"] = mgrName;
                parsedDict["source_account_status"] = accStatus;
                parsedDict["employment_status"] = empStatus;
                break;
        }

        var canonicalJson = JsonSerializer.Serialize(parsedDict);
        var fingerprint = ExcelParserHelper.ComputeSha256(canonicalJson);

        return new ImportStagingRecord
        {
            BatchId = batchId,
            SourceType = sourceType,
            SheetName = sheetName,
            RowIndex = rowIndex,
            EntityKey = entityKey,
            Fingerprint = fingerprint,
            Classification = errors.Count > 0 ? "INVALID" : "NEW",
            ParsedJson = canonicalJson,
            RawSelectedJson = canonicalJson,
            ValidationErrors = errors.Count > 0 ? JsonSerializer.Serialize(errors) : null,
            ResolutionAction = errors.Count > 0 ? "SKIP" : "ACCEPT"
        };
    }

    private async Task ClassifyStagingRecordsAsync(
        IDbConnection connection,
        string sourceType,
        List<ImportStagingRecord> stagingRecords)
    {
        foreach (var stg in stagingRecords.Where(s => s.Classification != "INVALID"))
        {
            if (string.IsNullOrEmpty(stg.EntityKey))
            {
                stg.Classification = "AMBIGUOUS";
                continue;
            }

            switch (sourceType)
            {
                case "APPENDIX":
                    var existingApp = await connection.QueryFirstOrDefaultAsync<ContractAppendixVersion>(@"
                        SELECT * FROM contract_appendix_version
                        WHERE appendix_number = @Key AND is_active_version = TRUE
                        ORDER BY version_num DESC LIMIT 1;",
                        new { Key = stg.EntityKey });

                    if (existingApp != null)
                    {
                        if (existingApp.Fingerprint == stg.Fingerprint)
                        {
                            stg.Classification = "UNCHANGED";
                            stg.ResolutionAction = "SKIP";
                        }
                        else
                        {
                            var parsed = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(stg.ParsedJson);
                            var diff = new Dictionary<string, object>();
                            
                            decimal newVal = parsed != null && parsed.TryGetValue("contract_value", out var pVal) ? pVal.GetDecimal() : 0m;
                            decimal newLiq = parsed != null && parsed.TryGetValue("liquidated_amount", out var pLiq) ? pLiq.GetDecimal() : 0m;
                            string newSale = parsed != null && parsed.TryGetValue("sale_id", out var pSale) ? pSale.GetString() ?? "" : "";
                            string newStat = parsed != null && parsed.TryGetValue("status", out var pStat) ? pStat.GetString() ?? "" : "";
                            string newChan = parsed != null && parsed.TryGetValue("channel", out var pChan) ? pChan.GetString() ?? "" : "";

                            if (existingApp.ContractValue != newVal) diff["ContractValue"] = new { Old = existingApp.ContractValue, New = newVal };
                            if (existingApp.LiquidatedAmount != newLiq) diff["LiquidatedAmount"] = new { Old = existingApp.LiquidatedAmount, New = newLiq };
                            if (existingApp.SaleId != newSale) diff["SaleId"] = new { Old = existingApp.SaleId, New = newSale };
                            if (existingApp.Status != newStat) diff["Status"] = new { Old = existingApp.Status, New = newStat };
                            if (existingApp.Channel != newChan) diff["Channel"] = new { Old = existingApp.Channel, New = newChan };

                            stg.Classification = "CHANGED";
                            stg.DiffJson = JsonSerializer.Serialize(diff);
                            stg.ResolutionAction = "ACCEPT";
                        }
                    }
                    break;

                case "EMPLOYEE":
                    var existingEmp = await connection.QueryFirstOrDefaultAsync<EmployeeHistory>(@"
                        SELECT * FROM employee_history
                        WHERE employee_id = @Key AND is_current = TRUE
                        ORDER BY valid_to DESC LIMIT 1;",
                        new { Key = stg.EntityKey });

                    if (existingEmp != null)
                    {
                        var parsed = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(stg.ParsedJson);
                        var newPos = parsed != null && parsed.TryGetValue("position", out var pPos) ? pPos.GetString() : null;
                        var newMgr = parsed != null && parsed.TryGetValue("manager_employee_id", out var pMgr) ? pMgr.GetString() : null;
                        var newDept = parsed != null && parsed.TryGetValue("department", out var pDept) ? pDept.GetString() : null;
                        var newBranch = parsed != null && parsed.TryGetValue("branch", out var pBranch) ? pBranch.GetString() : null;
                        var newName = parsed != null && parsed.TryGetValue("full_name", out var pName) ? pName.GetString() : null;

                        var diff = new Dictionary<string, object>();
                        if (existingEmp.Position != newPos) diff["Position"] = new { Old = existingEmp.Position, New = newPos };
                        if (existingEmp.ManagerEmployeeId != newMgr) diff["ManagerId"] = new { Old = existingEmp.ManagerEmployeeId, New = newMgr };
                        if (existingEmp.Department != newDept) diff["Department"] = new { Old = existingEmp.Department, New = newDept };
                        if (existingEmp.Branch != newBranch) diff["Branch"] = new { Old = existingEmp.Branch, New = newBranch };
                        if (existingEmp.FullName != newName) diff["FullName"] = new { Old = existingEmp.FullName, New = newName };

                        if (diff.Count == 0)
                        {
                            stg.Classification = "UNCHANGED";
                            stg.ResolutionAction = "SKIP";
                        }
                        else
                        {
                            stg.Classification = "CHANGED";
                            stg.DiffJson = JsonSerializer.Serialize(diff);
                            stg.ResolutionAction = "ACCEPT";
                        }
                    }
                    break;

                case "STOCK":
                    var existingStock = await connection.QueryFirstOrDefaultAsync<StockContractVersion>(@"
                        SELECT * FROM stock_contract_version
                        WHERE fingerprint = @Fp AND is_active_version = TRUE LIMIT 1;",
                        new { Fp = stg.Fingerprint });

                    if (existingStock != null)
                    {
                        stg.Classification = "UNCHANGED";
                        stg.ResolutionAction = "SKIP";
                    }
                    else
                    {
                        stg.Classification = "NEW";
                        stg.ResolutionAction = "ACCEPT";
                    }
                    break;

                case "SETTLEMENT":
                    var existingTx = await connection.QueryFirstOrDefaultAsync<ContractSettlementTransaction>(@"
                        SELECT * FROM contract_settlement_transaction
                        WHERE fingerprint = @Fp AND is_active_version = TRUE LIMIT 1;",
                        new { Fp = stg.Fingerprint });

                    if (existingTx != null)
                    {
                        stg.Classification = "UNCHANGED";
                        stg.ResolutionAction = "SKIP";
                    }
                    else
                    {
                        // Check if same appendix exists but has different amount
                        var parsed = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(stg.ParsedJson);
                        string txDateStr = parsed != null && parsed.TryGetValue("settlement_date", out var pDate) ? pDate.GetString() ?? "" : "";
                        
                        var existingSameDate = await connection.QueryFirstOrDefaultAsync<ContractSettlementTransaction>(@"
                            SELECT * FROM contract_settlement_transaction
                            WHERE appendix_number = @AppNum AND settlement_date = @TxDate::date AND is_active_version = TRUE LIMIT 1;",
                            new { AppNum = stg.EntityKey, TxDate = txDateStr });

                        if (existingSameDate != null)
                        {
                            decimal newAmt = parsed != null && parsed.TryGetValue("settlement_amount", out var pAmt) ? pAmt.GetDecimal() : 0m;
                            stg.Classification = "CHANGED";
                            stg.DiffJson = JsonSerializer.Serialize(new
                            {
                                SettlementAmount = new { Old = existingSameDate.SettlementAmount, New = newAmt }
                            });
                            stg.ResolutionAction = "ACCEPT";
                        }
                        else
                        {
                            stg.Classification = "NEW";
                            stg.ResolutionAction = "ACCEPT";
                        }
                    }
                    break;
            }
        }
    }

    private async Task ApplyStagingRecordAsync(
        IDbConnection connection,
        IDbTransaction transaction,
        SourceBatch batch,
        ImportStagingRecord stg)
    {
        var dict = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(stg.ParsedJson);
        if (dict == null) return;

        string GetStr(string key) => dict.TryGetValue(key, out var el) && el.ValueKind != JsonValueKind.Null ? el.GetString() ?? string.Empty : string.Empty;
        decimal GetDec(string key) => dict.TryGetValue(key, out var el) && el.ValueKind == JsonValueKind.Number ? el.GetDecimal() : 0m;
        DateOnly? GetDate(string key)
        {
            if (dict.TryGetValue(key, out var el) && el.ValueKind == JsonValueKind.String && DateOnly.TryParse(el.GetString(), out var d))
                return d;
            return null;
        }

        switch (batch.SourceType)
        {
            case "APPENDIX":
                var appNum = GetStr("appendix_number");
                var effDate = batch.EffectiveDate ?? DateOnly.FromDateTime(DateTime.Today);
                var signDate = GetDate("sign_date") ?? effDate;

                // R05: Check existing active version to preserve entity_id
                var existingApp = await connection.QueryFirstOrDefaultAsync<ContractAppendixVersion>(@"
                    SELECT * FROM contract_appendix_version
                    WHERE appendix_number = @AppNum AND is_active_version = TRUE
                    ORDER BY version_num DESC LIMIT 1;",
                    new { AppNum = appNum }, transaction);

                if (existingApp != null)
                {
                    // Close old active version with valid_to = effDate
                    await connection.ExecuteAsync(@"
                        UPDATE contract_appendix_version 
                        SET is_active_version = FALSE, valid_to = @EffDate
                        WHERE id = @OldId;",
                        new { EffDate = effDate, OldId = existingApp.Id }, transaction);

                    // Insert new version with SAME entity_id and incremented version_num
                    await connection.ExecuteAsync(@"
                        INSERT INTO contract_appendix_version (
                            entity_id, appendix_number, customer_code, customer_name,
                            product_name, term, contract_value, liquidated_amount,
                            sign_date, expire_date, liquidate_date, sale_id, sale_name,
                            status, channel, batch_id, version_num, valid_from, valid_to,
                            fingerprint, is_active_version, created_at
                        ) VALUES (
                            @EntityId, @AppendixNumber, @CustomerCode, @CustomerName,
                            @ProductName, @Term, @ContractValue, @LiquidatedAmount,
                            @SignDate, @ExpireDate, @LiquidateDate, @SaleId, @SaleName,
                            @Status, @Channel, @BatchId, @VersionNum, @ValidFrom, '9999-12-31',
                            @Fingerprint, TRUE, now()
                        );",
                        new
                        {
                            EntityId = existingApp.EntityId,
                            AppendixNumber = appNum,
                            CustomerCode = GetStr("customer_code"),
                            CustomerName = GetStr("customer_name"),
                            ProductName = GetStr("product_name"),
                            Term = GetStr("term"),
                            ContractValue = GetDec("contract_value"),
                            LiquidatedAmount = GetDec("liquidated_amount"),
                            SignDate = signDate,
                            ExpireDate = GetDate("expire_date"),
                            LiquidateDate = GetDate("liquidate_date"),
                            SaleId = GetStr("sale_id"),
                            SaleName = GetStr("sale_name"),
                            Status = GetStr("status"),
                            Channel = GetStr("channel"),
                            BatchId = batch.Id,
                            VersionNum = existingApp.VersionNum + 1,
                            ValidFrom = effDate,
                            Fingerprint = stg.Fingerprint
                        }, transaction);
                }
                else
                {
                    await connection.ExecuteAsync(@"
                        INSERT INTO contract_appendix_version (
                            entity_id, appendix_number, customer_code, customer_name,
                            product_name, term, contract_value, liquidated_amount,
                            sign_date, expire_date, liquidate_date, sale_id, sale_name,
                            status, channel, batch_id, version_num, valid_from, valid_to,
                            fingerprint, is_active_version, created_at
                        ) VALUES (
                            gen_random_uuid(), @AppendixNumber, @CustomerCode, @CustomerName,
                            @ProductName, @Term, @ContractValue, @LiquidatedAmount,
                            @SignDate, @ExpireDate, @LiquidateDate, @SaleId, @SaleName,
                            @Status, @Channel, @BatchId, 1, @SignDate, '9999-12-31',
                            @Fingerprint, TRUE, now()
                        );",
                        new
                        {
                            AppendixNumber = appNum,
                            CustomerCode = GetStr("customer_code"),
                            CustomerName = GetStr("customer_name"),
                            ProductName = GetStr("product_name"),
                            Term = GetStr("term"),
                            ContractValue = GetDec("contract_value"),
                            LiquidatedAmount = GetDec("liquidated_amount"),
                            SignDate = signDate,
                            ExpireDate = GetDate("expire_date"),
                            LiquidateDate = GetDate("liquidate_date"),
                            SaleId = GetStr("sale_id"),
                            SaleName = GetStr("sale_name"),
                            Status = GetStr("status"),
                            Channel = GetStr("channel"),
                            BatchId = batch.Id,
                            Fingerprint = stg.Fingerprint
                        }, transaction);
                }
                break;

            case "SETTLEMENT":
                var setAppNum = GetStr("appendix_number");
                var setDate = GetDate("settlement_date") ?? DateOnly.FromDateTime(DateTime.Today);
                
                // R14: Check if amending existing settlement transaction
                var existingSettle = await connection.QueryFirstOrDefaultAsync<ContractSettlementTransaction>(@"
                    SELECT * FROM contract_settlement_transaction
                    WHERE appendix_number = @AppNum AND settlement_date = @SetDate AND is_active_version = TRUE
                    ORDER BY version_num DESC LIMIT 1;",
                    new { AppNum = setAppNum, SetDate = setDate }, transaction);

                if (existingSettle != null)
                {
                    await connection.ExecuteAsync(@"
                        UPDATE contract_settlement_transaction SET is_active_version = FALSE WHERE id = @OldId;",
                        new { OldId = existingSettle.Id }, transaction);

                    await connection.ExecuteAsync(@"
                        INSERT INTO contract_settlement_transaction (
                            transaction_entity_id, appendix_number, customer_code, customer_name,
                            transaction_date, settlement_date, principal_amount, term,
                            settlement_amount, sale_id, sale_name, channel,
                            batch_id, version_num, fingerprint, is_active_version, created_at
                        ) VALUES (
                            @EntityId, @AppendixNumber, @CustomerCode, @CustomerName,
                            @TransactionDate, @SettlementDate, @PrincipalAmount, @Term,
                            @SettlementAmount, @SaleId, @SaleName, @Channel,
                            @BatchId, @VersionNum, @Fingerprint, TRUE, now()
                        );",
                        new
                        {
                            EntityId = existingSettle.TransactionEntityId,
                            AppendixNumber = setAppNum,
                            CustomerCode = GetStr("customer_code"),
                            CustomerName = GetStr("customer_name"),
                            TransactionDate = GetDate("transaction_date") ?? setDate,
                            SettlementDate = setDate,
                            PrincipalAmount = GetDec("principal_amount"),
                            Term = GetStr("term"),
                            SettlementAmount = GetDec("settlement_amount"),
                            SaleId = GetStr("sale_id"),
                            SaleName = GetStr("sale_name"),
                            Channel = GetStr("channel"),
                            BatchId = batch.Id,
                            VersionNum = existingSettle.VersionNum + 1,
                            Fingerprint = stg.Fingerprint
                        }, transaction);
                }
                else
                {
                    await connection.ExecuteAsync(@"
                        INSERT INTO contract_settlement_transaction (
                            transaction_entity_id, appendix_number, customer_code, customer_name,
                            transaction_date, settlement_date, principal_amount, term,
                            settlement_amount, sale_id, sale_name, channel,
                            batch_id, version_num, fingerprint, is_active_version, created_at
                        ) VALUES (
                            gen_random_uuid(), @AppendixNumber, @CustomerCode, @CustomerName,
                            @TransactionDate, @SettlementDate, @PrincipalAmount, @Term,
                            @SettlementAmount, @SaleId, @SaleName, @Channel,
                            @BatchId, 1, @Fingerprint, TRUE, now()
                        );",
                        new
                        {
                            AppendixNumber = setAppNum,
                            CustomerCode = GetStr("customer_code"),
                            CustomerName = GetStr("customer_name"),
                            TransactionDate = GetDate("transaction_date") ?? setDate,
                            SettlementDate = setDate,
                            PrincipalAmount = GetDec("principal_amount"),
                            Term = GetStr("term"),
                            SettlementAmount = GetDec("settlement_amount"),
                            SaleId = GetStr("sale_id"),
                            SaleName = GetStr("sale_name"),
                            Channel = GetStr("channel"),
                            BatchId = batch.Id,
                            Fingerprint = stg.Fingerprint
                        }, transaction);
                }
                break;

            case "STOCK":
                var stockAppNum = GetStr("appendix_number");
                var stockCustCode = GetStr("customer_code");
                var stockSignDate = GetDate("sign_date") ?? DateOnly.FromDateTime(DateTime.Today);

                var existingStock = await connection.QueryFirstOrDefaultAsync<StockContractVersion>(@"
                    SELECT * FROM stock_contract_version
                    WHERE appendix_number = @AppNum AND customer_code = @CustCode AND sign_date = @SignDate AND is_active_version = TRUE
                    ORDER BY version_num DESC LIMIT 1;",
                    new { AppNum = stockAppNum, CustCode = stockCustCode, SignDate = stockSignDate }, transaction);

                if (existingStock != null)
                {
                    await connection.ExecuteAsync(@"
                        UPDATE stock_contract_version SET is_active_version = FALSE WHERE id = @OldId;",
                        new { OldId = existingStock.Id }, transaction);

                    await connection.ExecuteAsync(@"
                        INSERT INTO stock_contract_version (
                            entity_id, appendix_number, customer_code, customer_name,
                            contract_value, liquidated_amount, sign_date, expire_date,
                            liquidate_date, sale_id, batch_id, version_num, fingerprint,
                            is_active_version, created_at
                        ) VALUES (
                            @EntityId, @AppendixNumber, @CustomerCode, @CustomerName,
                            @ContractValue, @LiquidatedAmount, @SignDate, @ExpireDate,
                            @LiquidateDate, @SaleId, @BatchId, @VersionNum, @Fingerprint,
                            TRUE, now()
                        );",
                        new
                        {
                            EntityId = existingStock.EntityId,
                            AppendixNumber = stockAppNum,
                            CustomerCode = stockCustCode,
                            CustomerName = GetStr("customer_name"),
                            ContractValue = GetDec("contract_value"),
                            LiquidatedAmount = GetDec("liquidated_amount"),
                            SignDate = stockSignDate,
                            ExpireDate = GetDate("expire_date"),
                            LiquidateDate = GetDate("liquidate_date"),
                            SaleId = GetStr("sale_id"),
                            BatchId = batch.Id,
                            VersionNum = existingStock.VersionNum + 1,
                            Fingerprint = stg.Fingerprint
                        }, transaction);
                }
                else
                {
                    await connection.ExecuteAsync(@"
                        INSERT INTO stock_contract_version (
                            entity_id, appendix_number, customer_code, customer_name,
                            contract_value, liquidated_amount, sign_date, expire_date,
                            liquidate_date, sale_id, batch_id, version_num, fingerprint,
                            is_active_version, created_at
                        ) VALUES (
                            gen_random_uuid(), @AppendixNumber, @CustomerCode, @CustomerName,
                            @ContractValue, @LiquidatedAmount, @SignDate, @ExpireDate,
                            @LiquidateDate, @SaleId, @BatchId, 1, @Fingerprint,
                            TRUE, now()
                        );",
                        new
                        {
                            AppendixNumber = stockAppNum,
                            CustomerCode = stockCustCode,
                            CustomerName = GetStr("customer_name"),
                            ContractValue = GetDec("contract_value"),
                            LiquidatedAmount = GetDec("liquidated_amount"),
                            SignDate = stockSignDate,
                            ExpireDate = GetDate("expire_date"),
                            LiquidateDate = GetDate("liquidate_date"),
                            SaleId = GetStr("sale_id"),
                            BatchId = batch.Id,
                            Fingerprint = stg.Fingerprint
                        }, transaction);
                }
                break;

            case "EXCEPTION":
                var excAppNum = GetStr("appendix_number");
                await connection.ExecuteAsync(@"
                    UPDATE contract_exception_version SET is_active_version = FALSE
                    WHERE appendix_number = @AppNum AND is_active_version = TRUE;",
                    new { AppNum = excAppNum }, transaction);

                await connection.ExecuteAsync(@"
                    INSERT INTO contract_exception_version (
                        entity_id, appendix_number, new_sale_id, original_sale_id,
                        effective_date, expire_date, batch_id, version_num,
                        is_active_version, created_at
                    ) VALUES (
                        gen_random_uuid(), @AppendixNumber, @NewSaleId, @OriginalSaleId,
                        @EffectiveDate, @ExpireDate, @BatchId, 1,
                        TRUE, now()
                    );",
                    new
                    {
                        AppendixNumber = excAppNum,
                        NewSaleId = GetStr("new_sale_id"),
                        OriginalSaleId = GetStr("sale_id"),
                        EffectiveDate = batch.EffectiveDate ?? DateOnly.FromDateTime(DateTime.Today),
                        ExpireDate = GetDate("expire_date"),
                        BatchId = batch.Id
                    }, transaction);
                break;

            case "EMPLOYEE":
                var empId = GetStr("employee_id");
                var empEffDate = batch.EffectiveDate ?? DateOnly.FromDateTime(DateTime.Today);

                // Close current active version
                await connection.ExecuteAsync(@"
                    UPDATE employee_history SET
                        is_current = FALSE,
                        valid_to = @EffDate
                    WHERE employee_id = @EmpId AND is_current = TRUE;",
                    new { EffDate = empEffDate, EmpId = empId }, transaction);

                await connection.ExecuteAsync(@"
                    INSERT INTO employee_history (
                        employee_id, full_name, position, source_level, department,
                        branch, region, manager_employee_id, manager_name,
                        source_account_status, employment_status, valid_from, valid_to,
                        batch_id, recorded_at, recorded_by, is_current
                    ) VALUES (
                        @EmployeeId, @FullName, @Position, @SourceLevel, @Department,
                        @Branch, @Region, @ManagerEmployeeId, @ManagerName,
                        @SourceAccountStatus, @EmploymentStatus, @ValidFrom, '9999-12-31',
                        @BatchId, now(), 'system', TRUE
                    );",
                    new
                    {
                        EmployeeId = empId,
                        FullName = GetStr("full_name"),
                        Position = GetStr("position"),
                        SourceLevel = GetStr("source_level"),
                        Department = GetStr("department"),
                        Branch = GetStr("branch"),
                        Region = GetStr("region"),
                        ManagerEmployeeId = GetStr("manager_employee_id"),
                        ManagerName = GetStr("manager_name"),
                        SourceAccountStatus = GetStr("source_account_status"),
                        EmploymentStatus = GetStr("employment_status"),
                        ValidFrom = empEffDate,
                        BatchId = batch.Id
                    }, transaction);
                break;
        }
    }

    private static bool IsReportFooterRow(List<object?> rowVals, string? entityKey)
    {
        if (!string.IsNullOrWhiteSpace(entityKey) && entityKey.Length > 2)
        {
            return false;
        }

        var text = string.Join(" ", rowVals.Where(v => v != null).Select(v => v!.ToString()!.Trim().ToLowerInvariant()));
        if (string.IsNullOrWhiteSpace(text)) return true;

        string[] footerTerms = {
            "tổng", "tong", "tổng cộng", "tong cong",
            "người lập", "nguoi lap", "kiểm soát", "kiem soat",
            "thời gian tạo", "thoi gian tao", "người tạo", "nguoi tao",
            "kế toán", "ke toan", "giám đốc", "giam doc", "ban giám đốc",
            "ngày ….. tháng", "ngày ... tháng", "ngày...",
            "chữ ký", "chu ky", "ghi chú:", "ghi chu:"
        };

        return footerTerms.Any(term => text.Contains(term));
    }
}
