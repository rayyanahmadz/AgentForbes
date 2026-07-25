import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  Textarea
} from "@agentforge/ui";

import { useAuth } from "@/contexts/auth-context";
import { useOrganization } from "@/contexts/organization-context";
import { supabase } from "@/lib/supabase/client";
import type {
  AiEmployee,
} from "@/lib/supabase/types";
export function PublishListingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { organization } = useOrganization();

  const [employees, setEmployees] = useState<AiEmployee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!organization) return;

    supabase
      .from("ai_employees")
      .select("*")
      .eq("organization_id", organization.id)
      .order("name", { ascending: true })
      .then(({ data }) => {
        setEmployees(data ?? []);
        if (data && data.length > 0) {
          setSelectedEmployeeId(data[0]!.id);
          setTitle(data[0]!.name);
          setDescription(data[0]!.description ?? "");
        }
        setIsLoading(false);
      });
  }, [organization]);

  function handleSelectEmployee(employeeId: string) {
    setSelectedEmployeeId(employeeId);
    const employee = employees.find((e) => e.id === employeeId);
    if (employee) {
      setTitle(employee.name);
      setDescription(employee.description ?? "");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organization || !user) return;

    const employee = employees.find((e) => e.id === selectedEmployeeId);
    if (!employee) {
      setError("Choose an employee to publish.");
      return;
    }

    setIsSaving(true);
    setError(null);

    const { error: insertError } = await supabase.from("marketplace_listings").insert({
      organization_id: organization.id,
      created_by: user.id,
      publisher_name: organization.name,
      name: title.trim() || employee.name,
      description: description.trim() || null,
      instructions: employee.instructions,
      provider: employee.provider,
      model: employee.model,
      temperature: employee.temperature
    });

    setIsSaving(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    navigate("/dashboard/marketplace");
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  if (employees.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Publish an employee</h1>
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            You need an AI Employee before you can publish one.{" "}
            <Link to="/dashboard/employees/new" className="text-primary underline">
              Create one first
            </Link>
            .
          </CardContent>
        </Card>
      </div>
    );
  }

  const selectedEmployee = employees.find((e) => e.id === selectedEmployeeId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Publish an employee</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          This publishes a snapshot of the employee's spec — name, description,
          instructions, provider, and model. Editing the original afterward won't
          change what others have already installed. Knowledge sources and memory
          are never published; installers start with a clean copy.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
            <CardDescription>Choose which employee to publish, as {organization?.name}.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="employee">Employee</Label>
              <Select
                id="employee"
                value={selectedEmployeeId}
                onChange={(event) => handleSelectEmployee(event.target.value)}
              >
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name}
                  </option>
                ))}
              </Select>
              {selectedEmployee && (
                <p className="text-xs text-muted-foreground">
getProviderOption(
  selectedEmployee.provider as AiProvider
).label                  {selectedEmployee.model}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="title">Listing title</Label>
              <Input
                id="title"
                required
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="description">Listing description</Label>
              <Textarea
                id="description"
                rows={3}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex gap-2">
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Publishing…" : "Publish to marketplace"}
              </Button>
              <Button asChild type="button" variant="outline">
                <Link to="/dashboard/marketplace">Cancel</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
