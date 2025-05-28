import React, { useState, useRef } from 'react';
import { DocumentEditorContainerComponent, Toolbar as DocumentEditorToolbar } from '@syncfusion/ej2-react-documenteditor';
import { DialogComponent } from '@syncfusion/ej2-react-popups';
import FileManager from './FileManager';

DocumentEditorContainerComponent.Inject(DocumentEditorToolbar);

const DocumentEditor = () => {
  const [maxDocId, setMaxDocId] = useState(null);
  const containerRef = useRef(null);
  const [selectedDocId, setSelectedDocId] = useState(null);
  const [selectedDocName, setSelectedDocName] = useState(null);
  const [showDialog, setShowDialog] = useState(false);
  const [showFileManager, setShowFileManager] = React.useState(true);
  const fileManagerRef = useRef(null);
  const inputRef = useRef(null);
  const contentChanged = useRef(false);
  const [errorMessage, setErrorMessage] = useState('');
  const randomDefaultName = 'New Document'

  const newToolItem = {
    prefixIcon: "e-de-ctnr-new",
    tooltipText: "New",
    text: "New",
    id: "CreateNewDoc"
  };
  const openToolItem = {
    prefixIcon: "e-de-ctnr-open",
    tooltipText: "Open file manager",
    text: "Open",
    id: "OpenFileManager"
  };
  const downloadToolItem = {
    prefixIcon: "e-de-ctnr-download",
    tooltipText: "Download",
    text: "Download",
    id: "DownloadToLocal"
  };

  const hostUrl = "https://localhost:44305/";
  const toolbarItems = [newToolItem, openToolItem, downloadToolItem, 'Separator', 'Undo', 'Redo', 'Separator', 'Image', 'Table', 'Hyperlink', 'Bookmark', 'TableOfContents', 'Separator', 'Header', 'Footer', 'PageSetup', 'PageNumber', 'Break', 'InsertFootnote', 'InsertEndnote', 'Separator', 'Find', 'Separator', 'Comments', 'TrackChanges', 'Separator', 'LocalClipboard', 'RestrictEditing', 'Separator', 'FormFields', 'UpdateFields', 'ContentControl'];

  const SaveDocument = () => {
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
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              Base64Content: base64Data,
              FileName: fileName
            })
          });
        } catch (err) {
          console.error('Auto-save error:', err);
        }
      };
      reader.readAsDataURL(blob);
    });
  };

  const handleDialogSave = async () => {
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

    // Proceed to save
    setErrorMessage("");
    setShowDialog(false);
    const newId = maxDocId + 1;
    setSelectedDocId(newId);
    setMaxDocId(newId);
    setSelectedDocName(baseFilename);
    containerRef.current.documentEditor.documentName = baseFilename;
    containerRef.current.documentEditor.openBlank();
  };

  //  Check if a document with a given name already exists on the Azure storage
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

  React.useEffect(() => {
    const intervalId = setInterval(() => {
      if (contentChanged.current) {
        SaveDocument();
        contentChanged.current = false;
      }
    }, 1000);
    return () => clearInterval(intervalId);
  });

  React.useEffect(() => {
    if (showDialog  && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [showDialog ]);

  const handleContentChange = () => {
    contentChanged.current = true;
  };
  const loadFileFromFileManager = (fileId, fileName) => {
    setSelectedDocId(fileId);
    containerRef.current.documentEditor.documentName = fileName;
    setSelectedDocName(fileName);
  };

  return (
    <div>
      <FileManager
        onFileSelect={loadFileFromFileManager}
        onFileManagerLoaded={(id) => setMaxDocId(id)}
        editorRef={containerRef}
        fileManagerRef={fileManagerRef}
        visible={showFileManager}
        setVisible={setShowFileManager}
      />
      <div id="document-header">
        {selectedDocName || (inputRef?.current?.value ? inputRef.current.value + '.docx' : '')}
      </div>
      <DocumentEditorContainerComponent
        ref={containerRef}
        height="calc(100vh - 65px)"
        serviceUrl="https://ej2services.syncfusion.com/production/web-services/api/documenteditor/"
        enableToolbar={true}
        toolbarItems={toolbarItems}
        toolbarClick={handleToolbarItemClick}
        contentChange={handleContentChange}
      />
      <DialogComponent
        visible={showDialog}
        header='New Document'
        showCloseIcon={true}
        width='400px'
        isModal={true}
        close={() => setShowDialog(false)}
        buttons={[
          {
            click: handleDialogSave,
            buttonModel: { content: 'Save', isPrimary: true }
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