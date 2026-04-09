import React, { useState, useEffect, useRef } from 'react';
import { Upload, FileText, CheckCircle, XCircle, Loader2, Database, Zap, ArrowRight, History, BarChart3 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Decision {
  service: 'Lambda' | 'Glue';
  memoryAllocation: string;
  estimatedCost: number;
  explanation: string;
}

interface JobStatus {
  id: string;
  status: 'Uploading' | 'Processing' | 'Completed' | 'Failed';
  fileName: string;
  fileSizeMB: number;
  fileType: string;
  decision?: Decision;
  result?: {
    duration: number;
    cost: number;
    processedPath?: string;
    error?: string;
  };
}

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Polling logic
  useEffect(() => {
    if (jobId && jobStatus?.status !== 'Completed' && jobStatus?.status !== 'Failed') {
      pollingRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/status/${jobId}`);
          const data = await res.json();
          setJobStatus(data);
          
          if (data.status === 'Completed' || data.status === 'Failed') {
            if (pollingRef.current) clearInterval(pollingRef.current);
          }
        } catch (err) {
          console.error('Polling error:', err);
        }
      }, 1000);
    }

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [jobId, jobStatus?.status]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setJobId(null);
      setJobStatus(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      setJobId(data.jobId);
      setIsUploading(false);
    } catch (err) {
      console.error('Upload error:', err);
      setIsUploading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
      case 'Failed': return 'text-rose-400 bg-rose-400/10 border-rose-400/20';
      case 'Processing': return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
      default: return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-slate-200 p-4 md:p-8 font-sans selection:bg-blue-500/30">
      {/* Background Glows */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500/10 blur-[120px] rounded-full" />
      </div>

      <div className="max-w-4xl mx-auto relative z-10">
        {/* Header */}
        <header className="mb-12 text-center">
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-widest mb-4"
          >
            <Zap size={14} />
            Serverless Decision Engine
          </motion.div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-500 bg-clip-text text-transparent mb-4">
            SmartETL Pipeline
          </h1>
          <p className="text-slate-500 max-w-lg mx-auto">
            An event-driven ETL prototype with an adaptive decision engine that optimizes for cost and performance.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-8">
          {/* Upload Section */}
          <motion.section 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900/50 backdrop-blur-xl p-8 rounded-3xl border border-slate-800/50 shadow-2xl"
          >
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-800 rounded-2xl p-8 hover:border-blue-500/50 transition-colors group relative">
              <input 
                type="file" 
                onChange={handleFileChange}
                accept=".csv,.json,.txt"
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <div className="p-4 bg-slate-800/50 rounded-full mb-4 group-hover:scale-110 transition-transform">
                <Upload className="text-slate-400 group-hover:text-blue-400 transition-colors" size={32} />
              </div>
              <p className="text-slate-300 font-medium mb-1">
                {file ? file.name : 'Click or drag to upload file'}
              </p>
              <p className="text-slate-500 text-xs uppercase tracking-widest">
                CSV, JSON, or TXT (Max 500MB)
              </p>
            </div>

            {file && !jobId && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 flex items-center justify-between p-4 bg-slate-800/30 rounded-xl border border-slate-700/30"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <FileText className="text-blue-400" size={20} />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-200">{file.name}</div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider">
                      {(file.size / (1024 * 1024)).toFixed(2)} MB • {file.type || 'Text/Data'}
                    </div>
                  </div>
                </div>
                <button 
                  onClick={handleUpload}
                  disabled={isUploading}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-sm transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 flex items-center gap-2"
                >
                  {isUploading ? <Loader2 className="animate-spin" size={16} /> : <ArrowRight size={16} />}
                  {isUploading ? 'Uploading...' : 'Start Pipeline'}
                </button>
              </motion.div>
            )}
          </motion.section>

          {/* Status & Results Section */}
          <AnimatePresence>
            {jobStatus && (
              <motion.section 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="space-y-6"
              >
                {/* Status Card */}
                <div className="bg-slate-900/50 backdrop-blur-xl p-6 rounded-3xl border border-slate-800/50 shadow-xl flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-2xl border ${getStatusColor(jobStatus.status)}`}>
                      {jobStatus.status === 'Processing' ? <Loader2 className="animate-spin" size={24} /> : 
                       jobStatus.status === 'Completed' ? <CheckCircle size={24} /> : 
                       jobStatus.status === 'Failed' ? <XCircle size={24} /> : <Upload size={24} />}
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 uppercase tracking-[0.2em] font-bold mb-1">Current Status</div>
                      <div className="text-xl font-bold text-slate-100">{jobStatus.status}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-500 uppercase tracking-[0.2em] font-bold mb-1">Job ID</div>
                    <div className="text-sm font-mono text-slate-400">{jobStatus.id}</div>
                  </div>
                </div>

                {/* Results Grid */}
                {jobStatus.decision && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Decision Engine Card */}
                    <div className="bg-slate-900/50 backdrop-blur-xl p-6 rounded-3xl border border-slate-800/50 shadow-xl">
                      <div className="flex items-center gap-2 mb-6">
                        <BarChart3 className="text-blue-400" size={20} />
                        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-300">Decision Engine</h2>
                      </div>
                      
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-slate-800/30 rounded-2xl border border-slate-700/30">
                          <span className="text-xs text-slate-500 font-medium">Selected Service</span>
                          <span className={`flex items-center gap-1.5 text-sm font-bold ${jobStatus.decision.service === 'Lambda' ? 'text-purple-400' : 'text-orange-400'}`}>
                            {jobStatus.decision.service === 'Lambda' ? <Zap size={14} /> : <Database size={14} />}
                            {jobStatus.decision.service}
                          </span>
                        </div>
                        <div className="flex items-center justify-between p-4 bg-slate-800/30 rounded-2xl border border-slate-700/30">
                          <span className="text-xs text-slate-500 font-medium">Allocation</span>
                          <span className="text-sm font-mono font-bold text-slate-300">{jobStatus.decision.memoryAllocation}</span>
                        </div>
                        <div className="p-4 bg-blue-500/5 rounded-2xl border border-blue-500/10">
                          <span className="text-[10px] text-blue-400/60 uppercase tracking-widest font-bold block mb-1">Reasoning</span>
                          <p className="text-xs text-slate-400 leading-relaxed italic">
                            "{jobStatus.decision.explanation}"
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Performance Metrics Card */}
                    <div className="bg-slate-900/50 backdrop-blur-xl p-6 rounded-3xl border border-slate-800/50 shadow-xl">
                      <div className="flex items-center gap-2 mb-6">
                        <History className="text-emerald-400" size={20} />
                        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-300">Performance Metrics</h2>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-slate-800/30 rounded-2xl border border-slate-700/30">
                          <span className="text-xs text-slate-500 font-medium">Processing Time</span>
                          <span className="text-sm font-mono font-bold text-emerald-400">
                            {jobStatus.result?.duration ? `${jobStatus.result.duration}ms` : '---'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between p-4 bg-slate-800/30 rounded-2xl border border-slate-700/30">
                          <span className="text-xs text-slate-500 font-medium">Estimated Cost</span>
                          <span className="text-sm font-mono font-bold text-blue-400">
                            {jobStatus.result?.cost ? `$${jobStatus.result.cost.toFixed(6)}` : '---'}
                          </span>
                        </div>
                        {jobStatus.result?.error && (
                          <div className="p-4 bg-rose-500/5 rounded-2xl border border-rose-500/10">
                            <span className="text-[10px] text-rose-400/60 uppercase tracking-widest font-bold block mb-1">Error Log</span>
                            <p className="text-xs text-rose-400 leading-relaxed">
                              {jobStatus.result.error}
                            </p>
                          </div>
                        )}
                        {jobStatus.status === 'Completed' && (
                          <div className="p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/10">
                            <span className="text-[10px] text-emerald-400/60 uppercase tracking-widest font-bold block mb-1">Output Path</span>
                            <p className="text-[9px] font-mono text-slate-500 break-all leading-relaxed">
                              {jobStatus.result?.processedPath}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </motion.section>
            )}
          </AnimatePresence>
        </div>

        {/* Footer Info */}
        <footer className="mt-12 text-center text-[10px] text-slate-600 uppercase tracking-[0.3em] font-bold">
          Adaptive ETL Decision Engine Prototype • v1.0.0
        </footer>
      </div>
    </div>
  );
}
