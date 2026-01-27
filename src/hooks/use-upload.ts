import { useState, useCallback } from 'react';
import { API_URL, getAuthToken } from '@/lib/api';

interface UploadResult {
  success: boolean;
  file: {
    filename: string;
    originalName: string;
    mimetype: string;
    size: number;
    url: string;
  };
}

export function useUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const uploadFile = useCallback(async (file: File): Promise<string | null> => {
    setIsUploading(true);
    setProgress(0);

    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', file);

      const token = getAuthToken();
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          setProgress(percentComplete);
        }
      });

      xhr.addEventListener('load', () => {
        setIsUploading(false);
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const result: UploadResult = JSON.parse(xhr.responseText);
            setProgress(100);
            resolve(result.file.url);
          } catch {
            reject(new Error('Erro ao processar resposta'));
          }
        } else {
          try {
            const error = JSON.parse(xhr.responseText);
            reject(new Error(error.error || 'Erro ao fazer upload'));
          } catch {
            reject(new Error(`Erro ao fazer upload (${xhr.status})`));
          }
        }
      });

      xhr.addEventListener('error', () => {
        setIsUploading(false);
        setProgress(0);
        reject(new Error('Erro de conexão'));
      });

      xhr.addEventListener('abort', () => {
        setIsUploading(false);
        setProgress(0);
        reject(new Error('Upload cancelado'));
      });

      xhr.open('POST', `${API_URL}/api/uploads`);
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }
      xhr.send(formData);
    });
  }, []);

  const resetProgress = useCallback(() => {
    setProgress(0);
  }, []);

  return {
    uploadFile,
    isUploading,
    progress,
    resetProgress,
  };
}
