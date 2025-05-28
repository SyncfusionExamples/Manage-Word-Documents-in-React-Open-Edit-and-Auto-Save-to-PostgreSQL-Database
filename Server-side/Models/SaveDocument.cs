namespace PostgresDBService
{
    /// <summary>
    /// Data Transfer Object (DTO) used for saving a document with its name and content.
    /// </summary>
    public class SaveDocument
    {
        /// <summary>
        /// Gets or sets the Base64-encoded content of the document.
        /// </summary>
        public string Base64Content { get; set; }

        /// <summary>
        /// Gets or sets the name of the file, including its extension (e.g., "document.docx").
        /// </summary>
        public string FileName { get; set; }
    }
}
