import { useEffect, useState, useCallback } from "react";
import { CodeEditor } from "@/components/ui/CodeEditor";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { FileTree } from "@/components/ui/FileTree";
import { WorkspaceData, getFileContent } from "@/lib/workspace/serialize";

interface WorkspaceEditorProps {
  initialData: WorkspaceData;
  snapshotId: string;
  workspaceId: string;
}

export function WorkspaceEditor({ initialData, snapshotId, workspaceId }: WorkspaceEditorProps) {
  const [data, setData] = useState(initialData);
  const [selectedPath, setSelectedPath] = useState<string | null>(
    data.workspace.snapshot.files[0]?.path || null
  );
  const [currentContent, setCurrentContent] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Map of file paths to their fetched base contents
  const [baseContents, setBaseContents] = useState<Record<string, string>>({});

  const loadFile = useCallback(async (path: string) => {
    setIsLoading(true);
    try {
      let base = baseContents[path];
      if (base === undefined) {
        const res = await fetch(`/api/snapshots/${snapshotId}/files?path=${encodeURIComponent(path)}&includeContent=1`);
        if (res.ok) {
          const { file } = await res.json();
          base = file.contentBase64 ? atob(file.contentBase64) : "";
          setBaseContents((prev) => ({ ...prev, [path]: base }));
        }
      }
      
      const content = getFileContent(data, path, base);
      setCurrentContent(content);
      setIsDirty(false);
    } finally {
      setIsLoading(false);
    }
  }, [baseContents, data, snapshotId]);

  useEffect(() => {
    if (selectedPath) {
      loadFile(selectedPath);
    }
  }, [selectedPath, loadFile]);

  const handleSave = async () => {
    if (!selectedPath) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: selectedPath, content: currentContent }),
      });
      if (res.ok) {
        const edit = await res.json();
        setData((prev) => ({
          ...prev,
          workspace: {
            ...prev.workspace,
            edits: [
              ...prev.workspace.edits.filter((e) => e.path !== selectedPath),
              edit,
            ],
          },
        }));
        setIsDirty(false);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
      <div className="lg:col-span-1 flex flex-col gap-4">
        <Heading level="h3">Files</Heading>
        <Card padding="none" tone="default" className="max-h-[600px] overflow-auto">
          <FileTree
            paths={data.workspace.snapshot.files.map((f) => f.path)}
            selectedPath={selectedPath}
            onSelect={setSelectedPath}
          />
        </Card>
      </div>

      <div className="lg:col-span-3 flex flex-col gap-4">
        {selectedPath ? (
          <>
            <div className="flex justify-between items-center">
              <div className="flex flex-col">
                <Heading level="h3" className="font-mono">{selectedPath}</Heading>
                {isDirty && <Text tone="muted" size="caption">Unsaved changes</Text>}
              </div>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={!isDirty || isSaving || isLoading}
              >
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
            
            <Card padding="none" tone="raised" className="relative min-h-[500px]">
              {isLoading && (
                <div className="absolute inset-0 bg-mdt-surface/50 flex items-center justify-center z-10">
                  <Text>Loading...</Text>
                </div>
              )}
              <CodeEditor
                value={currentContent}
                onChange={(e) => {
                  setCurrentContent(e.target.value);
                  setIsDirty(true);
                }}
                className="w-full h-full min-h-[500px] p-4 resize-none focus:ring-0 border-0"
                placeholder="File content..."
              />
            </Card>
          </>
        ) : (
          <div className="flex items-center justify-center h-[500px] bg-mdt-surface-subtle border border-dashed border-mdt-border rounded-mdt-lg">
            <Text tone="muted">Select a file to edit</Text>
          </div>
        )}
      </div>
    </div>
  );
}