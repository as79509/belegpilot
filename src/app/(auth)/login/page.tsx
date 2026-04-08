"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Eye, EyeOff } from "lucide-react";
import { de } from "@/lib/i18n/de";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError(de.auth.invalidCredentials);
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  function fillDemo(email: string) {
    const emailInput = document.getElementById("email") as HTMLInputElement;
    const passwordInput = document.getElementById("password") as HTMLInputElement;
    if (emailInput) emailInput.value = email;
    if (passwordInput) passwordInput.value = "demo2026";
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm space-y-4">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-semibold tracking-tight">
              {de.auth.signInTitle}
            </CardTitle>
            <CardDescription>{de.auth.signInDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{de.auth.email}</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="admin@belegpilot.ch"
                  required
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{de.auth.password}</Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <p className="text-sm text-red-600 text-center">{error}</p>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? de.auth.signingIn : de.auth.signIn}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Demo credentials */}
        <Card className="border-dashed">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs font-medium text-muted-foreground mb-2">Demo-Zugänge:</p>
            <div className="space-y-1">
              <button type="button" onClick={() => fillDemo("admin@belegpilot.ch")} className="w-full text-left text-xs hover:bg-muted p-1 rounded transition-colors">
                <span className="font-mono">admin@belegpilot.ch</span> / demo2026 <span className="text-muted-foreground">(Administrator)</span>
              </button>
              <button type="button" onClick={() => fillDemo("trustee@belegpilot.ch")} className="w-full text-left text-xs hover:bg-muted p-1 rounded transition-colors">
                <span className="font-mono">trustee@belegpilot.ch</span> / demo2026 <span className="text-muted-foreground">(Treuhänder)</span>
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
