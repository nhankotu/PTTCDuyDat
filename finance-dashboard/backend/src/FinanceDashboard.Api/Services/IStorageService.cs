namespace FinanceDashboard.Api.Services;

public interface IStorageService
{
    Task<string> UploadFileAsync(Stream stream, string fileName, string contentType);
    Task<Stream> DownloadFileAsync(string storageKey);
}

public class LocalStorageService : IStorageService
{
    private readonly string _storageDir;

    public LocalStorageService(IConfiguration config)
    {
        _storageDir = Path.Combine(AppContext.BaseDirectory, "storage");
        if (!Directory.Exists(_storageDir))
        {
            Directory.CreateDirectory(_storageDir);
        }
    }

    public async Task<string> UploadFileAsync(Stream stream, string fileName, string contentType)
    {
        var key = $"{Guid.NewGuid()}_{fileName}";
        var filePath = Path.Combine(_storageDir, key);
        using var fs = new FileStream(filePath, FileMode.Create, FileAccess.Write);
        await stream.CopyToAsync(fs);
        return key;
    }

    public Task<Stream> DownloadFileAsync(string storageKey)
    {
        var filePath = Path.Combine(_storageDir, storageKey);
        if (!File.Exists(filePath))
        {
            throw new FileNotFoundException("File not found in storage", storageKey);
        }
        return Task.FromResult<Stream>(new FileStream(filePath, FileMode.Open, FileAccess.Read));
    }
}
