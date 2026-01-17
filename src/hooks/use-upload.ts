import { useState } from 'react';
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

  const uploadFile = async (file: File): Promise<string | null> => {
    setIsUploading(true);
    setProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const token = getAuthToken();
      
      const response = await fetch(`${API_URL}/api/uploads`, {
        method: 'POST',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao fazer upload');
      }

      const result: UploadResult = await response.json();
      setProgress(100);
      
      return result.file.url;
    } catch (error) {
      console.error('Upload error:', error);
      throw error;
    } finally {
      setIsUploading(false);
    }
  };

  return {
    uploadFile,
    isUploading,
    progress,
  };
}
