import { FileManagerComponent, Inject, NavigationPane, DetailsView, Toolbar as FileManagerToolbar} from '@syncfusion/ej2-react-filemanager';
import { DialogComponent } from '@syncfusion/ej2-react-popups';

// FileManager component props:
// - onFileSelect: callback when a file is selected
// - onFileManagerLoaded: callback on initial load with document count
// - editorRef: reference to the Syncfusion DocumentEditor
// - fileManagerRef: reference to this FileManager component
// - visible: controls visibility of the dialog
// - setVisible: function to toggle dialog visibility
const FileManager = ({ onFileSelect, onFileManagerLoaded, editorRef, fileManagerRef, visible, setVisible }) => {

    // Called after FileManager successfully loads
    const onSuccess = (args) => {
        const maxId = args.result.docCount; // Retrieve document count
        if (onFileManagerLoaded) onFileManagerLoaded(maxId); // Call parent callback
    };

    // Base API URL
    const hostUrl = 'https://localhost:44305/';

    // Loads a document by its ID into the DocumentEditor
    const loadDocument = async (docId) => {
        try {
            const response = await fetch(hostUrl + `api/PostgresDocumentStorage/${docId}/getDocumentAsync`);
            const data = await response.text();
            if (editorRef?.current?.documentEditor) {
                editorRef.current.documentEditor.open(data); // Load content into the editor
            }
        } catch (err) {
            console.error('Error loading document', err);
        }
    };

    // Triggered when a file is opened via double-click or context menu
    const handleFileOpen = (args) => {
        if (args.fileDetails.isFile) {
            const fileId = args.fileDetails.id;
            const fileName = args.fileDetails.name;
            if (typeof onFileSelect === 'function') {
                onFileSelect(fileId, fileName); // Call parent callback with file info
            }
            loadDocument(fileId); // Load the selected document
            setVisible(false); // Close the dialog
        }
    };

    return (
        <DialogComponent
            id="dialog-component-sample"
            header="File Manager"
            visible={visible}
            width="95%"
            height="85%"
            showCloseIcon={true}
            closeOnEscape={true}
            target="body"
            beforeClose={() => setVisible(false)} // Set dialog visibility to false before closing
            onClose={() => setVisible(false)} // Ensure dialog state is updated on close
        >
            <FileManagerComponent
                id="azure-file-manager"
                ref={fileManagerRef}
                ajaxSettings={{
                    url: hostUrl + 'api/PostgresDocumentStorage', // API for file management
                    downloadUrl: hostUrl + 'api/PostgresDocumentStorage/downloadAsync', // API for file download
                }}
                toolbarSettings={{
                    items: ['SortBy', 'Copy', 'Paste', 'Delete', 'Refresh', 'Download', 'Selection', 'View', 'Details'],
                }}
                contextMenuSettings={{
                    file: ['Open', 'Copy', '|', 'Delete', 'Download', '|', 'Details'], // Context menu options for files
                    layout: ['SortBy', 'View', 'Refresh', '|', 'Paste', '|', '|', 'Details', '|', 'SelectAll'], // Layout menu options
                    visible: true,
                }}
                fileOpen={handleFileOpen} // Callback for opening a file
                success={onSuccess} // Callback for successful data load
            >
                {/* Inject necessary services for FileManager */}
                <Inject services={[NavigationPane, DetailsView, FileManagerToolbar]} />
            </FileManagerComponent>
        </DialogComponent>
    );
};

export default FileManager;