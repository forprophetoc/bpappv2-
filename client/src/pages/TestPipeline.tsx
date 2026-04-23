import { useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Plus,
  Trash2,
  ArrowLeft,
  ImageIcon,
  Upload,
} from "lucide-react";

type SlotStatus = "idle" | "running" | "success" | "failed";

interface Slot {
  id: number;
  file: File | null;
  localPreview: string | null; // object URL for instant preview
  afterUrl: string | null;
  status: SlotStatus;
  error: string | null;
}

let nextId = 1;
function emptySlot(): Slot {
  return {
    id: nextId++,
    file: null,
    localPreview: null,
    afterUrl: null,
    status: "idle",
    error: null,
  };
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // result is "data:<mime>;base64,<data>" — strip the prefix
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function TestPipeline() {
  const [slots, setSlots] = useState<Slot[]>(() => [emptySlot()]);

  const keyStatus = trpc.pipeline.keyStatus.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const testImage = trpc.pipeline.testImage.useMutation();

  function updateSlot(id: number, patch: Partial<Slot>) {
    setSlots((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function addSlot() {
    if (slots.length >= 5) return;
    setSlots((prev) => [...prev, emptySlot()]);
  }

  function removeSlot(id: number) {
    setSlots((prev) => {
      const slot = prev.find((s) => s.id === id);
      if (slot?.localPreview) URL.revokeObjectURL(slot.localPreview);
      return prev.filter((s) => s.id !== id);
    });
  }

  function handleFileSelect(slotId: number, file: File | undefined) {
    if (!file) return;
    // Revoke old preview URL if any
    const old = slots.find((s) => s.id === slotId);
    if (old?.localPreview) URL.revokeObjectURL(old.localPreview);

    const localPreview = URL.createObjectURL(file);
    updateSlot(slotId, {
      file,
      localPreview,
      afterUrl: null,
      status: "idle",
      error: null,
    });
  }

  async function runSlot(slot: Slot) {
    if (!slot.file) return;
    updateSlot(slot.id, { status: "running", afterUrl: null, error: null });
    try {
      const imageBase64 = await fileToBase64(slot.file);
      const result = await testImage.mutateAsync({
        imageBase64,
        mimeType: slot.file.type || "image/png",
      });
      updateSlot(slot.id, {
        status: result.status,
        afterUrl: result.afterUrl,
        error: result.error,
      });
    } catch (err: any) {
      updateSlot(slot.id, {
        status: "failed",
        error: err?.message || "Unexpected error",
      });
    }
  }

  async function runAll() {
    const toRun = slots.filter((s) => s.file && s.status !== "running");
    await Promise.all(toRun.map(runSlot));
  }

  const hasAnyFile = slots.some((s) => s.file);
  const anyRunning = slots.some((s) => s.status === "running");

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 text-white font-bold text-sm px-2 py-1 rounded">
            BP
          </div>
          <span className="font-semibold text-gray-800">
            Pipeline Test Console
          </span>
        </div>
        <a
          href="/"
          className="text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Dashboard
        </a>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Key status banner */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-semibold">
              Runtime Service Status
            </CardTitle>
            <CardDescription className="text-xs">
              Shows whether required API keys are detected on the server.
              Secrets are never exposed.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            {keyStatus.isLoading ? (
              <p className="text-xs text-gray-400">Checking...</p>
            ) : keyStatus.isError ? (
              <p className="text-xs text-red-500">
                Could not reach server to check key status.
              </p>
            ) : (
              <div className="flex flex-wrap gap-3">
                <StatusBadge
                  label="GEMINI_API_KEY"
                  ok={keyStatus.data!.gemini}
                />
                <StatusBadge label="S3 Storage" ok={keyStatus.data!.s3} />
                <StatusBadge label="GHL API Key" ok={keyStatus.data!.ghl} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Slots */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3 pt-5 px-5">
            <CardTitle className="text-base font-semibold">
              Image Pipeline Test
            </CardTitle>
            <CardDescription className="text-xs text-gray-500">
              Upload up to 5 before photos from your computer. Each one runs
              the OpenAI edit pipeline and returns the generated after image.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-4">
            {slots.map((slot, i) => (
              <SlotCard
                key={slot.id}
                slot={slot}
                index={i}
                slotsCount={slots.length}
                onFileSelect={(f) => handleFileSelect(slot.id, f)}
                onRemove={() => removeSlot(slot.id)}
                onRun={() => runSlot(slot)}
              />
            ))}

            <div className="flex items-center gap-3 pt-1">
              {slots.length < 5 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={addSlot}
                  className="text-xs text-gray-500"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Image Slot
                </Button>
              )}

              <Button
                size="sm"
                disabled={!hasAnyFile || anyRunning}
                onClick={runAll}
                className="ml-auto bg-blue-600 hover:bg-blue-700 text-white text-xs"
              >
                {anyRunning ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    Running...
                  </>
                ) : (
                  "Run All"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ---------- SlotCard ---------- */

function SlotCard({
  slot,
  index,
  slotsCount,
  onFileSelect,
  onRemove,
  onRun,
}: {
  slot: Slot;
  index: number;
  slotsCount: number;
  onFileSelect: (file: File | undefined) => void;
  onRemove: () => void;
  onRun: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="border rounded-lg p-4 space-y-3 bg-white">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Image {index + 1}</span>
        <div className="flex items-center gap-2">
          <SlotStatusBadge status={slot.status} />
          {slotsCount > 1 && slot.status !== "running" && (
            <button
              onClick={onRemove}
              className="text-gray-400 hover:text-red-500 transition-colors"
              title="Remove"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onFileSelect(e.target.files?.[0])}
      />

      {/* Upload area */}
      {!slot.localPreview ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full border-2 border-dashed border-gray-300 rounded-lg py-8 flex flex-col items-center gap-2 text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors cursor-pointer"
        >
          <Upload className="h-6 w-6" />
          <span className="text-sm font-medium">
            Click to upload a before photo
          </span>
          <span className="text-xs">JPG, PNG, WebP — max 20 MB</span>
        </button>
      ) : (
        <>
          {/* Before / After preview */}
          <div className="grid grid-cols-2 gap-3">
            <ImagePreview label="Before" url={slot.localPreview} />
            <ImagePreview label="After" url={slot.afterUrl} />
          </div>

          {/* Change photo button */}
          {slot.status !== "running" && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="text-xs text-blue-600 hover:underline"
            >
              Change photo
            </button>
          )}
        </>
      )}

      {slot.error && (
        <p className="text-xs text-red-600 bg-red-50 rounded px-3 py-2">
          {slot.error}
        </p>
      )}

      {slot.localPreview && (
        <Button
          size="sm"
          variant="outline"
          disabled={!slot.file || slot.status === "running"}
          onClick={onRun}
          className="text-xs"
        >
          {slot.status === "running" ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              Processing...
            </>
          ) : (
            "Run Pipeline"
          )}
        </Button>
      )}
    </div>
  );
}

/* ---------- tiny helper components ---------- */

function StatusBadge({ label, ok }: { label: string; ok: boolean }) {
  return (
    <Badge
      variant={ok ? "default" : "destructive"}
      className={`text-xs font-medium px-2.5 py-0.5 ${ok ? "bg-green-100 text-green-800 hover:bg-green-100" : ""}`}
    >
      {ok ? (
        <CheckCircle2 className="h-3 w-3 mr-1 inline" />
      ) : (
        <XCircle className="h-3 w-3 mr-1 inline" />
      )}
      {label}: {ok ? "Detected" : "Missing"}
    </Badge>
  );
}

function SlotStatusBadge({ status }: { status: SlotStatus }) {
  if (status === "idle") return null;
  if (status === "running")
    return (
      <Badge variant="secondary" className="text-xs">
        <Loader2 className="h-3 w-3 animate-spin mr-1 inline" /> Running
      </Badge>
    );
  if (status === "success")
    return (
      <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-xs">
        <CheckCircle2 className="h-3 w-3 mr-1 inline" /> Success
      </Badge>
    );
  return (
    <Badge variant="destructive" className="text-xs">
      <XCircle className="h-3 w-3 mr-1 inline" /> Failed
    </Badge>
  );
}

function ImagePreview({ label, url }: { label: string; url: string | null }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer">
          <img
            src={url}
            alt={label}
            className="rounded border border-gray-200 w-full h-40 object-cover bg-gray-100"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        </a>
      ) : (
        <div className="rounded border border-dashed border-gray-300 w-full h-40 flex items-center justify-center bg-gray-50">
          <ImageIcon className="h-6 w-6 text-gray-300" />
        </div>
      )}
    </div>
  );
}
