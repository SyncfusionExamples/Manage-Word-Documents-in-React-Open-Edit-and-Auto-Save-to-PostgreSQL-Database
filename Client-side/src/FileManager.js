import { FileManagerComponent, Inject, NavigationPane, DetailsView, Toolbar as FileManagerToolbar} from '@syncfusion/ej2-react-filemanager';
import { DialogComponent } from '@syncfusion/ej2-react-popups';

const FileManager = ({ onFileSelect, onFileManagerLoaded, editorRef, fileManagerRef, visible, setVisible }) => {
    const onSuccess = (args) => {
        const maxId = args.result.docCount;
        if (onFileManagerLoaded) onFileManagerLoaded(maxId);
    };
    const hostUrl = 'https://localhost:44305/';

    const loadDocument = async (docId) => {
        try {
            const response = await fetch(hostUrl + `api/documents/${docId}/getDocumentAsync`);
            const data = await response.text();
            if (editorRef?.current?.documentEditor) {
                editorRef.current.documentEditor.open(data);
            }
        } catch (err) {
            console.error('Error loading document', err);
        }
    };

    const handleFileOpen = (args) => {
        if (args.fileDetails.isFile) {
            const fileId = args.fileDetails.id;
            const fileName = args.fileDetails.name;
            if (typeof onFileSelect === 'function') {
                onFileSelect(fileId, fileName);
            }
            loadDocument(fileId);
            setVisible(false); // Close dialog
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
            beforeClose={() => setVisible(false)}
            onClose={() => setVisible(false)}
        >
            <FileManagerComponent
                id="azure-file-manager"
                ref={fileManagerRef}
                ajaxSettings={{
                    url: hostUrl + 'api/documents',
                    downloadUrl: hostUrl + 'api/documents/downloadAsync',
                }}
                toolbarSettings={{
                    items: ['SortBy', 'Copy', 'Paste', 'Delete', 'Refresh', 'Download', 'Selection', 'View', 'Details'],
                }}
                contextMenuSettings={{
                    file: ['Open', 'Copy', '|', 'Delete', 'Download', '|', 'Details'],
                    layout: ['SortBy', 'View', 'Refresh', '|', 'Paste', '|', '|', 'Details', '|', 'SelectAll'],
                    visible: true,
                }}
                fileOpen={handleFileOpen}
                success={onSuccess}
            >
                <Inject services={[NavigationPane, DetailsView, FileManagerToolbar]} />
            </FileManagerComponent>
        </DialogComponent>
    );
};

export default FileManager;