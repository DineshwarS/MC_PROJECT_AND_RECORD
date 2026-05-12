import React, { useState, useRef, useEffect } from 'react';
import { Settings, UploadCloud, X, File, FileText, User, FileImage, ShieldCheck } from 'lucide-react';
import './index.css';

function App() {
  const [apiKey, setApiKey] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  const [files, setFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);

  const fileInputRef = useRef(null);

  useEffect(() => {
    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey) setApiKey(savedKey);
  }, []);

  const handleSaveApiKey = () => {
    localStorage.setItem('gemini_api_key', apiKey);
    setIsSettingsOpen(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const newFiles = Array.from(e.dataTransfer.files);
      setFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const removeFile = (indexToRemove) => {
    setFiles(files.filter((_, i) => i !== indexToRemove));
  };

  const handleProcess = async () => {
    if (files.length === 0) return;
    
    if (!apiKey) {
      setIsSettingsOpen(true);
      return;
    }

    setIsLoading(true);
    setError(null);
    setResults(null);

    const formData = new FormData();
    formData.append('apiKey', apiKey);
    files.forEach((file) => {
      formData.append('documents', file);
    });

    try {
      const response = await fetch('http://localhost:3000/api/process-documents', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process documents');
      }

      setResults(data.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const renderIcon = (filename) => {
    const ext = filename.split('.').pop().toLowerCase();
    if (['pdf'].includes(ext)) return <FileText size={20} className="text-red-400" style={{color: '#f87171'}} />;
    if (['jpg', 'jpeg', 'png'].includes(ext)) return <FileImage size={20} className="text-blue-400" style={{color: '#60a5fa'}} />;
    return <File size={20} style={{color: '#cbd5e1'}} />;
  };

  const renderExtractedFields = (info) => {
    if (!info) return null;

    const fields = [];
    
    // Flatten the info object
    const processObject = (obj, prefix = '') => {
      Object.entries(obj).forEach(([key, value]) => {
        if (value === null || value === undefined || value === '') return;
        
        // Skip adding OtherRelevantFields to the label prefix
        const newPrefix = key === 'OtherRelevantFields' ? prefix : `${prefix}${key} `;
        
        if (typeof value === 'object' && !Array.isArray(value)) {
          processObject(value, newPrefix);
        } else {
          fields.push(
            <div className="doc-field" key={`${prefix}${key}`}>
              <span className="doc-field-label">{key === 'OtherRelevantFields' ? prefix : newPrefix.trim()}</span>
              <span className="doc-field-value">{String(value)}</span>
            </div>
          );
        }
      });
    };

    processObject(info);
    return fields;
  };

  return (
    <div className="container">
      {/* Header */}
      <header className="app-header text-center">
        <div className="flex justify-between items-center" style={{ marginBottom: '1rem' }}>
          <div style={{ width: 40 }}></div>
          <h1 className="title-gradient flex items-center gap-4 justify-center" style={{ margin: 0 }}>
            <ShieldCheck size={40} color="#818cf8" /> AI Doc Separator
          </h1>
          <button className="btn-icon" onClick={() => setIsSettingsOpen(true)}>
            <Settings size={24} />
          </button>
        </div>
        <p className="subtitle">
          Intelligently extract, categorize, and group documents belonging to different people into unified biodata profiles using Gemini AI.
        </p>
      </header>

      <main>
        {/* Upload Section */}
        {!results && !isLoading && (
          <div className="glass-panel" style={{ maxWidth: 800, margin: '0 auto' }}>
            <div 
              className={`upload-zone ${isDragging ? 'drag-active' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <UploadCloud size={64} className="upload-icon" />
              <h3>Drag & Drop Documents Here</h3>
              <p>or click to browse from your computer</p>
              <p style={{ fontSize: '0.875rem', marginTop: '0.5rem', opacity: 0.7 }}>
                Supports ZIP, PDF, JPG, PNG (PAN, Aadhar, Birth Certificates, Resumes, etc.)
              </p>
              <input 
                type="file" 
                multiple 
                accept=".pdf,.jpg,.jpeg,.png,.zip"
                ref={fileInputRef}
                onChange={handleFileSelect}
                style={{ display: 'none' }} 
              />
            </div>

            {files.length > 0 && (
              <div className="mt-8">
                <div className="flex justify-between items-center">
                  <h4 style={{ margin: 0 }}>Selected Files ({files.length})</h4>
                  <button 
                    className="btn-primary" 
                    onClick={handleProcess}
                  >
                    Process with AI
                  </button>
                </div>
                
                <div className="file-list">
                  {files.map((file, idx) => (
                    <div className="file-item" key={idx}>
                      <div className="file-info">
                        {renderIcon(file.name)}
                        <span className="file-name">{file.name}</span>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </span>
                      </div>
                      <button 
                        className="btn-icon" 
                        style={{ padding: '0.3rem', border: 'none', background: 'transparent' }}
                        onClick={() => removeFile(idx)}
                      >
                        <X size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {error && (
              <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: 8, color: '#fca5a5' }}>
                <strong>Error: </strong> {error}
              </div>
            )}
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="loader-container glass-panel" style={{ maxWidth: 800, margin: '0 auto' }}>
            <div className="spinner"></div>
            <h3>AI is Analyzing Documents...</h3>
            <p>Extracting text, identifying document types, and grouping by person.</p>
          </div>
        )}

        {/* Results State */}
        {results && !isLoading && (
          <div>
            <div className="flex justify-between items-center" style={{ marginBottom: '2rem' }}>
              <h2>Extracted Profiles</h2>
              <button className="btn-primary" onClick={() => { setResults(null); setFiles([]); }}>
                Start Over
              </button>
            </div>
            
            <div className="results-grid">
              {results.map((person, pIdx) => (
                <div className="glass-panel person-card" key={pIdx}>
                  <div className="person-header">
                    <div className="person-avatar">
                      <User size={24} color="#fff" />
                    </div>
                    <h3 className="person-name">{person.personName || 'Unknown Person'}</h3>
                  </div>
                  
                  <div className="doc-list">
                    {person.documents && person.documents.map((doc, dIdx) => (
                      <div className="doc-card" key={dIdx}>
                        <div className="doc-header">
                          <FileText size={16} color="#818cf8"/>
                          <span className="doc-type">{doc.type}</span>
                        </div>
                        
                        <div className="doc-info">
                          {renderExtractedFields(doc.extractedInfo)}
                        </div>

                        {doc.fileUrls && doc.fileUrls.length > 0 && (
                          <div className="doc-previews-container">
                            {doc.fileUrls.map((url, i) => (
                              <div className="doc-preview" key={i} onClick={() => setSelectedImage(url)}>
                                <div className="doc-preview-loading">Loading...</div>
                                <img 
                                  src={url} 
                                  alt={`${doc.type} ${i + 1}`} 
                                  onLoad={(e) => { e.target.previousSibling.style.display = 'none'; e.target.style.opacity = 1; }}
                                  onError={(e) => { e.target.previousSibling.textContent = 'Error loading image'; }}
                                  style={{ opacity: 0 }}
                                />
                                <div className="doc-preview-overlay">
                                  View {doc.type} {doc.fileUrls.length > 1 ? i + 1 : ''}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '1rem', textAlign: 'center' }}>
                          File: {doc.filenames ? doc.filenames.join(', ') : doc.filename}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">Settings</h3>
              <button 
                className="btn-icon" 
                style={{ background: 'transparent', border: 'none' }}
                onClick={() => setIsSettingsOpen(false)}
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="form-group">
              <label className="form-label">Google Gemini API Key</label>
              <input 
                type="password" 
                className="form-input" 
                placeholder="AIzaSy..." 
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <p style={{ fontSize: '0.75rem', marginTop: '0.5rem' }}>
                Your API key is stored securely in your browser's local storage and is only sent directly to the backend processing server.
              </p>
            </div>
            
            <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={handleSaveApiKey}>
              Save Settings
            </button>
          </div>
        </div>
      )}

      {/* Image Viewer Modal */}
      {selectedImage && (
        <div className="image-viewer-overlay" onClick={() => setSelectedImage(null)}>
          <div className="image-viewer-container" onClick={(e) => e.stopPropagation()}>
            <button className="close-viewer" onClick={() => setSelectedImage(null)}>
              <X size={24} />
            </button>
            <img src={selectedImage} alt="Document Preview" />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
