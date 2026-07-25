import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Upload } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Textarea
} from "@agentforge/ui";

import { useAuth } from "@/contexts/auth-context";
import { useOrganization } from "@/contexts/organization-context";
import {
  MAX_KNOWLEDGE_FILE_BYTES,
  isAllowedKnowledgeFile,
  readFileAsText
} from "@/lib/knowledge";
import { supabase } from "@/lib/supabase/client";

type Mode = "text" | "file";

export function KnowledgeNewPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { organization } = useOrganization();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<Mode>("text");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [textContent, setTextContent] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!isAllowedKnowledgeFile(file)) {
      setError("Only .txt and .md files are supported right now.");
      event.target.value = "";
      return;
    }

    if (file.size > MAX_KNOWLEDGE_FILE_BYTES) {
      setError(
        `That file is too large (${Math.round(file.size / 1024)} KB). Max size is ${Math.round(
          MAX_KNOWLEDGE_FILE_BYTES / 1024
        )} KB.`
      );
      event.target.value = "";
      return;
    }

    setError(null);
    setSelectedFile(file);
    if (!name) setName(file.name.replace(/\.(txt|md)$/i, ""));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organization || !user) return;

    if (mode === "file" && !selectedFile) {
      setError("Choose a .txt or .md file first.");
      return;
    }
    if (mode === "text" && !textContent.trim()) {
      setError("Paste some text first.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      if (mode === "file" && selectedFile) {
        const extractedText = await readFileAsText(selectedFile);
        const filePath = `${organization.id}/${crypto.randomUUID()}-${selectedFile.name}`;

        const { error: uploadError } = await supabase.storage
          .from("knowledge-files")
          .upload(filePath, selectedFile, { contentType: selectedFile.type || "text/plain" });

        if (uploadError) {
          setError(uploadError.message);
          setIsSaving(false);
          return;
        }

        const { error: insertError } = await supabase.from("knowledge_sources").insert({
          organization_id: organization.id,
          created_by: user.id,
          name: name.trim() || selectedFile.name,
          description: description.trim() || null,
          source_type: "file",
          file_path: filePath,
          file_name: selectedFile.name,
          mime_type: selectedFile.type || "text/plain",
          content: extractedText
        });

        if (insertError) {
          // Roll back the uploaded file if the row insert failed, so we
          // don't leave an orphaned file with nothing pointing to it.
          await supabase.storage.from("knowledge-files").remove([filePath]);
          setError(insertError.message);
          setIsSaving(false);
          return;
        }
      } else {
        const { error: insertError } = await supabase.from("knowledge_sources").insert({
          organization_id: organization.id,
          created_by: user.id,
          name: name.trim() || "Untitled source",
          description: description.trim() || null,
          source_type: "text",
          content: textContent
        });

        if (insertError) {
          setError(insertError.message);
          setIsSaving(false);
          return;
        }
      }

      navigate("/dashboard/knowledge");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Add knowledge source</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Paste text directly, or upload a .txt/.md file (PDF/DOCX support lands
          later). Attach it to an employee from that employee's edit page.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Source</CardTitle>
          <CardDescription>Choose how to add the content.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-5 flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={mode === "text" ? "default" : "outline"}
              onClick={() => setMode("text")}
            >
              Paste text
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === "file" ? "default" : "outline"}
              onClick={() => setMode("file")}
            >
              Upload file
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                required
                placeholder="e.g. Refund Policy"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="description">Description (optional)</Label>
              <Input
                id="description"
                placeholder="What is this source, briefly?"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>

            {mode === "text" ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="content">Content</Label>
                <Textarea
                  id="content"
                  rows={10}
                  placeholder="Paste the text you want employees to know about…"
                  value={textContent}
                  onChange={(event) => setTextContent(event.target.value)}
                />
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="file">File</Label>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center gap-2 rounded-md border border-dashed p-8 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  <Upload className="h-5 w-5" strokeWidth={1.5} />
                  {selectedFile ? (
                    <span className="font-medium text-foreground">{selectedFile.name}</span>
                  ) : (
                    <span>Click to choose a .txt or .md file</span>
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  id="file"
                  type="file"
                  accept=".txt,.md,text/plain,text/markdown"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex gap-2">
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Saving…" : "Add source"}
              </Button>
              <Button asChild type="button" variant="outline">
                <Link to="/dashboard/knowledge">Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
