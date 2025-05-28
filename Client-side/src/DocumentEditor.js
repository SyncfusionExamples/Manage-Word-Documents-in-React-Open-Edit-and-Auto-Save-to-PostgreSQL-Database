import React, { useState, useRef } from 'react';
import { DocumentEditorContainerComponent, Toolbar as DocumentEditorToolbar } from '@syncfusion/ej2-react-documenteditor';
import { DialogComponent } from '@syncfusion/ej2-react-popups';
import FileManager from './FileManager';

DocumentEditorContainerComponent.Inject(DocumentEditorToolbar);

const DocumentEditor = () => {
  // State and refs
  const [maxDocId, setMaxDocId] = useState(null);  // Track maximum doc ID for new document creation
  const containerRef = useRef(null);               // Reference to DocumentEditor container
  const [selectedDocId, setSelectedDocId] = useState(null); // Selected document ID
  const [selectedDocName, setSelectedDocName] = useState(null); // Selected document name
  const [showDialog, setShowDialog] = useState(false); // Controls "New Document" dialog
  const [showFileManager, setShowFileManager] = useState(true); // Controls FileManager dialog visibility
  const fileManagerRef = useRef(null);             // Reference to FileManager
  const inputRef = useRef(null);                   // Input reference for new document name
  const contentChanged = useRef(false);            // Flag to track content changes
  const [errorMessage, setErrorMessage] = useState(''); // Error message for name validation
  const randomDefaultName = 'New_Document';        // Default document name

  // Toolbar custom items
  const newToolItem = { prefixIcon: "e-de-ctnr-new", tooltipText: "New", text: "New", id: "CreateNewDoc" };
  const openToolItem = { prefixIcon: "e-de-ctnr-open", tooltipText: "Open file manager", text: "Open", id: "OpenFileManager" };
  const downloadToolItem = { prefixIcon: "e-de-ctnr-download", tooltipText: "Download", text: "Download", id: "DownloadToLocal" };

  const hostUrl = "https://localhost:44305/";

  // Complete toolbar items list
  const toolbarItems = [
    newToolItem, openToolItem, downloadToolItem, 'Separator',
    'Undo', 'Redo', 'Separator', 'Image', 'Table', 'Hyperlink', 'Bookmark',
    'TableOfContents', 'Separator', 'Header', 'Footer', 'PageSetup', 'PageNumber', 
    'Break', 'InsertFootnote', 'InsertEndnote', 'Separator', 'Find', 'Separator',
    'Comments', 'TrackChanges', 'Separator', 'LocalClipboard', 'RestrictEditing',
    'Separator', 'FormFields', 'UpdateFields', 'ContentControl'
  ];

  // Save document to the server as base64
  const autoSaveDocument  = () => {
    const editor = containerRef.current?.documentEditor;
    editor.saveAsBlob('Docx').then((blob) => {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Data = reader.result?.toString().split(',')[1];
        const fileName = selectedDocName || (inputRef.current.value || 'Untitled') + '.docx';
        containerRef.current.documentEditor.documentName = fileName;

        try {
          await fetch(hostUrl + `api/documents/${selectedDocId}/saveDocumentAsync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ Base64Content: base64Data, FileName: fileName })
          });
        } catch (err) {
          console.error('Auto-save error:', err);
        }
      };
      reader.readAsDataURL(blob);
    });
  };

  // Create new document logic from dialog
  const handleFileNamePromptOk  = async () => {
    const documentName = inputRef.current?.value?.trim();
    if (!documentName) {
      setErrorMessage("Document name cannot be empty.");
      return;
    }

    const baseFilename = `${documentName}.docx`;

    // Check if a document with this name already exists
    const exists = await checkDocumentExistence(baseFilename);
    if (exists) {
      setErrorMessage("A document with this name already exists. Please choose a different name.");
      inputRef.current?.focus();
      inputRef.current?.select();
      return;
    }

    // Proceed with creation
    setErrorMessage("");
    setShowDialog(false);
    const newId = maxDocId + 1;
    setSelectedDocId(newId);
    setMaxDocId(newId);
    setSelectedDocName(baseFilename);
    containerRef.current.documentEditor.documentName = baseFilename;
    containerRef.current.documentEditor.openBlank();
  };

  //  Check if a document with a given name already exists on database
  const checkDocumentExistence = async (fileName) => {
    try {
      const response = await fetch(hostUrl + 'api/documents/CheckDocumentExistence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json;charset=UTF-8' },
        body: JSON.stringify({ fileName: fileName })
      });
      if (response.ok) {
        const result = await response.json();
        return result.exists;
      }
      return false;
    } catch (err) {
      console.error('Error checking document existence:', err);
      return false;
    }
  };

  // Handle toolbar item clicks
  const handleToolbarItemClick = (args) => {
    let documentName = containerRef.current.documentEditor.documentName;
    const baseDocName = documentName.replace(/\.[^/.]+$/, '');

    switch (args.item.id) {
      case 'CreateNewDoc':
        setSelectedDocId(0);
        setSelectedDocName(null);
        setShowDialog(true);
        containerRef.current.documentEditor.openBlank();
        containerRef.current.documentEditor.focusIn();
        break;
      case 'OpenFileManager':
        if (fileManagerRef.current) {
          fileManagerRef.current.clearSelection();
          setTimeout(() => {
            fileManagerRef.current.refreshFiles();
          }, 100);
          containerRef.current.documentEditor.focusIn();
        }
        setShowFileManager(true);
        break;
      case 'DownloadToLocal':
        containerRef.current.documentEditor.save(baseDocName, 'Docx');
        containerRef.current.documentEditor.focusIn();
        break;
      default:
        break;
    }
  };

  // Auto-save effect runs every second
  React.useEffect(() => {
    const intervalId = setInterval(() => {
      if (contentChanged.current) {
        autoSaveDocument();
        contentChanged.current = false;
      }
    }, 1000);
    return () => clearInterval(intervalId);
  });

  // Auto-focus on dialog input
  React.useEffect(() => {
    if (showDialog && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [showDialog]);

  // Handle content changes
  const handleContentChange = () => {
    contentChanged.current = true;
  };

  // Load document from FileManager selection
  const loadFileFromFileManager = (fileId, fileName) => {
    setSelectedDocId(fileId);
    containerRef.current.documentEditor.documentName = fileName;
    setSelectedDocName(fileName);
  };

  return (
    <div>
      {/* FileManager dialog for opening files */}
      <FileManager
        onFileSelect={loadFileFromFileManager}
        onFileManagerLoaded={(id) => setMaxDocId(id)}
        editorRef={containerRef}
        fileManagerRef={fileManagerRef}
        visible={showFileManager}
        setVisible={setShowFileManager}
      />

      {/* Document name display */}
      <div id="document-header">
        {selectedDocName || (inputRef?.current?.value ? inputRef.current.value + '.docx' : '')}
      </div>

      {/* Main document editor container */}
      <DocumentEditorContainerComponent
        ref={containerRef}
        height="calc(100vh - 65px)"
        serviceUrl="https://ej2services.syncfusion.com/production/web-services/api/documenteditor/"
        enableToolbar={true}
        toolbarItems={toolbarItems}
        toolbarClick={handleToolbarItemClick}
        contentChange={handleContentChange}
      />

      {/* Dialog for creating new documents */}
      <DialogComponent
        visible={showDialog}
        header='New Document'
        showCloseIcon={true}
        width='400px'
        isModal={true}
        close={() => setShowDialog(false)}
        buttons={[
          {
            click: handleFileNamePromptOk ,
            buttonModel: { content: 'Ok', isPrimary: true }
          },
          {
            click: () => setShowDialog(false),
            buttonModel: { content: 'Cancel' }
          }
        ]}
      >
        <div className="e-dialog-content">
          <p>Enter document name</p>
          <input
            ref={inputRef}
            type="text"
            className="e-input"
            placeholder="Document name"
            defaultValue={randomDefaultName}
            style={{ width: '100%', marginTop: '10px' }}
          />
          {errorMessage && (
            <div style={{ color: 'red', marginTop: '4px' }}>
              {errorMessage}
            </div>
          )}
        </div>
      </DialogComponent>
    </div>
  );
};

export default DocumentEditor;