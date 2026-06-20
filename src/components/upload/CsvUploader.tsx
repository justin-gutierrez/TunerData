"use client";

/**
 * CsvUploader — drag-and-drop / file-picker for CSV datalogs.
 *
 * Responsibilities:
 *   • Accept a single CSV file via drag-and-drop or the native file picker
 *   • Read it as text with FileReader (100 % client-side — no server contact)
 *   • Call onFileLoaded(csvText, fileName) for the parent to process
 *   • Show clear error messages for unsupported file types / oversized files
 *   • Show a loaded-file summary card with a "change" button
 */

import {
  useRef,
  useState,
  useCallback,
  type DragEvent,
  type ChangeEvent,
} from "react";
import { Upload, FileText, X, AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface LoadedFile {
  name: string;
  sizeBytes: number;
  text: string;
}

interface Props {
  onFileLoaded: (file: LoadedFile) => void;
  loadedFile?: LoadedFile | null;
  onClear?: () => void;
  isProcessing?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const MAX_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

function validateFile(file: File): string | null {
  const name = file.name.toLowerCase();
  const isText =
    name.endsWith(".csv") ||
    name.endsWith(".txt") ||
    file.type === "text/csv" ||
    file.type === "text/plain" ||
    file.type === "";

  if (!isText) {
    if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      return "Excel files (.xlsx / .xls) are not supported. Export your log as a CSV from your tuning software first.";
    }
    if (name.endsWith(".hpl") || name.endsWith(".hptuner")) {
      return "HPTuners binary formats (.hpl / .hptuner) are not supported. Use the HPTuners Export function to save as CSV.";
    }
    if (name.endsWith(".msl")) {
      return "MegaLogViewer .msl files are not supported. Export as CSV from MegaLogViewer HD.";
    }
    return `Unsupported file type "${file.name}". Please upload a plain-text .csv file.`;
  }

  if (file.size > MAX_SIZE_BYTES) {
    return `File is too large (${formatBytes(file.size)}). Maximum is 25 MB — a typical WOT pull CSV is under 1 MB. Trim the log to the relevant session before uploading.`;
  }

  if (file.size === 0) {
    return "The file appears to be empty.";
  }

  return null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CsvUploader({
  onFileLoaded,
  loadedFile,
  onClear,
  isProcessing = false,
}: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── File reader ────────────────────────────────────────────────────────────

  const processFile = useCallback(
    (file: File) => {
      setError(null);
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result;
        if (typeof text !== "string") {
          setError("Could not read the file as text. The file may be corrupted.");
          return;
        }
        onFileLoaded({ name: file.name, sizeBytes: file.size, text });
      };
      reader.onerror = () => {
        setError("Failed to read the file. Please try again.");
      };
      reader.readAsText(file);
    },
    [onFileLoaded],
  );

  // ── Drag handlers ──────────────────────────────────────────────────────────

  const onDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // Only clear drag state when leaving the outer element entirely
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  // ── Input change ───────────────────────────────────────────────────────────

  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    // Reset so the same file can be re-selected after a clear
    e.target.value = "";
  };

  // ── Render: loaded file card ───────────────────────────────────────────────

  if (loadedFile) {
    return (
      <div className="rounded-xl border border-green-500/25 bg-[#0d1a0f] p-5 space-y-3">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 shrink-0 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center">
            <FileText className="h-5 w-5 text-green-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-green-300 truncate">
              {loadedFile.name}
            </p>
            <p className="text-xs text-zinc-600 mt-0.5">
              {formatBytes(loadedFile.sizeBytes)} · ready to validate
            </p>
          </div>
          {onClear && !isProcessing && (
            <button
              onClick={onClear}
              className="h-7 w-7 shrink-0 rounded-md flex items-center justify-center text-zinc-600 hover:text-zinc-300 hover:bg-white/6 transition-colors"
              title="Remove file"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Quick-swap button */}
        {!isProcessing && (
          <button
            onClick={() => inputRef.current?.click()}
            className="text-xs text-zinc-600 hover:text-zinc-400 underline underline-offset-2 transition-colors"
          >
            Upload a different file
          </button>
        )}

        <input
          ref={inputRef}
          type="file"
          accept=".csv,.txt,text/csv,text/plain"
          className="hidden"
          onChange={onInputChange}
        />
      </div>
    );
  }

  // ── Render: drop zone ──────────────────────────────────────────────────────

  return (
    <div className="space-y-3">
      <div
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onClick={() => !isProcessing && inputRef.current?.click()}
        className={cn(
          "rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer",
          isDragging
            ? "border-red-500/60 bg-red-500/5 scale-[1.005]"
            : "border-white/8 bg-[#0d0d0d] hover:border-red-500/30 hover:bg-[#0f0f0f]",
          isProcessing && "pointer-events-none opacity-50",
        )}
      >
        <div className="flex flex-col items-center justify-center gap-4 py-14 px-8 text-center">
          {/* Upload icon */}
          <div
            className={cn(
              "h-14 w-14 rounded-2xl border flex items-center justify-center transition-colors",
              isDragging
                ? "border-red-500/40 bg-red-500/10"
                : "border-white/6 bg-[#111111]",
            )}
          >
            <Upload
              className={cn(
                "h-7 w-7 transition-colors",
                isDragging ? "text-red-400" : "text-zinc-600",
              )}
            />
          </div>

          {/* Label */}
          <div>
            <p
              className={cn(
                "font-medium mb-1 transition-colors",
                isDragging ? "text-red-300" : "text-zinc-300",
              )}
            >
              {isDragging ? "Drop it!" : "Drop your CSV file here"}
            </p>
            <p className="text-sm text-zinc-600">
              or{" "}
              <span className="text-red-400 hover:underline">
                browse to select
              </span>{" "}
              · .csv files only
            </p>
          </div>

          {/* Format chips */}
          <div className="flex flex-wrap gap-2 justify-center">
            {["COBB Accessport", "MHD / BMW", "Generic CSV"].map((fmt) => (
              <span
                key={fmt}
                className="rounded-full border border-white/6 bg-[#111111] px-3 py-1 text-xs text-zinc-600"
              >
                {fmt}
              </span>
            ))}
          </div>

          {/* Size note */}
          <p className="text-[10px] text-zinc-700">Max 25 MB · processed entirely in your browser · nothing is uploaded</p>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.txt,text/csv,text/plain"
        className="hidden"
        onChange={onInputChange}
      />

      {/* Error message */}
      {error && (
        <div className="rounded-lg border border-red-500/25 bg-red-500/8 flex items-start gap-3 p-4">
          <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-300 mb-1">
              Cannot read file
            </p>
            <p className="text-xs text-red-400/70 leading-relaxed">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-zinc-600 hover:text-zinc-400 shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Privacy notice */}
      <div className="flex items-center gap-2 px-1">
        <CheckCircle2 className="h-3.5 w-3.5 text-green-500/60 shrink-0" />
        <p className="text-xs text-zinc-600">
          Files are processed locally in your browser — nothing is uploaded to a server.
        </p>
      </div>
    </div>
  );
}
