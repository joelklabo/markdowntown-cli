import JSZip from "jszip";

export async function generateWorkspaceZip(
  files: Array<{ path: string; content: string }>
): Promise<Buffer> {
  const zip = new JSZip();

  for (const file of files) {
    zip.file(file.path, file.content);
  }

  const content = await zip.generateAsync({ type: "nodebuffer" });
  return content;
}
