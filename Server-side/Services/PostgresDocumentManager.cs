using Microsoft.EntityFrameworkCore;
using Syncfusion.EJ2.FileManager.Base;

namespace PostgresDBService
{
    /// <summary>
    /// Provides file management operations backed by a PostgreSQL database using Entity Framework Core.
    /// Implements methods to get files, delete files, get file details, search, and copy files.
    /// </summary>
    public class PostgresDocumentManager
    {
        private readonly DocumentContext _documentContext;

        public PostgresDocumentManager(DocumentContext context)
        {
            _documentContext = context;
        }

        /// <summary>
        /// Retrieves all files in the database formatted for a file manager UI.
        /// </summary>
        public async Task<object> GetFilesAsync()
        {
            var documents = await _documentContext.Documents.AsNoTracking()
                .Select(d => new
                {
                    name = d.Name,
                    size = d.FileData != null ? d.FileData.Length : 0,
                    dateModified = d.ModifiedAt ,
                    dateCreated = d.CreatedAt,
                    hasChild = false,
                    isFile = true,
                    type = Path.GetExtension(d.Name),
                    filterPath = "\\",
                    id = d.Id.ToString()
                })
                .ToListAsync();

            var docCount = await _documentContext.Documents.MaxAsync(d => d.Id);
            var response = new
            {
                cwd = new
                {
                    name = "Documents",
                    size = 0,
                    dateModified = DateTime.UtcNow,
                    dateCreated = DateTime.UtcNow,
                    hasChild = true,
                    isFile = false,
                    type = "",
                    filterPath = ""
                },
                files = documents,
                docCount = docCount
            };

            return response;
        }

        /// <summary>
        /// Deletes the specified files from the database.
        /// </summary>
        public async Task<object> DeleteAsync(string path, string[] names, params FileManagerDirectoryContent[] data)
        {
            if (data == null || data.Length == 0)
            {
                return new
                {
                    cwd = (object)null,
                    details = (object)null,
                    error = new { message = "No files to delete." },
                    files = new List<object>()
                };
            }

            var idsToDelete = data
                .Where(d => !string.IsNullOrEmpty(d.Id))
                .Select(d => d.Id)
                .ToList();

            var documents = await _documentContext.Documents
                .Where(d => idsToDelete.Contains(d.Id.ToString()))
                .ToListAsync();

            if (documents.Count == 0)
            {
                return new
                {
                    cwd = (object)null,
                    details = (object)null,
                    error = new { message = "No matching files found." },
                    files = new List<object>()
                };
            }

            _documentContext.Documents.RemoveRange(documents);
            await _documentContext.SaveChangesAsync();

            // Prepare style response
            var deletedFiles = data.Select(d => new
            {
                name = d.Name,
                size = d.Size,
                dateCreated = d.DateCreated,
                dateModified = d.DateModified,
                hasChild = d.HasChild,
                isFile = d.IsFile,
                type = d.Type,
                filterPath = d.FilterPath
            });

            return new
            {
                cwd = (object)null,
                details = (object)null,
                error = (object)null,
                files = deletedFiles
            };
        }

        /// <summary>
        /// Retrieves file details for the specified document.
        /// </summary>
        public async Task<object> GetDetailsAsync(string path, string[] names, FileManagerDirectoryContent[] data)
        {
            if (data?.Length == 0)
            {
                return BuildErrorResponse("No items provided for details.");
            }

            if (data.Length > 1)
            {
                return new
                {
                    cwd = (object)null,
                    files = (object)null,
                    error = (object)null,
                    details = new
                    {
                        name = "Multiple Files",
                        location = path ?? "\\",
                        isFile = false,
                        size = "",
                        created = "",
                        modified = "",
                        multipleFiles = true
                    }
                };
            }

            var item = data[0];
            var doc = await _documentContext.Documents
                .Where(d => d.Id.ToString() == item.Id)
                .Select(d => new
                {
                    d.Name,
                    d.CreatedAt,
                    d.ModifiedAt,
                    Size = d.FileData != null ? d.FileData.Length : 0,
                    Location = item.FilterPath ?? "\\"
                })
                .FirstOrDefaultAsync();

            if (doc == null)
            {
                return BuildErrorResponse("Item not found.");
            }

            return new
            {
                cwd = (object)null,
                files = (object)null,
                error = (object)null,
                details = new
                {
                    name = doc.Name,
                    location = doc.Location,
                    isFile = true,
                    size = FormatFileSize(doc.Size),
                    created = doc.CreatedAt.ToString("M/d/yyyy h:mm:ss tt"),
                    modified = doc.ModifiedAt.ToString("M/d/yyyy h:mm:ss tt"),
                    multipleFiles = false
                }
            };
        }

        /// <summary>
        /// Searches documents by name.
        /// </summary>
        public async Task<object> SearchAsync(string path, string searchString, bool showHiddenItems, bool caseSensitive, FileManagerDirectoryContent[] data)
        {
            if (string.IsNullOrWhiteSpace(searchString))
            {
                return new
                {
                    cwd = (object)null,
                    files = new List<object>(),
                    error = new { message = "SearchAsync string is required." },
                    details = (object)null
                };
            }

            string cleanSearch = searchString.Replace("*", "").Replace("?", "");

            var query = _documentContext.Documents.AsQueryable();

            // Case sensitivity logic
            query = caseSensitive
                ? query.Where(d => d.Name.Contains(cleanSearch))
                : query.Where(d => d.Name.ToLower().Contains(cleanSearch.ToLower()));

            var documents = await query
                .Select(d => new
                {
                    name = d.Name,
                    size = d.FileData != null ? d.FileData.Length : 0,
                    dateModified = d.ModifiedAt,
                    dateCreated = d.CreatedAt,
                    hasChild = false,
                    isFile = true,
                    type = Path.GetExtension(d.Name),
                    filterPath = $"//FileContents//{Path.GetFileNameWithoutExtension(d.Name)}", // or custom path
                    id = d.Id.ToString()
                })
                .ToListAsync();

            return new
            {
                cwd = new
                {
                    name = "files",
                    size = 0,
                    dateModified = DateTime.UtcNow,
                    dateCreated = DateTime.UtcNow.AddMonths(-1),
                    hasChild = true,
                    isFile = false,
                    type = "",
                    filterPath = "//"
                },
                files = documents,
                error = (object)null,
                details = (object)null
            };
        }

        /// <summary>
        /// Copies files to a new location.
        /// </summary>
        public async Task<object> CopyAsync(string path, string targetPath, string[] names, FileManagerDirectoryContent[] data, string[] renameFiles = null)
        {
            var documents = await _documentContext.Documents.ToListAsync();
            int maxId = await _documentContext.Documents.MaxAsync(d => d.Id);
            var copiedDocuments = new List<object>();
            var existFiles = new List<string>();
            var now = DateTime.UtcNow;
            renameFiles ??= Array.Empty<string>();

            for (int i = 0; i < data.Length; i++)
            {
                var original = data[i];
                var newName = names.Length > i ? names[i] : original.Name;

                if (!int.TryParse(original.Id, out int sourceId)) continue;

                var sourceDoc = await _documentContext.Documents.AsNoTracking().FirstOrDefaultAsync(d => d.Id == sourceId);
                if (sourceDoc == null) continue;

                // Check for name conflict in destination (ParentId should be derived from targetPath if implemented)
                bool fileExists = await _documentContext.Documents
                    .AnyAsync(d => d.Name == newName && d.Id == sourceDoc.Id);

                if (fileExists)
                {
                    // If file was renamed by user, rename and continue
                    int renameIndex = Array.FindIndex(renameFiles, r => r.StartsWith(newName));
                    if (renameIndex >= 0)
                    {
                        newName = await GenerateUniqueNameAsync(newName, sourceDoc.Id);
                    }
                    else
                    {
                        existFiles.Add(newName);
                        continue;
                    }
                }

                var newDoc = new Document
                {
                    Name = newName,
                    CreatedAt = now,
                    ModifiedAt = now,
                    FileData = sourceDoc.FileData,
                    Id = maxId + 1
                };

                _documentContext.Documents.Add(newDoc);
                await _documentContext.SaveChangesAsync();

                copiedDocuments.Add(new
                {
                    name = newDoc.Name,
                    size = newDoc.FileData?.Length ?? 0,
                    dateModified = newDoc.ModifiedAt,
                    dateCreated = newDoc.CreatedAt,
                    hasChild = false,
                    isFile = true,
                    type = Path.GetExtension(newDoc.Name),
                    filterPath = "\\",
                    id = newDoc.Id.ToString()
                });
            }
            ErrorDetails error = new ErrorDetails();
            if (existFiles.Count > 0 && renameFiles.Length == 0)
            {

                error.FileExists = existFiles;
                error.Code = "400";
                error.Message = "File Already Exists";
            }
            var hasError = error != null && (error.Code != null || error.Message != null || error.FileExists != null);
            return new
            {
                cwd = new
                {
                    name = "Documents",
                    size = 0,
                    dateModified = now,
                    dateCreated = now,
                    hasChild = true,
                    isFile = false,
                    type = "",
                    filterPath = ""
                },
                files = copiedDocuments,
                error = hasError ? error : null,
                details = (object)null
            };
        }

        /// <summary>
        /// Generates a unique file name.
        /// </summary>
        private async Task<string> GenerateUniqueNameAsync(string baseName, int parentId)
        {
            string nameWithoutExt = Path.GetFileNameWithoutExtension(baseName);
            string ext = Path.GetExtension(baseName);
            string newName = baseName;
            int counter = 1;

            while (await _documentContext.Documents.AnyAsync(d => d.Name == newName && d.Id == parentId))
            {
                newName = $"{nameWithoutExt} ({counter++}){ext}";
            }

            return newName;
        }

        /// <summary>
        /// Formats the file size to a human-readable string.
        /// </summary>
        private string FormatFileSize(long bytes)
        {
            return bytes switch
            {
                >= 1_048_576 => $"{bytes / 1_048_576.0:F1} MB",
                >= 1024 => $"{bytes / 1024.0:F1} KB",
                _ => $"{bytes} bytes"
            };
        }

        /// <summary>
        /// Builds a standard error response.
        /// </summary>
        private object BuildErrorResponse(string message)
        {
            return new
            {
                cwd = (object)null,
                files = (object)null,
                error = new { message },
                details = (object)null
            };
        }
    }
}

