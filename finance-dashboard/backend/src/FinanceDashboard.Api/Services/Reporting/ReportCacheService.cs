using Microsoft.Extensions.Caching.Memory;

namespace FinanceDashboard.Api.Services.Reporting;

/// <summary>
/// Lightweight RAM cache for Render Free (512MB RAM).
/// Uses a monotonic DataVersion counter so any import, ghost-contract change, or permission update
/// instantly invalidates all cached report responses without clearing the whole cache.
/// </summary>
public class ReportCacheService
{
    private readonly IMemoryCache _cache;
    private long _dataVersion = 1;

    public ReportCacheService(IMemoryCache cache)
    {
        _cache = cache;
    }

    public long DataVersion => Interlocked.Read(ref _dataVersion);

    public void InvalidateAll() => Interlocked.Increment(ref _dataVersion);

    public async Task<T> GetOrCreateAsync<T>(string key, Func<Task<T>> factory, TimeSpan? ttl = null)
    {
        var versionedKey = $"v{DataVersion}:{key}";
        if (_cache.TryGetValue(versionedKey, out T? cached) && cached is not null)
        {
            return cached;
        }

        var value = await factory();
        _cache.Set(versionedKey, value, new MemoryCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = ttl ?? TimeSpan.FromMinutes(5),
            Size = 1
        });
        return value;
    }
}
