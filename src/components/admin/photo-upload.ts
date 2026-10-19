// Envio de fotografias de viaturas para o servidor (rotas /api/admin). O showroom estático
// (GitHub Pages) substitui este módulo por uma versão que envia diretamente para o Supabase Storage.

export type UploadResult = { ok: boolean; error?: string };

function send(url: string, body: FormData, onProgress: (p: number) => void): Promise<UploadResult> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      let data: { error?: string; errors?: string[] } = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        /* resposta vazia */
      }
      const err = data.error ?? data.errors?.[0];
      resolve({ ok: xhr.status >= 200 && xhr.status < 300 && !err, error: err ?? (xhr.status >= 300 ? `Erro ${xhr.status}` : undefined) });
    };
    xhr.onerror = () => resolve({ ok: false, error: "Falha de ligação durante o envio." });
    xhr.send(body);
  });
}

export function uploadVehiclePhoto(vehicleId: string, file: File, onProgress: (p: number) => void): Promise<UploadResult> {
  const body = new FormData();
  body.append("files", file);
  return send(`/api/admin/vehicles/${vehicleId}/photos`, body, onProgress);
}

export function replaceVehiclePhoto(photoId: string, file: File): Promise<UploadResult> {
  const body = new FormData();
  body.append("file", file);
  return send(`/api/admin/photos/${photoId}`, body, () => {});
}
