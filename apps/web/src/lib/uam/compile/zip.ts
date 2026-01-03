import { CompiledFile } from '../adapters';

export async function createZip(files: CompiledFile[]): Promise<Blob> {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  
  for (const file of files) {
    zip.file(file.path, file.content);
  }
  
  return await zip.generateAsync({ type: 'blob' });
}
