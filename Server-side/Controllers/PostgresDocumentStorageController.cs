using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;
using PostgresDBService;
using Syncfusion.EJ2.DocumentEditor;
using Syncfusion.EJ2.FileManager.Base;
using System.IO.Compression;

[Route("api/[controller]")]
[ApiController]
public class PostgresDocumentStorageController : ControllerBase
{
    private readonly PostgresDocumentStorageService _documentStorageService;
    private readonly DocumentContext _documentContext;

    public PostgresDocumentStorageController(DocumentContext context)
    {
        _documentContext = context;
        _documentStorageService = new PostgresDocumentStorageService(_documentContext);
    }
    /// <summary>
    /// Handles File Manager operations like read, delete, details, search, and copy
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> HandleFileManagerOperationsAsync([FromBody] FileManagerDirectoryContent args)
    {
        if (args == null || string.IsNullOrEmpty(args.Action))
        {
            return BadRequest("Invalid request.");
        }

        return args.Action.ToLower() switch
        {
            "read" => Ok(await _documentStorageService.GetDocumentsAsync()),
            "delete" => Ok(await _documentStorageService.DeleteAsync(args.Path, args.Names, args.Data)),
            "details" => Ok(await _documentStorageService.GetDocumentDetailsAsync(args.Path, args.Names, args.Data)),
            "search" => Ok(await _documentStorageService.SearchAsync(args.Path, args.SearchString, args.ShowHiddenItems, args.CaseSensitive, args.Data)), // You need to implement SearchAsync
            "copy" => Ok(await _documentStorageService.CopyAsync(args.Path, args.TargetPath, args.Names, args.Data, args.RenameFiles)), // You need to implement CopyAsync
            _ => BadRequest($"Unknown action: {args.Action}")
        };
    }

    /// <summary>
    /// Returns document data as serialized SFDT JSON for Syncfusion DocumentEditor.
    /// </summary>

    [HttpGet("{docId}/getDocumentAsync")]
    public async Task<IActionResult> GetDocumentAsync(string docId)
    {
        int id = int.Parse(docId);
        var document = await _documentContext.Documents.FirstOrDefaultAsync(d => d.Id == id);
        if (document == null)
        {
            return NotFound();
        }

        try
        {
            using var memoryStream = new MemoryStream(document.FileData);
            WordDocument wordDocument = WordDocument.Load(memoryStream, FormatType.Docx);
            string sfdtContent = JsonConvert.SerializeObject(wordDocument);
            wordDocument.Dispose();

            return Content(sfdtContent, "application/json");
        }
        catch (Exception ex)
        {
            return BadRequest($"Error processing document: {ex.Message}");
        }
    }

    /// <summary>
    ///Saves or updates a document in the database using Base64-encoded content.
    /// </summary>
    [HttpPost("{id}/saveDocumentAsync")]
    public async Task<IActionResult> SaveDocumentAsync(int id, [FromBody] SaveDocument fileData)
    {
        var document = await _documentContext.Documents.FindAsync(id);

        try
        {
            // Convert the Base64Content-encoded document to a byte array
            byte[] data = Convert.FromBase64String(fileData.Base64Content);

            var existingDoc = await _documentContext.Documents
         .FirstOrDefaultAsync(d => d.Name == fileData.FileName);

            if (existingDoc != null)
            {
                document.FileData = data;
                document.ModifiedAt = DateTime.UtcNow;
                await _documentContext.SaveChangesAsync();
            }
            else
            {
                var newDoc = new Document
                {
                    Id = id,
                    Name = fileData.FileName,
                    FileData = data,
                    ModifiedAt = DateTime.UtcNow,
                    CreatedAt = DateTime.UtcNow,
                };
                _documentContext.Documents.Add(newDoc);
                await _documentContext.SaveChangesAsync();
            }
            return Ok("Document saved.");
        }
        catch (Exception ex)
        {
            return BadRequest($"Save failed: {ex.Message}");
        }
    }

    /// <summary>
    /// Downloads one or more documents. Zips multiple files.
    /// </summary>
    [HttpPost("downloadAsync")]
    public async Task<IActionResult> DownloadAsync([FromForm] string downloadInput)
    {
        if (string.IsNullOrWhiteSpace(downloadInput))
            return BadRequest("Missing download input");

        var args = JsonConvert.DeserializeObject<FileManagerDirectoryContent>(downloadInput);

        if (args.Data == null || args.Data.Length == 0)
            return BadRequest("No files to download.");

        // Single file case
        if (args.Data.Length == 1)
        {
            var fileItem = args.Data[0];
            if (!int.TryParse(fileItem.Id, out int id))
                return BadRequest("Invalid file ID.");

            var document = await _documentContext.Documents.FirstOrDefaultAsync(d => d.Id == id);
            if (document == null || document.FileData == null || document.FileData.Length == 0)
                return NotFound("File not found or is empty.");

            var contentType = GetContentType(document.Name);
            return File(document.FileData, contentType, document.Name);
        }

        // Multiple files - zip them
        using var memoryStream = new MemoryStream();
        using (var zip = new ZipArchive(memoryStream, ZipArchiveMode.Create, true))
        {
            foreach (var item in args.Data)
            {
                if (!int.TryParse(item.Id, out int id))
                    continue;

                var document = await _documentContext.Documents.FirstOrDefaultAsync(d => d.Id == id);
                if (document == null || document.FileData == null)
                    continue;

                var entry = zip.CreateEntry(document.Name, CompressionLevel.Fastest);
                using var entryStream = entry.Open();
                await entryStream.WriteAsync(document.FileData, 0, document.FileData.Length);
            }
        }

        memoryStream.Seek(0, SeekOrigin.Begin);
        return File(memoryStream.ToArray(), "application/zip", "Documents.zip");
    }

    /// <summary>
    /// Checks if a document with the given name exists in the PostgreSQL database.
    /// Expects a JSON payload with a "fileName" property.
    /// </summary>
    /// <param name="jsonObject">
    /// A dictionary containing the document name to check. For example: { "fileName": "Document1.docx" }.
    /// </param>
    /// <returns>
    /// An <see cref="IActionResult"/> containing a JSON object with a boolean property "exists".
    /// If the document exists, the response will be { "exists": true }; otherwise, { "exists": false }.
    /// </returns>
    [HttpPost("CheckDocumentExistence")]
    public async Task<IActionResult> CheckDocumentExistence([FromBody] Dictionary<string, string> jsonObject)
    {
        if (!jsonObject.TryGetValue("fileName", out var fileName) || string.IsNullOrEmpty(fileName))
        {
            return BadRequest("fileName not provided");
        }

        try
        {
            // Query PostgreSQL database via EF Core to check for existence
            bool exists = await _documentContext.Documents
                .AnyAsync(d => d.Name == fileName);

            return Ok(new { exists });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }

    /// <summary>
    /// Returns the MIME type for a given file based on its extension.
    /// </summary>
    private string GetContentType(string fileName)
    {
        var provider = new FileExtensionContentTypeProvider();
        if (!provider.TryGetContentType(fileName, out var contentType))
        {
            contentType = "application/octet-stream"; // default fallback
        }
        return contentType;
    }
}
