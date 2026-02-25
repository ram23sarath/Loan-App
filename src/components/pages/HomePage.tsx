import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import type { Document } from '../../types';

const HomePage: React.FC = () => {
  // Document management state
  const [documents, setDocuments] = useState<Document[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  // Fetch documents from Supabase
  const fetchDocuments = async () => {
    setDocumentsLoading(true);
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (err: any) {
      setMessage({ type: 'error', text: `Failed to load documents: ${err.message}` });
    } finally {
      setDocumentsLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  // Upload document to Supabase Storage
  const handleUploadDocument = async () => {
    if (!selectedFile) return;

    setUploadProgress(10);
    setMessage(null);

    try {
      // Generate unique filename
      const timestamp = Date.now();
      const fileName = `${timestamp}_${selectedFile.name}`;
      const filePath = `documents/${fileName}`;

      setUploadProgress(30);

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('public-documents')
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      setUploadProgress(70);

      // Create database record
      const { error: dbError } = await supabase
        .from('documents')
        .insert({
          name: selectedFile.name,
          file_path: filePath,
          file_size: selectedFile.size,
          uploaded_by: 'admin', // Could be enhanced to use actual user email
        });

      if (dbError) throw dbError;

      setUploadProgress(100);
      setMessage({ type: 'success', text: `"${selectedFile.name}" uploaded successfully!` });
      setSelectedFile(null);

      // Refresh documents list
      await fetchDocuments();
    } catch (err: any) {
      setMessage({ type: 'error', text: `Upload failed: ${err.message}` });
    } finally {
      setUploadProgress(0);
    }
  };

  // Delete document
  const handleDeleteDocument = async (doc: Document) => {
    setDeletingDocId(doc.id);
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('public-documents')
        .remove([doc.file_path]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from('documents')
        .delete()
        .eq('id', doc.id);

      if (dbError) throw dbError;

      setMessage({ type: 'success', text: `"${doc.name}" deleted successfully!` });
      await fetchDocuments();
    } catch (err: any) {
      setMessage({ type: 'error', text: `Delete failed: ${err.message}` });
    } finally {
      setDeletingDocId(null);
    }
  };

  return (
    <div className="flex flex-col h-full w-full max-w-6xl mx-auto px-4 py-8 pb-28 sm:pb-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-dark-text tracking-tight">
          Welfare Loan App
        </h1>
        <p className="mt-2 text-gray-600 dark:text-dark-muted">
          Fire Drivers Welfare Association
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
        {/* Documents Widget */}
        <motion.div 
            className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border overflow-hidden h-fit"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
        >
          <div className="px-4 py-3 border-b border-gray-100 dark:border-dark-border flex justify-between items-center bg-gray-50/50 dark:bg-slate-800/50">
            <h2 className="text-base font-semibold text-gray-800 dark:text-dark-text flex items-center gap-2">
              <span>📄</span> Documents
            </h2>
            <div className="flex gap-1">
                <button
                onClick={fetchDocuments}
                disabled={documentsLoading}
                className="text-violet-600 hover:bg-violet-50 p-1.5 rounded-md transition-colors dark:text-violet-400 dark:hover:bg-violet-900/30"
                title="Refresh"
                >
                <span className="text-lg leading-none">{documentsLoading ? '⏳' : '🔄'}</span>
                </button>
            </div>
          </div>

          <div className="p-4">
             {/* Upload Mini-Form */}
            <div className="mb-4">
                <div className="flex gap-2">
                    <label className="flex-1 min-w-0 pointer-events-auto cursor-pointer">
                         <input
                            type="file"
                            accept=".pdf"
                            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                            className="hidden"
                        />
                        <div className={`w-full px-3 py-2 text-sm border rounded-lg flex items-center gap-2 transition-colors truncate ${selectedFile ? 'bg-violet-50 border-violet-200 text-violet-700 dark:bg-violet-900/20 dark:border-violet-800 dark:text-violet-300' : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100 dark:bg-slate-800/50 dark:border-slate-700 dark:text-dark-muted dark:hover:bg-slate-800'}`}>
                           <span className="text-lg flex-shrink-0">
                               {selectedFile ? '📎' : '➕'}
                           </span>
                           <span className="truncate">
                               {selectedFile ? selectedFile.name : 'Add PDF'}
                           </span>
                        </div>
                    </label>
                    <AnimatePresence>
                        {selectedFile && (
                            <motion.button
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                onClick={handleUploadDocument}
                                disabled={uploadProgress > 0}
                                className="px-3 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-400 text-white font-medium rounded-lg text-sm shadow-sm transition-colors whitespace-nowrap"
                            >
                                {uploadProgress > 0 ? `${uploadProgress}%` : 'Upload'}
                            </motion.button>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Message */}
            <AnimatePresence>
                {message && (
                <motion.div
                    className={`mb-3 px-3 py-2 rounded-md text-xs border flex items-center justify-between ${message.type === 'success' ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800' : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800'}`}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                >
                    <span>{message.text}</span>
                    <button onClick={() => setMessage(null)} className="ml-2 font-bold opacity-60 hover:opacity-100">×</button>
                </motion.div>
                )}
            </AnimatePresence>

            {/* Compact List */}
            <div className={`space-y-2 overflow-y-auto custom-scrollbar transition-all duration-300 ${isExpanded ? 'max-h-[500px]' : 'max-h-[240px]'}`}>
                {documentsLoading && documents.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 dark:text-dark-muted">
                        <div className="animate-spin text-xl mb-2">⏳</div>
                        <span className="text-xs">Loading...</span>
                    </div>
                ) : documents.length === 0 ? (
                    <div className="text-center py-6 text-gray-400 dark:text-dark-muted border-2 border-dashed border-gray-100 dark:border-slate-700 rounded-lg">
                        <span className="text-2xl block mb-1">📭</span>
                        <span className="text-xs">No documents</span>
                    </div>
                ) : (
                    documents.map((doc) => (
                        <div key={doc.id} className="group flex items-center justify-between p-2.5 bg-gray-50 hover:bg-white border border-transparent hover:border-gray-200 rounded-lg transition-all dark:bg-slate-800/50 dark:hover:bg-slate-700 dark:hover:border-slate-600">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div className="w-8 h-8 rounded bg-white border border-gray-100 flex items-center justify-center text-lg shadow-sm flex-shrink-0 dark:bg-slate-700 dark:border-slate-600">
                                    📄
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate" title={doc.name}>
                                        {doc.name}
                                    </div>
                                    <div className="text-[10px] text-gray-400 dark:text-gray-500 flex gap-2">
                                        <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                                        <span>•</span>
                                        <span>{doc.file_size ? `${(doc.file_size / 1024).toFixed(0)} KB` : ''}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <a 
                                    href={supabase.storage.from('public-documents').getPublicUrl(doc.file_path).data.publicUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="p-1.5 text-gray-500 hover:text-violet-600 hover:bg-violet-50 rounded dark:text-gray-400 dark:hover:text-violet-400 dark:hover:bg-violet-900/30"
                                    title="View"
                                >
                                    👁️
                                </a>
                                <button
                                    onClick={() => handleDeleteDocument(doc)}
                                    disabled={deletingDocId === doc.id}
                                    className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded dark:text-gray-400 dark:hover:text-red-400 dark:hover:bg-red-900/30"
                                    title="Delete"
                                >
                                    {deletingDocId === doc.id ? '⏳' : '🗑️'}
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
            {documents.length > 4 && (
                <button 
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="w-full text-center text-xs text-gray-400 hover:text-gray-600 mt-2 py-1 border-t border-gray-50 dark:border-slate-800 dark:text-gray-500 dark:hover:text-gray-300"
                >
                    {isExpanded ? 'Show Less' : `Show All (${documents.length})`}
                </button>
            )}
          </div>
        </motion.div>

        {/* Placeholder for future feature */}
        <motion.div 
            className="border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-xl flex items-center justify-center min-h-[200px] text-gray-400 dark:text-slate-600"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
        >
            <div className="text-center">
                <span className="text-4xl block mb-2 opacity-30">✨</span>
                <span className="text-sm font-medium">Future Dashboard Widget</span>
            </div>
        </motion.div>
      </div>
    </div>
  );
};

export default HomePage;
