using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace FinanceDashboard.Api.Services.Import;

public static class ExcelParserHelper
{
    public static string NormalizeHeader(string header)
    {
        if (string.IsNullOrWhiteSpace(header)) return string.Empty;

        // R08 fix: Replace đ/Đ before FormD decomposition
        var s = header.Trim()
            .Replace("đ", "d")
            .Replace("Đ", "d");

        var normalizedString = s.Normalize(NormalizationForm.FormD);
        var stringBuilder = new StringBuilder();

        foreach (var c in normalizedString)
        {
            var unicodeCategory = CharUnicodeInfo.GetUnicodeCategory(c);
            if (unicodeCategory != UnicodeCategory.NonSpacingMark)
            {
                stringBuilder.Append(c);
            }
        }

        var res = stringBuilder.ToString().Normalize(NormalizationForm.FormC).ToLowerInvariant();
        res = res.Replace("\r", " ").Replace("\n", " ");
        while (res.Contains("  ")) res = res.Replace("  ", " ");
        return res.Trim();
    }

    public static DateOnly? ParseDate(object? value)
    {
        if (value == null) return null;
        if (value is DateTime dt) return DateOnly.FromDateTime(dt);
        if (value is DateOnly d) return d;

        // If numeric typed value (from double/int/etc.), OADate is applicable
        if (value is double dblVal && dblVal > 20000 && dblVal < 80000)
        {
            try
            {
                return DateOnly.FromDateTime(DateTime.FromOADate(dblVal));
            }
            catch { }
        }

        var str = value.ToString()?.Trim();
        if (string.IsNullOrWhiteSpace(str)) return null;

        // R10 fix: If 6 digits (e.g. "050326"), parse as ddMMyy FIRST before testing serial
        if (str.Length == 6 && long.TryParse(str, out _))
        {
            if (DateTime.TryParseExact(str, "ddMMyy", CultureInfo.InvariantCulture, DateTimeStyles.None, out var ddmmyy))
            {
                return DateOnly.FromDateTime(ddmmyy);
            }
        }

        if (str.Length == 8 && long.TryParse(str, out _))
        {
            if (DateTime.TryParseExact(str, "ddMMyyyy", CultureInfo.InvariantCulture, DateTimeStyles.None, out var ddmmyyyy))
            {
                return DateOnly.FromDateTime(ddmmyyyy);
            }
            if (DateTime.TryParseExact(str, "yyyyMMdd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var yyyymmdd))
            {
                return DateOnly.FromDateTime(yyyymmdd);
            }
        }

        // Check common text formats
        string[] formats = { "dd/MM/yyyy", "d/M/yyyy", "dd-MM-yyyy", "yyyy-MM-dd", "yyyy/MM/dd", "d/M/yy", "dd/MM/yy" };
        if (DateTime.TryParseExact(str, formats, CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsedExact))
        {
            return DateOnly.FromDateTime(parsedExact);
        }

        // Try standard culture parsing
        if (DateTime.TryParse(str, new CultureInfo("vi-VN"), DateTimeStyles.None, out var parsedVi))
        {
            return DateOnly.FromDateTime(parsedVi);
        }

        if (DateTime.TryParse(str, CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsedInv))
        {
            return DateOnly.FromDateTime(parsedInv);
        }

        // Finally check if text is an OADate numeric serial (only if double parse succeeded and fits range)
        if (double.TryParse(str, NumberStyles.Any, CultureInfo.InvariantCulture, out var serial))
        {
            if (serial > 25000 && serial < 75000)
            {
                try
                {
                    return DateOnly.FromDateTime(DateTime.FromOADate(serial));
                }
                catch { }
            }
        }

        return null;
    }

    public static bool TryParseDecimal(object? value, out decimal result)
    {
        result = 0m;
        if (value == null) return true; // Null/empty means 0 or unassigned
        if (value is decimal dec) { result = dec; return true; }
        if (value is double dbl) { result = Convert.ToDecimal(dbl); return true; }
        if (value is float flt) { result = Convert.ToDecimal(flt); return true; }
        if (value is int i) { result = i; return true; }
        if (value is long l) { result = l; return true; }

        var str = value.ToString()?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(str)) return true;

        // Clean currency signs, spaces
        str = str.Replace(" ", "").Replace("VNĐ", "", StringComparison.OrdinalIgnoreCase).Replace("VND", "", StringComparison.OrdinalIgnoreCase);

        // Handle negative like (1000) or -1000
        bool isNegative = false;
        if (str.StartsWith("(") && str.EndsWith(")"))
        {
            isNegative = true;
            str = str.Substring(1, str.Length - 2);
        }
        else if (str.StartsWith("-"))
        {
            isNegative = true;
            str = str.Substring(1);
        }

        // R09 fix: Handle thousand separators properly
        if (str.Contains('.') && str.Contains(','))
        {
            // Both present: determine decimal mark by last position
            if (str.LastIndexOf(',') > str.LastIndexOf('.'))
            {
                // e.g. "1.000.000,50" -> remove dot, comma becomes dot
                str = str.Replace(".", "").Replace(',', '.');
            }
            else
            {
                // e.g. "1,000,000.50" -> remove comma
                str = str.Replace(",", "");
            }
        }
        else if (str.Contains('.'))
        {
            var parts = str.Split('.');
            if (parts.Length > 2)
            {
                // Multiple dots e.g. "1.000.000" -> thousand separators
                str = str.Replace(".", "");
            }
            else if (parts.Length == 2 && parts[1].Length == 3 && parts[0].Length >= 1)
            {
                // Single dot followed by exactly 3 digits e.g. "1.000" or "500.000" -> thousand separator in VN format
                str = str.Replace(".", "");
            }
        }
        else if (str.Contains(','))
        {
            var parts = str.Split(',');
            if (parts.Length > 2)
            {
                // Multiple commas e.g. "1,000,000" -> thousand separators
                str = str.Replace(",", "");
            }
            else if (parts.Length == 2)
            {
                if (parts[1].Length == 3 && parts[0].Length >= 1)
                {
                    // "1,000" -> thousand separator
                    str = str.Replace(",", "");
                }
                else
                {
                    // "1000,5" or "1000,50" -> comma as decimal separator
                    str = str.Replace(',', '.');
                }
            }
        }

        if (decimal.TryParse(str, NumberStyles.Any, CultureInfo.InvariantCulture, out var parsed))
        {
            result = isNegative ? -parsed : parsed;
            return true;
        }

        return false;
    }

    public static decimal ParseDecimal(object? value)
    {
        return TryParseDecimal(value, out var res) ? res : 0m;
    }

    public static string FormatCustomerCode(object? value)
    {
        if (value == null) return string.Empty;
        var str = value.ToString()?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(str)) return string.Empty;

        // If numeric and length between 1 and 6, pad with leading zeros to 6 chars
        if (long.TryParse(str, out var num) && num >= 0 && str.Length <= 6)
        {
            return str.PadLeft(6, '0');
        }

        return str;
    }

    public static (string SaleId, string? SaleName) ParseSaleIntro(object? value)
    {
        if (value == null) return (string.Empty, null);
        var str = value.ToString()?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(str)) return (string.Empty, null);

        var hyphenIdx = str.IndexOf('-');
        if (hyphenIdx > 0 && hyphenIdx < str.Length - 1)
        {
            var id = str.Substring(0, hyphenIdx).Trim();
            var name = str.Substring(hyphenIdx + 1).Trim();
            return (id, string.IsNullOrWhiteSpace(name) ? null : name);
        }

        return (str, null);
    }

    public static string NormalizeProductName(object? value, string? fallbackContext = null)
    {
        var str = value?.ToString()?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(str) && !string.IsNullOrWhiteSpace(fallbackContext))
        {
            str = fallbackContext;
        }

        if (string.IsNullOrWhiteSpace(str)) return "Finra Safe";

        var lower = str.ToLowerInvariant();

        if (lower.Contains("star"))
        {
            return "Finra Star";
        }
        if (lower.Contains("shield") || lower.Contains("sheild"))
        {
            return "Finra Shield";
        }
        if (lower.Contains("snap"))
        {
            return "Finra Snap";
        }
        if (lower.Contains("safe"))
        {
            return "Finra Safe";
        }

        return str;
    }

    public static string ComputeSha256(string content)
    {
        using var sha = SHA256.Create();
        var bytes = Encoding.UTF8.GetBytes(content);
        var hash = sha.ComputeHash(bytes);
        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    public static string ComputeStreamSha256(Stream stream)
    {
        using var sha = SHA256.Create();
        stream.Position = 0;
        var hash = sha.ComputeHash(stream);
        stream.Position = 0;
        return Convert.ToHexString(hash).ToLowerInvariant();
    }
}
