using Microsoft.EntityFrameworkCore;

namespace PostgresDBService
{
    /// <summary>
    /// Represents the EF Core database context for managing document records in PostgreSQL.
    /// </summary>
    public class DocumentContext : DbContext
    {
        /// <summary>
        /// Initializes a new instance of the <see cref="DocumentContext"/> class using the specified options.
        /// </summary>
        /// <param name="options">The options to be used by the DbContext.</param>
        public DocumentContext(DbContextOptions<DocumentContext> options) : base(options) { }

        /// <summary>   
        /// Gets or sets the <see cref="DbSet{TEntity}"/> representing the "documents" table.
        /// </summary>
        public DbSet<Document> Documents { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            // Configure entity-to-table mapping
            modelBuilder.Entity<Document>().ToTable("documents");

            // Configure property-to-column mappings
            modelBuilder.Entity<Document>(entity =>
            {
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.Name).HasColumnName("name");
                entity.Property(e => e.FileData).HasColumnName("file_data");
                entity.Property(e => e.CreatedAt).HasColumnName("created_at");
                entity.Property(e => e.ModifiedAt).HasColumnName("modified_at");
            });
        }
    }
}
