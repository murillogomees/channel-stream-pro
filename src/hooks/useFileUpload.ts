import { useState } from 'react';

const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
  'text/csv',
  'text/plain',
  'audio/mpeg', // mp3
  'audio/mp4', // m4a
  'audio/ogg',
  'audio/wav',
  'audio/opus',
  'video/mp4',
];

const MAX_FILE_SIZE_MB = 20;

export function useFileUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const validateFileType = (file: File): boolean => {
    return ALLOWED_FILE_TYPES.includes(file.type);
  };

  const validateFileSize = (file: File): boolean => {
    const fileSizeMB = file.size / (1024 * 1024);
    return fileSizeMB <= MAX_FILE_SIZE_MB;
  };

  const getFilePreview = async (file: File): Promise<string | null> => {
    if (file.type.startsWith('image/')) {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
    }
    return null;
  };

  const handleFileSelect = async (selectedFile: File | null) => {
    if (!selectedFile) {
      setFile(null);
      setPreview(null);
      setError(null);
      return;
    }

    // Validate type
    if (!validateFileType(selectedFile)) {
      setError('Tipo de arquivo não suportado');
      setFile(null);
      setPreview(null);
      return;
    }

    // Validate size
    if (!validateFileSize(selectedFile)) {
      setError(`Arquivo muito grande. Tamanho máximo: ${MAX_FILE_SIZE_MB}MB`);
      setFile(null);
      setPreview(null);
      return;
    }

    setError(null);
    setFile(selectedFile);

    // Generate preview for images
    const previewUrl = await getFilePreview(selectedFile);
    setPreview(previewUrl);
  };

  const clearFile = () => {
    setFile(null);
    setPreview(null);
    setError(null);
  };

  const getFileInfo = () => {
    if (!file) return null;

    return {
      name: file.name,
      type: file.type,
      size: file.size,
      sizeFormatted: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
    };
  };

  return {
    file,
    preview,
    error,
    handleFileSelect,
    clearFile,
    getFileInfo,
    validateFileType,
    validateFileSize,
  };
}
