import { useState, useRef } from "react";
import { toast } from "sonner";
import { 
  FileText, 
  FileImage, 
  File, 
  FileSpreadsheet, 
  FileType, 
  FileArchive 
} from "lucide-react";

// 允许的文件类型配置（白名单）
const ALLOWED_FILE_TYPES: Record<string, { ext: string; label: string }> = {
  // 文档
  'application/pdf': { ext: '.pdf', label: 'PDF' },
  'application/msword': { ext: '.doc', label: 'Word' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { ext: '.docx', label: 'Word' },
  // 表格
  'application/vnd.ms-excel': { ext: '.xls', label: 'Excel' },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { ext: '.xlsx', label: 'Excel' },
  'text/csv': { ext: '.csv', label: 'CSV' },
  // 演示文稿
  'application/vnd.ms-powerpoint': { ext: '.ppt', label: 'PPT' },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': { ext: '.pptx', label: 'PPT' },
  // 文本
  'text/plain': { ext: '.txt', label: '文本' },
  // 压缩文件
  'application/zip': { ext: '.zip', label: 'ZIP' },
  'application/x-rar-compressed': { ext: '.rar', label: 'RAR' },
  'application/x-7z-compressed': { ext: '.7z', label: '7Z' },
};

// 文件大小限制（20MB）
const MAX_FILE_SIZE = 20 * 1024 * 1024;

interface UseFileHandlersProps {
  conversationId: string;
}

export function useFileHandlers({ conversationId }: UseFileHandlersProps) {
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [previewFileUrl, setPreviewFileUrl] = useState<string | null>(null);
  const [previewFileName, setPreviewFileName] = useState<string>("");
  const [previewFileType, setPreviewFileType] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);

  // 文件名清理函数 - 移除特殊字符和非ASCII字符
  const sanitizeFileName = (fileName: string): string => {
    const lastDotIndex = fileName.lastIndexOf('.');
    const ext = lastDotIndex !== -1 ? fileName.substring(lastDotIndex) : '';
    const nameWithoutExt = lastDotIndex !== -1 ? fileName.substring(0, lastDotIndex) : fileName;
    
    const sanitized = nameWithoutExt
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_]+/g, '_')
      .replace(/-+/g, '-')
      .toLowerCase();
    
    const finalName = sanitized || 'file';
    return `${finalName}${ext}`;
  };

  // 根据文件类型返回对应的图标组件
  const getFileIcon = (fileType: string, fileName: string) => {
    if (fileType.startsWith('image/')) return FileImage;
    if (fileType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) return FileText;
    if (fileType.includes('word') || /\.(doc|docx)$/i.test(fileName)) return FileType;
    if (fileType.includes('excel') || fileType.includes('spreadsheet') || /\.(xls|xlsx)$/i.test(fileName)) return FileSpreadsheet;
    if (fileType.includes('zip') || fileType.includes('rar') || /\.(zip|rar|7z)$/i.test(fileName)) return FileArchive;
    return File;
  };

  // 验证文件
  const validateFile = (file: File): { valid: boolean; error?: string } => {
    if (!ALLOWED_FILE_TYPES[file.type]) {
      return { valid: false, error: `不支持的文件类型: ${file.name}` };
    }
    
    if (file.size > MAX_FILE_SIZE) {
      return { valid: false, error: `文件过大: ${file.name}（最大20MB）` };
    }
    
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    const expectedExt = ALLOWED_FILE_TYPES[file.type].ext;
    if (ext !== expectedExt) {
      return { valid: false, error: `文件扩展名不匹配: ${file.name}` };
    }
    
    return { valid: true };
  };

  // 图片上传
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newFiles = Array.from(files);
    const newPreviewUrls = newFiles.map(file => URL.createObjectURL(file));
    
    setSelectedImages(prev => [...prev, ...newFiles]);
    setImagePreviewUrls(prev => [...prev, ...newPreviewUrls]);
  };

  // 移除图片
  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviewUrls(prev => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  };

  // 文件选择
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    const validFiles: File[] = [];
    
    for (const file of Array.from(files)) {
      const validation = validateFile(file);
      if (validation.valid) {
        validFiles.push(file);
      } else {
        toast.error(validation.error);
      }
    }
    
    if (validFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...validFiles]);
    }
  };

  // 移除文件
  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // 拖放上传处理
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    if (x <= rect.left || x >= rect.right || y <= rect.top || y >= rect.bottom) {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    const imageFiles: File[] = [];
    const documentFiles: File[] = [];

    files.forEach(file => {
      if (file.type.startsWith('image/')) {
        imageFiles.push(file);
      } else {
        const validation = validateFile(file);
        if (validation.valid) {
          documentFiles.push(file);
        } else {
          toast.error(validation.error);
        }
      }
    });

    if (imageFiles.length > 0) {
      const newPreviewUrls = imageFiles.map(file => URL.createObjectURL(file));
      setSelectedImages(prev => [...prev, ...imageFiles]);
      setImagePreviewUrls(prev => [...prev, ...newPreviewUrls]);
    }

    if (documentFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...documentFiles]);
    }
  };

  // 文件预览
  const handleFilePreview = (fileUrl: string, fileName: string, fileType: string) => {
    setPreviewFileUrl(fileUrl);
    setPreviewFileName(fileName);
    setPreviewFileType(fileType);
  };

  // 相机拍照
  const handleCameraCapture = (file: File) => {
    const previewUrl = URL.createObjectURL(file);
    setSelectedImages(prev => [...prev, file]);
    setImagePreviewUrls(prev => [...prev, previewUrl]);
  };

  // 清空选择
  const clearSelections = () => {
    imagePreviewUrls.forEach(url => URL.revokeObjectURL(url));
    setSelectedImages([]);
    setImagePreviewUrls([]);
    setSelectedFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (documentInputRef.current) documentInputRef.current.value = "";
  };

  return {
    // 状态
    selectedImages,
    imagePreviewUrls,
    selectedFiles,
    isDragging,
    previewImageUrl,
    previewFileUrl,
    previewFileName,
    previewFileType,
    fileInputRef,
    documentInputRef,
    
    // 方法
    sanitizeFileName,
    getFileIcon,
    validateFile,
    handleImageUpload,
    removeImage,
    handleFileSelect,
    removeFile,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleFilePreview,
    handleCameraCapture,
    clearSelections,
    setPreviewImageUrl,
    setPreviewFileUrl,
    setPreviewFileName,
    setPreviewFileType,
    setSelectedImages,
    setImagePreviewUrls,
    setSelectedFiles,
  };
}
