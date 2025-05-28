using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

/// <summary>
/// Represents a document entity stored in the database.
/// </summary>
public class Document
{
    /// <summary>
    /// Gets or sets the unique identifier for the document
    /// This is the primary key and is auto-incremented.
    /// </summary>
    [Key]
    [Column("id")]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public int Id { get; set; }

    /// <summary>
    /// Gets or sets the name of the document.
    /// </summary>
    [Column("name")]
    public string Name { get; set; }

    /// <summary>
    /// Gets or sets the binary file data of the document.
    /// </summary>
    [Column("file_data")]
    public byte[] FileData { get; set; }

    /// <summary>
    /// Gets or sets the timestamp when the document was last modified.
    /// </summary>
    [Column("modified_at")]
    public DateTime ModifiedAt { get; set; }

    /// <summary>
    /// Gets or sets the timestamp when the document was created.
    /// </summary>
    [Column("created_at")]
    public DateTime CreatedAt { get; set; }
}
